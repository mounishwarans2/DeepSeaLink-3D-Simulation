// ─────────────────────────────────────────────────────────────────────────────
// MARINE LIFE SIMULATION — shared types and steering utilities
// Pure TypeScript.  No Three.js imports.
// ─────────────────────────────────────────────────────────────────────────────

export interface AnimalState {
  x: number; y: number; z: number;  // world position
  yaw: number;                        // heading in XZ plane (radians)
  speed: number;                      // world units / second
  wanderAngle: number;                // slowly-rotating wander direction
  preferredY: number;                 // target depth Y
  phaseOffset: number;                // individual animation phase
}

// Hardware node XZ positions for avoidance
export const NODE_XZ: Array<[number, number]> = [
  [0, 0], [90, 60], [-380, 440], [640, -560], [-680, -460],
  [-580, -480], [660, -380], [-460, 560], [560, 660], [-260, -300],
  [-200, 200], [300, 280], [-420, -240], [460, -360], [-680, -620],
  [840, -580], [-920, 340], [980, 520], [-500, 820], [580, 880],
  [-1200, -1020], [1200, -1080], [-100, -1400], [160, -1560], [-60, -1480],
];

export const AVOID_RADIUS = 100; // world units

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function makeAnimal(
  x: number, y: number, z: number,
  speed: number, phase: number,
): AnimalState {
  return {
    x, y, z,
    yaw:         Math.random() * Math.PI * 2,
    speed,
    wanderAngle: Math.random() * Math.PI * 2,
    preferredY:  y,
    phaseOffset: phase,
  };
}

export function stepAnimal(
  a: AnimalState,
  dt: number,
  wanderRate: number,
  yBobAmp: number,
  time: number,
): void {
  a.wanderAngle += Math.sin(time * 0.13 + a.phaseOffset) * wanderRate * dt;

  let dYaw = a.wanderAngle - a.yaw;
  while (dYaw >  Math.PI) dYaw -= Math.PI * 2;
  while (dYaw < -Math.PI) dYaw += Math.PI * 2;
  a.yaw += dYaw * clamp(dt * 1.2, 0, 0.45);

  a.x += Math.sin(a.yaw) * a.speed * dt;
  a.z += Math.cos(a.yaw) * a.speed * dt;

  const targetY = a.preferredY + Math.sin(time * 0.28 + a.phaseOffset) * yBobAmp;
  a.y += (targetY - a.y) * clamp(dt * 0.6, 0, 1);
}

export function avoidNodes(a: AnimalState): void {
  for (const [nx, nz] of NODE_XZ) {
    const dx = a.x - nx;
    const dz = a.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < AVOID_RADIUS * AVOID_RADIUS && d2 > 0.5) {
      const d    = Math.sqrt(d2);
      const push = (AVOID_RADIUS - d) / AVOID_RADIUS;
      a.x += (dx / d) * push * 15;
      a.z += (dz / d) * push * 15;
    }
  }
}

export function wrapBounds(
  a: AnimalState,
  xMin: number, xMax: number,
  zMin: number, zMax: number,
): void {
  if (a.x < xMin) { a.x = xMin + 1; a.wanderAngle = Math.PI - a.wanderAngle; a.yaw = a.wanderAngle; }
  if (a.x > xMax) { a.x = xMax - 1; a.wanderAngle = Math.PI - a.wanderAngle; a.yaw = a.wanderAngle; }
  if (a.z < zMin) { a.z = zMin + 1; a.wanderAngle = -a.wanderAngle; a.yaw = a.wanderAngle; }
  if (a.z > zMax) { a.z = zMax - 1; a.wanderAngle = -a.wanderAngle; a.yaw = a.wanderAngle; }
}
