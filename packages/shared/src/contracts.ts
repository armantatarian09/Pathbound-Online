export type Archetype = "Archer" | "Mage" | "Swordsman" | "Assassin";

export const ARCHETYPES: readonly Archetype[] = [
  "Archer",
  "Mage",
  "Swordsman",
  "Assassin",
];

export const SKILL_KEYS = [
  "ArcheryAccuracy",
  "SwordPrecision",
  "Assassination",
  "MagicControl",
] as const;

export type SkillKey = (typeof SKILL_KEYS)[number];

export type AttackType = "sword" | "archer" | "mage";

export interface SkillProgress {
  ArcheryAccuracy: number;
  SwordPrecision: number;
  Assassination: number;
  MagicControl: number;
}

export const DEFAULT_SKILL_XP: SkillProgress = {
  ArcheryAccuracy: 0,
  SwordPrecision: 0,
  Assassination: 0,
  MagicControl: 0,
};

export const DEFAULT_SKILL_LEVELS: SkillProgress = {
  ArcheryAccuracy: 1,
  SwordPrecision: 1,
  Assassination: 1,
  MagicControl: 1,
};

export const XP_PER_LEVEL = 100;

export interface MoveIntent {
  moveX: number;
  moveZ: number;
  yaw: number;
  sprint: boolean;
  jump: boolean;
}

export interface AttackIntent {
  type: AttackType;
  yaw: number;
  pitch: number;
}

export interface CombatFeedback {
  sourceId: string;
  targetId: string;
  targetKind: "dummy" | "player";
  attackType: AttackType;
  damage: number;
  skill: SkillKey;
  skillLevel: number;
  xpAwarded: number;
  targetHp: number;
  targetMaxHp: number;
  timestamp: number;
}

export interface AttackDefinition {
  cooldownMs: number;
  range: number;
  fovDeg: number;
  damage: number;
  xpOnHit: number;
  skill: SkillKey;
}

export const ATTACK_DEFINITIONS: Record<AttackType, AttackDefinition> = {
  sword: {
    cooldownMs: 900,
    range: 3.2,
    fovDeg: 95,
    damage: 16,
    xpOnHit: 14,
    skill: "SwordPrecision",
  },
  archer: {
    cooldownMs: 700,
    range: 28,
    fovDeg: 14,
    damage: 13,
    xpOnHit: 11,
    skill: "ArcheryAccuracy",
  },
  mage: {
    cooldownMs: 1100,
    range: 24,
    fovDeg: 20,
    damage: 19,
    xpOnHit: 12,
    skill: "MagicControl",
  },
};

export const PHYSICS = {
  walkSpeed: 7,
  sprintSpeed: 11,
  jumpVelocity: 7.5,
  gravity: -24,
  arenaHalfExtent: 42,
  tickRate: 20,
} as const;

export const COMBAT_SECURITY = {
  maxAttackYawDriftRad: Math.PI / 3,
  minAttackIntervalMs: 120,
} as const;

export const DUMMY_CONFIG = {
  maxHealth: 140,
  respawnMs: 3500,
  count: 8,
} as const;
