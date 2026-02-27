import { describe, expect, it } from "vitest";
import { addXp, isCooldownReady, isWithinRangeAndArc, scaledDamage } from "./combatRules.js";

describe("combatRules", () => {
  it("enforces cooldown windows", () => {
    expect(isCooldownReady(1000, 1600, 700)).toBe(false);
    expect(isCooldownReady(1000, 1700, 700)).toBe(true);
  });

  it("checks arc and range", () => {
    const forward = { x: 0, z: 1 };
    const attacker = { x: 0, y: 0, z: 0 };

    expect(
      isWithinRangeAndArc(attacker, { x: 0, y: 0, z: 2 }, forward, 3, 90),
    ).toBe(true);

    expect(
      isWithinRangeAndArc(attacker, { x: 3, y: 0, z: 0 }, forward, 3, 90),
    ).toBe(false);

    expect(
      isWithinRangeAndArc(attacker, { x: 0, y: 0, z: 6 }, forward, 3, 90),
    ).toBe(false);

    expect(
      isWithinRangeAndArc(attacker, { x: 0, y: 3.1, z: 2 }, forward, 3.5, 120),
    ).toBe(false);
  });

  it("awards xp and computes levels", () => {
    expect(addXp(0, 20)).toEqual({ xp: 20, level: 1 });
    expect(addXp(95, 15)).toEqual({ xp: 110, level: 2 });
  });

  it("scales damage by skill level", () => {
    expect(scaledDamage(20, 1)).toBe(20);
    expect(scaledDamage(20, 5)).toBe(22);
    expect(scaledDamage(15, 11)).toBe(18);
  });
});
