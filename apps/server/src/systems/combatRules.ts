import { computeLevelFromXp } from "@pathbound/shared";
import { dot2D, normalize2D } from "../utils/math.js";

export interface Positioned {
  x: number;
  y: number;
  z: number;
}

export function isCooldownReady(lastUsedAt: number, now: number, cooldownMs: number): boolean {
  return now - lastUsedAt >= cooldownMs;
}

export function isWithinRangeAndArc(
  attacker: Positioned,
  target: Positioned,
  forward: { x: number; z: number },
  range: number,
  fovDeg: number,
): boolean {
  const dx = target.x - attacker.x;
  const dy = Math.abs(target.y - attacker.y);
  const dz = target.z - attacker.z;
  const distanceSq = dx * dx + dy * dy + dz * dz;
  if (distanceSq > range * range || dy > 2.4) {
    return false;
  }

  const toTarget = normalize2D(dx, dz);
  if (toTarget.x === 0 && toTarget.z === 0) {
    return true;
  }

  const halfFov = (fovDeg * Math.PI) / 360;
  const minDot = Math.cos(halfFov);
  return dot2D(forward, toTarget) >= minDot;
}

export function scaledDamage(baseDamage: number, skillLevel: number): number {
  const levelBonus = Math.max(0, skillLevel - 1) * 0.02;
  return Math.round(baseDamage * (1 + levelBonus));
}

export function addXp(currentXp: number, amount: number): { xp: number; level: number } {
  const xp = Math.max(0, currentXp + amount);
  return { xp, level: computeLevelFromXp(xp) };
}
