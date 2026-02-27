import "./style.css";
import {
  ArcRotateCamera,
  Color3,
  Color4,
  Engine,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core";
import { Client, type Room } from "colyseus.js";
import {
  ARCHETYPES,
  ATTACK_DEFINITIONS,
  PHYSICS,
  type Archetype,
  type AttackType,
  type CombatFeedback,
  type MoveIntent,
  type SkillProgress,
} from "@pathbound/shared";
import { initFirebaseUser } from "./firebase";

interface NetworkSkillTrack extends SkillProgress {}

interface NetworkPlayer {
  id: string;
  name: string;
  archetype: Archetype;
  x: number;
  y: number;
  z: number;
  yaw: number;
  hp: number;
  skillXp: NetworkSkillTrack;
  skillLevels: NetworkSkillTrack;
}

interface NetworkDummy {
  id: string;
  x: number;
  y: number;
  z: number;
  hp: number;
  maxHp: number;
}

interface NetworkState {
  players: unknown;
  dummies: unknown;
}

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? "ws://localhost:2567";
const SEND_INTERVAL_MS = 50;

function elementById<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing required element #${id}`);
  }
  return element as T;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function wrapRadians(value: number): number {
  const twoPi = Math.PI * 2;
  let wrapped = value % twoPi;
  if (wrapped <= -Math.PI) {
    wrapped += twoPi;
  }
  if (wrapped > Math.PI) {
    wrapped -= twoPi;
  }
  return wrapped;
}

function normalize2D(x: number, z: number): { x: number; z: number } {
  const length = Math.hypot(x, z);
  if (length === 0) {
    return { x: 0, z: 0 };
  }
  return { x: x / length, z: z / length };
}

function lerpAngle(from: number, to: number, alpha: number): number {
  const delta = wrapRadians(to - from);
  return wrapRadians(from + delta * alpha);
}

function forEachSchemaMap<T>(
  collection: unknown,
  callback: (value: T, key: string) => void,
): void {
  if (!collection || typeof collection !== "object") {
    return;
  }

  const maybeForEach = (collection as { forEach?: unknown }).forEach;
  if (typeof maybeForEach !== "function") {
    return;
  }

  (maybeForEach as (cb: (value: T, key: string) => void) => void).call(collection, callback);
}

function resolveArchetypeFromQuery(): Archetype {
  const value = new URLSearchParams(window.location.search).get("class");
  if (value && (ARCHETYPES as readonly string[]).includes(value)) {
    return value as Archetype;
  }
  return "Swordsman";
}

const canvas = elementById<HTMLCanvasElement>("renderCanvas");
const connectionStatusEl = elementById<HTMLElement>("connectionStatus");
const classLabelEl = elementById<HTMLElement>("classLabel");
const skillsEl = elementById<HTMLElement>("skills");
const combatLogEl = elementById<HTMLUListElement>("combatLog");
const attackStatusEl = elementById<HTMLElement>("attackStatus");

const selectedArchetype = resolveArchetypeFromQuery();
classLabelEl.textContent = `Class: ${selectedArchetype}`;

const engine = new Engine(canvas, true);
const scene = new Scene(engine);
scene.clearColor = new Color4(0.04, 0.07, 0.11, 1);

const hemi = new HemisphericLight("hemi", new Vector3(0.2, 1, 0.15), scene);
hemi.intensity = 0.95;

const ground = MeshBuilder.CreateGround(
  "ground",
  { width: PHYSICS.arenaHalfExtent * 2, height: PHYSICS.arenaHalfExtent * 2 },
  scene,
);
const groundMaterial = new StandardMaterial("ground-material", scene);
groundMaterial.diffuseColor = new Color3(0.18, 0.28, 0.23);
ground.material = groundMaterial;

for (let index = 0; index < 6; index += 1) {
  const marker = MeshBuilder.CreateBox(
    `marker-${index}`,
    { width: 1.6, height: 1.6 + index * 0.3, depth: 1.6 },
    scene,
  );
  marker.position = new Vector3(-15 + index * 6, marker.scaling.y * 0.8, 28);
  const markerMat = new StandardMaterial(`marker-mat-${index}`, scene);
  markerMat.diffuseColor = new Color3(0.35 + index * 0.05, 0.34, 0.24);
  marker.material = markerMat;
}

const camera = new ArcRotateCamera("camera", Math.PI, 1.18, 11, new Vector3(0, 1.5, 0), scene);
camera.lowerRadiusLimit = 7;
camera.upperRadiusLimit = 15;
camera.panningSensibility = 0;
camera.wheelDeltaPercentage = 0.01;
camera.attachControl(canvas, true);

const localPlayerMaterial = new StandardMaterial("local-player", scene);
localPlayerMaterial.diffuseColor = new Color3(0.22, 0.77, 0.91);

const remoteMaterials: Record<Archetype, StandardMaterial> = {
  Archer: new StandardMaterial("remote-archer", scene),
  Mage: new StandardMaterial("remote-mage", scene),
  Swordsman: new StandardMaterial("remote-swordsman", scene),
  Assassin: new StandardMaterial("remote-assassin", scene),
};
remoteMaterials.Archer.diffuseColor = new Color3(0.83, 0.73, 0.26);
remoteMaterials.Mage.diffuseColor = new Color3(0.5, 0.45, 0.92);
remoteMaterials.Swordsman.diffuseColor = new Color3(0.89, 0.43, 0.33);
remoteMaterials.Assassin.diffuseColor = new Color3(0.39, 0.86, 0.52);

const dummyMaterial = new StandardMaterial("dummy", scene);
dummyMaterial.diffuseColor = new Color3(0.82, 0.24, 0.24);

const playerMeshes = new Map<string, Mesh>();
const remoteTargetPositions = new Map<string, Vector3>();
const remoteTargetYaw = new Map<string, number>();
const dummyMeshes = new Map<string, Mesh>();

const pressedKeys = new Set<string>();
const combatLines: string[] = [];
const attackCooldownUntil: Record<AttackType, number> = {
  sword: 0,
  archer: 0,
  mage: 0,
};

let room: Room<unknown> | null = null;
let localSessionId = "";
let localMesh: Mesh | null = null;
let localPredictedPos = new Vector3(0, 0, 0);
let localVelocityY = 0;
let localOnGround = true;
let localYaw = Math.PI;
let jumpBuffered = false;
let lastMoveSendAt = 0;

let latestLocalServerPos: Vector3 | null = null;
let localSkillLevels: SkillProgress | null = null;
let localSkillXp: SkillProgress | null = null;
let localHp = 100;

let nextHudRefreshAt = 0;

window.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    jumpBuffered = true;
  }

  if (!event.repeat) {
    if (event.code === "Digit1") {
      sendAttackIntent("sword");
    }
    if (event.code === "Digit2") {
      sendAttackIntent("archer");
    }
    if (event.code === "Digit3") {
      sendAttackIntent("mage");
    }
  }

  pressedKeys.add(event.code);
});

window.addEventListener("keyup", (event) => {
  pressedKeys.delete(event.code);
});

canvas.addEventListener("click", () => {
  void canvas.requestPointerLock();
});

window.addEventListener("mousemove", (event) => {
  if (document.pointerLockElement !== canvas) {
    return;
  }
  localYaw = wrapRadians(localYaw - event.movementX * 0.0026);
});

window.addEventListener("resize", () => {
  engine.resize();
});

function createPlayerMesh(playerId: string, isLocal: boolean, archetype: Archetype): Mesh {
  const mesh = MeshBuilder.CreateBox(`player-${playerId}`, { width: 1, height: 2, depth: 1 }, scene);
  mesh.position.y = 1;
  mesh.material = isLocal ? localPlayerMaterial : remoteMaterials[archetype];
  return mesh;
}

function createDummyMesh(dummyId: string): Mesh {
  const mesh = MeshBuilder.CreateCylinder(
    `dummy-${dummyId}`,
    { diameterTop: 1, diameterBottom: 1.4, height: 2.4, tessellation: 10 },
    scene,
  );
  mesh.material = dummyMaterial;
  mesh.position.y = 1.2;
  return mesh;
}

function sendAttackIntent(attackType: AttackType): void {
  if (!room) {
    return;
  }

  attackCooldownUntil[attackType] = performance.now() + ATTACK_DEFINITIONS[attackType].cooldownMs;

  room.send("attack", {
    type: attackType,
    yaw: localYaw,
    pitch: 0,
  });
}

function appendCombatLine(text: string): void {
  combatLines.unshift(text);
  if (combatLines.length > 7) {
    combatLines.pop();
  }

  combatLogEl.replaceChildren(
    ...combatLines.map((line) => {
      const item = document.createElement("li");
      item.textContent = line;
      return item;
    }),
  );
}

function updateSkillsHud(): void {
  if (!localSkillLevels || !localSkillXp) {
    return;
  }

  const lines = [
    `HP: ${localHp.toFixed(0)}`,
    `ArcheryAccuracy L${localSkillLevels.ArcheryAccuracy} (XP ${localSkillXp.ArcheryAccuracy.toFixed(0)})`,
    `SwordPrecision L${localSkillLevels.SwordPrecision} (XP ${localSkillXp.SwordPrecision.toFixed(0)})`,
    `Assassination L${localSkillLevels.Assassination} (XP ${localSkillXp.Assassination.toFixed(0)})`,
    `MagicControl L${localSkillLevels.MagicControl} (XP ${localSkillXp.MagicControl.toFixed(0)})`,
  ];

  skillsEl.replaceChildren(
    ...lines.map((line) => {
      const row = document.createElement("div");
      row.textContent = line;
      return row;
    }),
  );
}

function getAttackLabel(type: AttackType): string {
  switch (type) {
    case "sword":
      return "1 Sword";
    case "archer":
      return "2 Archer";
    case "mage":
      return "3 Mage";
  }
}

function updateAttackStatusHud(nowMs: number): void {
  const entries: AttackType[] = ["sword", "archer", "mage"];

  attackStatusEl.replaceChildren(
    ...entries.map((type) => {
      const remainingMs = Math.max(0, attackCooldownUntil[type] - nowMs);
      const row = document.createElement("div");
      row.textContent =
        remainingMs > 0
          ? `${getAttackLabel(type)}: ${Math.ceil(remainingMs / 100) / 10}s`
          : `${getAttackLabel(type)}: Ready`;
      row.className = remainingMs > 0 ? "attack-cd" : "attack-ready";
      return row;
    }),
  );
}

function syncFromServer(dt: number): void {
  if (!room) {
    return;
  }

  const state = room.state as NetworkState;
  const seenPlayers = new Set<string>();

  forEachSchemaMap<NetworkPlayer>(state.players, (player, key) => {
    seenPlayers.add(key);

    if (!playerMeshes.has(key)) {
      const mesh = createPlayerMesh(key, key === localSessionId, player.archetype);
      playerMeshes.set(key, mesh);
      if (key === localSessionId) {
        localMesh = mesh;
        localPredictedPos = new Vector3(player.x, player.y, player.z);
        latestLocalServerPos = new Vector3(player.x, player.y, player.z);
        localYaw = player.yaw;
      }
    }

    if (key === localSessionId) {
      latestLocalServerPos = new Vector3(player.x, player.y, player.z);
      localSkillLevels = {
        ArcheryAccuracy: player.skillLevels.ArcheryAccuracy,
        SwordPrecision: player.skillLevels.SwordPrecision,
        Assassination: player.skillLevels.Assassination,
        MagicControl: player.skillLevels.MagicControl,
      };
      localSkillXp = {
        ArcheryAccuracy: player.skillXp.ArcheryAccuracy,
        SwordPrecision: player.skillXp.SwordPrecision,
        Assassination: player.skillXp.Assassination,
        MagicControl: player.skillXp.MagicControl,
      };
      localHp = player.hp;
      return;
    }

    remoteTargetPositions.set(key, new Vector3(player.x, player.y, player.z));
    remoteTargetYaw.set(key, player.yaw);
  });

  for (const [meshId, mesh] of playerMeshes) {
    if (seenPlayers.has(meshId)) {
      continue;
    }
    mesh.dispose();
    playerMeshes.delete(meshId);
    remoteTargetPositions.delete(meshId);
    remoteTargetYaw.delete(meshId);
    if (meshId === localSessionId) {
      localMesh = null;
      latestLocalServerPos = null;
    }
  }

  for (const [meshId, mesh] of playerMeshes) {
    if (meshId === localSessionId) {
      continue;
    }

    const targetPos = remoteTargetPositions.get(meshId);
    if (!targetPos) {
      continue;
    }

    const desiredPos = new Vector3(targetPos.x, targetPos.y + 1, targetPos.z);
    mesh.position = Vector3.Lerp(mesh.position, desiredPos, Math.min(1, dt * 9.5));

    const targetYaw = remoteTargetYaw.get(meshId);
    if (typeof targetYaw === "number") {
      mesh.rotation.y = lerpAngle(mesh.rotation.y, targetYaw, Math.min(1, dt * 10));
    }
  }

  const seenDummies = new Set<string>();
  forEachSchemaMap<NetworkDummy>(state.dummies, (dummy, key) => {
    seenDummies.add(key);

    if (!dummyMeshes.has(key)) {
      dummyMeshes.set(key, createDummyMesh(dummy.id));
    }

    const mesh = dummyMeshes.get(key);
    if (!mesh) {
      return;
    }

    mesh.position.x = dummy.x;
    mesh.position.z = dummy.z;
    mesh.position.y = 1.2;
    mesh.isVisible = dummy.hp > 0;
    const healthRatio = clamp(dummy.hp / Math.max(dummy.maxHp, 1), 0.05, 1);
    mesh.scaling.y = healthRatio;
  });

  for (const [dummyId, mesh] of dummyMeshes) {
    if (seenDummies.has(dummyId)) {
      continue;
    }
    mesh.dispose();
    dummyMeshes.delete(dummyId);
  }
}

function simulateLocalPrediction(dt: number): MoveIntent {
  let moveX = 0;
  let moveZ = 0;

  if (pressedKeys.has("KeyA")) {
    moveX -= 1;
  }
  if (pressedKeys.has("KeyD")) {
    moveX += 1;
  }
  if (pressedKeys.has("KeyW")) {
    moveZ += 1;
  }
  if (pressedKeys.has("KeyS")) {
    moveZ -= 1;
  }

  const normalizedMove = normalize2D(moveX, moveZ);
  const sprint = pressedKeys.has("ShiftLeft") || pressedKeys.has("ShiftRight");
  const speed = sprint ? PHYSICS.sprintSpeed : PHYSICS.walkSpeed;

  const forward = new Vector3(Math.sin(localYaw), 0, Math.cos(localYaw));
  const right = new Vector3(forward.z, 0, -forward.x);
  const velocity = right
    .scale(normalizedMove.x * speed)
    .add(forward.scale(normalizedMove.z * speed));

  localPredictedPos = localPredictedPos.add(velocity.scale(dt));
  localPredictedPos.x = clamp(localPredictedPos.x, -PHYSICS.arenaHalfExtent, PHYSICS.arenaHalfExtent);
  localPredictedPos.z = clamp(localPredictedPos.z, -PHYSICS.arenaHalfExtent, PHYSICS.arenaHalfExtent);

  const jumpNow = jumpBuffered && localOnGround;
  if (jumpNow) {
    localVelocityY = PHYSICS.jumpVelocity;
    localOnGround = false;
    jumpBuffered = false;
  }

  localVelocityY += PHYSICS.gravity * dt;
  localPredictedPos.y += localVelocityY * dt;

  if (localPredictedPos.y <= 0) {
    localPredictedPos.y = 0;
    localVelocityY = 0;
    localOnGround = true;
  }

  if (latestLocalServerPos) {
    const syncError = Vector3.Distance(localPredictedPos, latestLocalServerPos);
    if (syncError > 2.8) {
      localPredictedPos = latestLocalServerPos.clone();
    } else {
      localPredictedPos = Vector3.Lerp(localPredictedPos, latestLocalServerPos, Math.min(1, dt * 5));
    }
  }

  if (localMesh) {
    localMesh.position = new Vector3(localPredictedPos.x, localPredictedPos.y + 1, localPredictedPos.z);
    localMesh.rotation.y = localYaw;
    camera.alpha = localYaw + Math.PI;
    camera.setTarget(localMesh.position.add(new Vector3(0, 1.3, 0)));
  }

  return {
    moveX: normalizedMove.x,
    moveZ: normalizedMove.z,
    yaw: localYaw,
    sprint,
    jump: jumpNow,
  };
}

async function connectToServer(): Promise<void> {
  try {
    const firebaseUser = await initFirebaseUser();
    const displayName = firebaseUser
      ? `U-${firebaseUser.uid.slice(0, 6)}`
      : `Guest-${Math.floor(Math.random() * 9999)
          .toString()
          .padStart(4, "0")}`;

    const client = new Client(SERVER_URL);
    room = await client.joinOrCreate("arena", {
      displayName,
      archetype: selectedArchetype,
      firebaseUid: firebaseUser?.uid ?? null,
    });

    localSessionId = room.sessionId;
    connectionStatusEl.textContent = `Connected to ${SERVER_URL} as ${displayName}`;

    room.onMessage("combat_feedback", (feedback: CombatFeedback) => {
      const sourcePrefix = feedback.sourceId === localSessionId ? "You" : feedback.sourceId;
      appendCombatLine(
        `${sourcePrefix} ${feedback.attackType} hit ${feedback.targetKind} ${feedback.targetId} for ${feedback.damage} (L${feedback.skillLevel} ${feedback.skill}, +${feedback.xpAwarded} XP, target ${Math.max(0, feedback.targetHp).toFixed(0)}/${feedback.targetMaxHp.toFixed(0)})`,
      );
    });

    room.onLeave((code) => {
      connectionStatusEl.textContent = `Disconnected (code ${code})`;
    });
  } catch (error) {
    connectionStatusEl.textContent = "Connection failed. Ensure server is running on ws://localhost:2567";
    console.error(error);
  }
}

void connectToServer();

engine.runRenderLoop(() => {
  const dt = Math.min(0.05, engine.getDeltaTime() / 1000);

  syncFromServer(dt);

  if (room && localSessionId) {
    const moveIntent = simulateLocalPrediction(dt);
    const now = performance.now();
    if (now - lastMoveSendAt >= SEND_INTERVAL_MS || moveIntent.jump) {
      room.send("move", moveIntent);
      lastMoveSendAt = now;
    }

    if (now >= nextHudRefreshAt) {
      updateSkillsHud();
      updateAttackStatusHud(now);
      nextHudRefreshAt = now + 180;
    }
  }

  scene.render();
});
