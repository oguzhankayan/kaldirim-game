/** Read-only presentation: the simulation already placed/paid for the stones. */
export interface LandingMotion { delay: number; duration: number; height: number; age: number }
export function landingMotion(tier: number, ordinal: number, count: number): LandingMotion {
  const q = count > 1 ? ordinal / (count - 1) : 0;
  if (tier === 0) return { delay: 0, duration: .16, height: .11, age: 0 };
  if (tier === 1) return { delay: 0, duration: .20, height: .19, age: 0 };
  if (tier === 2) return { delay: q * .09, duration: .18, height: .14, age: 0 };
  return { delay: Math.floor(q * 2) * .025, duration: .23, height: .24, age: 0 };
}
export function landingHeight(motion: LandingMotion): number {
  const t = Math.max(0, Math.min(1, (motion.age - motion.delay) / motion.duration));
  // A controlled lowering, no bounce, shatter, camera shake or physical debris.
  return .012 + motion.height * (1 - t * t * (3 - 2 * t));
}
