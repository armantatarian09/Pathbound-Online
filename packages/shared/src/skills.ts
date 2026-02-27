import { DEFAULT_SKILL_LEVELS, DEFAULT_SKILL_XP, XP_PER_LEVEL, type SkillKey, type SkillProgress } from "./contracts";

export function cloneSkillProgress(source: SkillProgress): SkillProgress {
  return {
    ArcheryAccuracy: source.ArcheryAccuracy,
    SwordPrecision: source.SwordPrecision,
    Assassination: source.Assassination,
    MagicControl: source.MagicControl,
  };
}

export function createDefaultSkillXp(): SkillProgress {
  return cloneSkillProgress(DEFAULT_SKILL_XP);
}

export function createDefaultSkillLevels(): SkillProgress {
  return cloneSkillProgress(DEFAULT_SKILL_LEVELS);
}

export function computeLevelFromXp(xp: number): number {
  return 1 + Math.floor(Math.max(0, xp) / XP_PER_LEVEL);
}

export function incrementSkill(skill: SkillProgress, key: SkillKey, amount: number): SkillProgress {
  return {
    ...skill,
    [key]: Math.max(0, skill[key] + amount),
  };
}
