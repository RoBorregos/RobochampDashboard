// RoboChamp 2026 rulebooks (Principiantes / Avanzados), sections 1.5 and 3.
export type MarsCategory = "BEGINNERS" | "ADVANCED";

export const MARS_ROUND_SECONDS = 480; // 8 min competition time, excludes the 2 min setup

export const MARS_POINTS = {
  panels: 10,
  speedBumps: 10,
  stairs: 15,
  seeds: 15,
  seesaw: 25,
} as const;

export const MARS_LIMITS = {
  BEGINNERS: { panels: 6, speedBumps: 2, stairs: 0, seeds: 3 }, // 150 pts
  ADVANCED: { panels: 6, speedBumps: 3, stairs: 2, seeds: 3 }, // 190 pts
} as const;

export type MarsCounts = {
  panels: number;
  speedBumps: number;
  stairs: number;
  seeds: number;
  seesawCrossed: boolean;
};

/** Points for one round. The 1 pt/sec time bonus only applies at full score. */
export function computeMarsPoints(
  category: MarsCategory,
  v: MarsCounts,
  roundTimeSeconds: number,
) {
  const max = MARS_LIMITS[category];
  const zone1 = v.panels * MARS_POINTS.panels;
  const zone2 =
    v.speedBumps * MARS_POINTS.speedBumps +
    v.stairs * MARS_POINTS.stairs +
    v.seeds * MARS_POINTS.seeds +
    (v.seesawCrossed ? MARS_POINTS.seesaw : 0);

  const perfect =
    v.panels === max.panels &&
    v.speedBumps === max.speedBumps &&
    v.stairs === max.stairs &&
    v.seeds === max.seeds &&
    v.seesawCrossed;

  const bonus = perfect ? Math.max(0, MARS_ROUND_SECONDS - roundTimeSeconds) : 0;
  return zone1 + zone2 + bonus;
}
