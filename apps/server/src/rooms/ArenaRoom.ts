import { Room, type Client } from "@colyseus/core";
import {
  ARCHETYPES,
  ATTACK_DEFINITIONS,
  COMBAT_SECURITY,
  DUMMY_CONFIG,
  PHYSICS,
  type Archetype,
  type AttackIntent,
  type AttackType,
  type CombatFeedback,
  type MoveIntent,
  type SkillKey,
} from "@pathbound/shared";
import { ArenaState } from "../schema/ArenaState.js";
import { DummyState } from "../schema/DummyState.js";
import { PlayerState } from "../schema/PlayerState.js";
import { addXp, isCooldownReady, isWithinRangeAndArc, scaledDamage } from "../systems/combatRules.js";
import { angleDiff, clamp, distanceSquared3D, forwardFromYaw, normalize2D, wrapRadians } from "../utils/math.js";
import { getSkillValue, setSkillValue } from "../utils/skillSchema.js";

type CombatTarget =
  | { kind: "dummy"; id: string; entity: DummyState }
  | { kind: "player"; id: string; entity: PlayerState };

interface RuntimeState {
  lastAttacks: Record<AttackType, number>;
  lastAttackIntentAt: number;
}

const EMPTY_INPUT: MoveIntent = {
  moveX: 0,
  moveZ: 0,
  yaw: 0,
  sprint: false,
  jump: false,
};

export class ArenaRoom extends Room<ArenaState> {
  private readonly moveInputs = new Map<string, MoveIntent>();
  private readonly runtimeByPlayer = new Map<string, RuntimeState>();

  onCreate(): void {
    this.setState(new ArenaState());
    this.maxClients = 24;
    this.setPatchRate(1000 / PHYSICS.tickRate);
    this.setSimulationInterval((deltaMs) => this.updateWorld(deltaMs), 1000 / PHYSICS.tickRate);
    this.seedDummies();

    this.onMessage("move", (client, payload: MoveIntent) => {
      this.moveInputs.set(client.sessionId, this.sanitizeMoveIntent(payload));
    });

    this.onMessage("attack", (client, payload: AttackIntent) => {
      this.processAttackIntent(client, payload);
    });

    console.log("[room] arena created");
  }

  onJoin(client: Client, options: Record<string, unknown>): void {
    const player = new PlayerState();
    const joinedCount = this.state.players.size + 1;
    const spawnAngle = joinedCount * 0.8;
    player.id = client.sessionId;
    player.name = this.resolveDisplayName(options, joinedCount);
    player.archetype = this.resolveArchetype(options);
    player.x = Math.cos(spawnAngle) * 5;
    player.z = Math.sin(spawnAngle) * 5;
    player.skillLevels.ArcheryAccuracy = 1;
    player.skillLevels.SwordPrecision = 1;
    player.skillLevels.Assassination = 1;
    player.skillLevels.MagicControl = 1;

    this.state.players.set(client.sessionId, player);
    this.moveInputs.set(client.sessionId, { ...EMPTY_INPUT });
    this.runtimeByPlayer.set(client.sessionId, {
      lastAttacks: {
        sword: Number.NEGATIVE_INFINITY,
        archer: Number.NEGATIVE_INFINITY,
        mage: Number.NEGATIVE_INFINITY,
      },
      lastAttackIntentAt: Number.NEGATIVE_INFINITY,
    });

    console.log(`[room] ${player.name} (${client.sessionId}) joined`);
  }

  onLeave(client: Client): void {
    this.state.players.delete(client.sessionId);
    this.moveInputs.delete(client.sessionId);
    this.runtimeByPlayer.delete(client.sessionId);
    console.log(`[room] ${client.sessionId} left`);
  }

  private updateWorld(deltaMs: number): void {
    const dt = Math.max(0, deltaMs) / 1000;
    this.state.serverTime = Date.now();

    this.state.players.forEach((player, sessionId) => {
      const input = this.moveInputs.get(sessionId) ?? EMPTY_INPUT;
      this.simulateMovement(player, input, dt);
    });

    this.refreshDummies(this.state.serverTime);
  }

  private simulateMovement(player: PlayerState, input: MoveIntent, dt: number): void {
    const normalized = normalize2D(clamp(input.moveX, -1, 1), clamp(input.moveZ, -1, 1));
    const speed = input.sprint ? PHYSICS.sprintSpeed : PHYSICS.walkSpeed;
    const yaw = wrapRadians(input.yaw);
    const forward = forwardFromYaw(yaw);
    const right = { x: forward.z, z: -forward.x };

    const velocityX = (right.x * normalized.x + forward.x * normalized.z) * speed;
    const velocityZ = (right.z * normalized.x + forward.z * normalized.z) * speed;

    player.x = clamp(player.x + velocityX * dt, -PHYSICS.arenaHalfExtent, PHYSICS.arenaHalfExtent);
    player.z = clamp(player.z + velocityZ * dt, -PHYSICS.arenaHalfExtent, PHYSICS.arenaHalfExtent);

    if (input.jump && player.onGround) {
      player.vy = PHYSICS.jumpVelocity;
      player.onGround = false;
    }

    player.vy += PHYSICS.gravity * dt;
    player.y += player.vy * dt;

    if (player.y <= 0) {
      player.y = 0;
      player.vy = 0;
      player.onGround = true;
    }

    player.yaw = yaw;
  }

  private processAttackIntent(client: Client, rawIntent: AttackIntent): void {
    const attacker = this.state.players.get(client.sessionId);
    if (!attacker || attacker.hp <= 0) {
      return;
    }

    const intent = this.sanitizeAttackIntent(rawIntent, attacker.yaw);
    if (!intent) {
      return;
    }

    const runtime = this.runtimeByPlayer.get(client.sessionId);
    if (!runtime) {
      return;
    }

    const attack = ATTACK_DEFINITIONS[intent.type];
    const now = Date.now();
    if (now - runtime.lastAttackIntentAt < COMBAT_SECURITY.minAttackIntervalMs) {
      return;
    }
    runtime.lastAttackIntentAt = now;

    if (!isCooldownReady(runtime.lastAttacks[intent.type], now, attack.cooldownMs)) {
      return;
    }

    // Baseline anti-cheat: attack direction must be close to current movement/camera yaw.
    if (angleDiff(intent.yaw, attacker.yaw) > COMBAT_SECURITY.maxAttackYawDriftRad) {
      return;
    }

    runtime.lastAttacks[intent.type] = now;

    if (intent.type === "sword") {
      this.resolveSwordAttack(client.sessionId, attacker, intent);
      return;
    }

    this.resolveRangedAttack(client.sessionId, attacker, intent);
  }

  private resolveSwordAttack(attackerId: string, attacker: PlayerState, intent: AttackIntent): void {
    const attack = ATTACK_DEFINITIONS.sword;
    const forward = forwardFromYaw(intent.yaw);
    const targets = this.collectTargets(attackerId, attacker, forward, attack.range, attack.fovDeg);

    for (const target of targets) {
      this.applyHit(attacker, target, "sword");
    }
  }

  private resolveRangedAttack(attackerId: string, attacker: PlayerState, intent: AttackIntent): void {
    const attack = ATTACK_DEFINITIONS[intent.type];
    const spreadDeg = intent.type === "archer" ? 3.5 : 6;
    const spreadRad = ((Math.random() - 0.5) * spreadDeg * Math.PI) / 180;
    const forward = forwardFromYaw(intent.yaw + spreadRad);

    const targets = this.collectTargets(attackerId, attacker, forward, attack.range, attack.fovDeg);
    if (targets.length === 0) {
      return;
    }

    const nearest = targets.reduce((best, current) => {
      const currentDist = distanceSquared3D(attacker, current.entity);
      if (!best) {
        return { target: current, dist: currentDist };
      }
      if (currentDist < best.dist) {
        return { target: current, dist: currentDist };
      }
      return best;
    }, undefined as { target: CombatTarget; dist: number } | undefined);

    if (nearest) {
      this.applyHit(attacker, nearest.target, intent.type);
    }
  }

  private collectTargets(
    attackerId: string,
    attacker: PlayerState,
    forward: { x: number; z: number },
    range: number,
    fovDeg: number,
  ): CombatTarget[] {
    const targets: CombatTarget[] = [];

    this.state.dummies.forEach((dummy) => {
      if (dummy.hp <= 0) {
        return;
      }
      if (!isWithinRangeAndArc(attacker, dummy, forward, range, fovDeg)) {
        return;
      }
      targets.push({ kind: "dummy", id: dummy.id, entity: dummy });
    });

    this.state.players.forEach((player, sessionId) => {
      if (sessionId === attackerId || player.hp <= 0) {
        return;
      }
      if (!isWithinRangeAndArc(attacker, player, forward, range, fovDeg)) {
        return;
      }
      targets.push({ kind: "player", id: player.id, entity: player });
    });

    return targets;
  }

  private applyHit(attacker: PlayerState, target: CombatTarget, attackType: AttackType): void {
    const attack = ATTACK_DEFINITIONS[attackType];
    const skillLevel = getSkillValue(attacker.skillLevels, attack.skill);
    const damage = scaledDamage(attack.damage, skillLevel);

    if (target.kind === "dummy") {
      target.entity.hp = Math.max(0, target.entity.hp - damage);
      if (target.entity.hp === 0) {
        target.entity.respawnAt = Date.now() + DUMMY_CONFIG.respawnMs;
      }
    } else {
      target.entity.hp = Math.max(0, target.entity.hp - damage);
      if (target.entity.hp === 0) {
        this.respawnPlayer(target.entity);
      }
    }

    this.awardXp(attacker, attack.skill, attack.xpOnHit);

    const feedback: CombatFeedback = {
      sourceId: attacker.id,
      targetId: target.id,
      targetKind: target.kind,
      attackType,
      damage,
      skill: attack.skill,
      skillLevel,
      xpAwarded: attack.xpOnHit,
      targetHp: target.entity.hp,
      targetMaxHp: target.entity.maxHp,
      timestamp: Date.now(),
    };

    this.broadcast("combat_feedback", feedback);
  }

  private awardXp(player: PlayerState, skill: SkillKey, amount: number): void {
    const currentXp = getSkillValue(player.skillXp, skill);
    const { xp, level } = addXp(currentXp, amount);
    setSkillValue(player.skillXp, skill, xp);
    setSkillValue(player.skillLevels, skill, level);
  }

  private refreshDummies(now: number): void {
    this.state.dummies.forEach((dummy) => {
      if (dummy.hp <= 0 && now >= dummy.respawnAt) {
        dummy.hp = dummy.maxHp;
        dummy.respawnAt = 0;
      }
    });
  }

  private respawnPlayer(player: PlayerState): void {
    const randomAngle = Math.random() * Math.PI * 2;
    const randomRadius = 4 + Math.random() * 4;

    player.hp = player.maxHp;
    player.x = Math.cos(randomAngle) * randomRadius;
    player.z = Math.sin(randomAngle) * randomRadius;
    player.y = 0;
    player.vy = 0;
    player.onGround = true;
  }

  private seedDummies(): void {
    for (let index = 0; index < DUMMY_CONFIG.count; index += 1) {
      const dummy = new DummyState();
      const angle = (index / DUMMY_CONFIG.count) * Math.PI * 2;
      const radius = index % 2 === 0 ? 16 : 12;

      dummy.id = `dummy-${index + 1}`;
      dummy.x = Math.cos(angle) * radius;
      dummy.z = Math.sin(angle) * radius;
      dummy.y = 0;
      dummy.maxHp = DUMMY_CONFIG.maxHealth;
      dummy.hp = DUMMY_CONFIG.maxHealth;

      this.state.dummies.set(dummy.id, dummy);
    }
  }

  private sanitizeMoveIntent(payload: MoveIntent): MoveIntent {
    return {
      moveX: clamp(Number(payload?.moveX ?? 0), -1, 1),
      moveZ: clamp(Number(payload?.moveZ ?? 0), -1, 1),
      yaw: wrapRadians(Number(payload?.yaw ?? 0)),
      sprint: Boolean(payload?.sprint),
      jump: Boolean(payload?.jump),
    };
  }

  private sanitizeAttackIntent(payload: AttackIntent, fallbackYaw: number): AttackIntent | null {
    const attackType = payload?.type;
    if (attackType !== "sword" && attackType !== "archer" && attackType !== "mage") {
      return null;
    }

    const yaw = Number.isFinite(payload?.yaw) ? wrapRadians(Number(payload.yaw)) : fallbackYaw;
    const pitch = Number.isFinite(payload?.pitch) ? clamp(Number(payload.pitch), -1.3, 1.3) : 0;

    return {
      type: attackType,
      yaw,
      pitch,
    };
  }

  private resolveDisplayName(options: Record<string, unknown>, fallbackIndex: number): string {
    const fromOptions = options["displayName"];
    if (typeof fromOptions !== "string") {
      return `Player-${fallbackIndex}`;
    }

    const trimmed = fromOptions.trim();
    return trimmed.length > 0 ? trimmed.slice(0, 16) : `Player-${fallbackIndex}`;
  }

  private resolveArchetype(options: Record<string, unknown>): Archetype {
    const maybeArchetype = options["archetype"];
    if (typeof maybeArchetype === "string" && (ARCHETYPES as readonly string[]).includes(maybeArchetype)) {
      return maybeArchetype as Archetype;
    }
    return "Swordsman";
  }
}
