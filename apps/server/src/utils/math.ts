export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function wrapRadians(value: number): number {
  const twoPi = Math.PI * 2;
  let result = value % twoPi;
  if (result <= -Math.PI) {
    result += twoPi;
  }
  if (result > Math.PI) {
    result -= twoPi;
  }
  return result;
}

export function angleDiff(a: number, b: number): number {
  return Math.abs(wrapRadians(a - b));
}

export function normalize2D(x: number, z: number): { x: number; z: number } {
  const length = Math.hypot(x, z);
  if (length === 0) {
    return { x: 0, z: 0 };
  }
  return { x: x / length, z: z / length };
}

export function forwardFromYaw(yaw: number): { x: number; z: number } {
  return { x: Math.sin(yaw), z: Math.cos(yaw) };
}

export function dot2D(a: { x: number; z: number }, b: { x: number; z: number }): number {
  return a.x * b.x + a.z * b.z;
}

export function distanceSquared3D(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}
