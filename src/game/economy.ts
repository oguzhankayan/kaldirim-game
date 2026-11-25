import { TOOLS, UPGRADES, type UpgradeId } from './content';
import type { JobRevision } from './job-layouts';
const round = (value: number): number => Math.max(1, Math.round(value / 4) * 4);
/** First clamp remains an early milestone. Larger tools scale with the size of this job. */
export function toolPrice(tier: number, gross: number, pay: number, revision: JobRevision): number {
  const t = TOOLS[tier]; if (!t) return Infinity;
  if (revision === 1 || tier === 0) return t.cost;
  const clamp = round(60 * pay), rowTotal = Math.max(clamp * 2, round(gross * .085));
  return tier === 1 ? clamp : tier === 2 ? rowTotal - clamp : Math.max(rowTotal, round(gross * .40)) - rowTotal;
}
const weights: Record<UpgradeId, readonly number[]> = {
  capacity: [0, .009, .024, .057], speed: [0, .010, .030, .070],
  logistics: [0, .009, .025, .060], reach: [0, .017, .033], precision: [.015, .030, .070],
};
const early: Partial<Record<UpgradeId, number>> = { capacity: 12, speed: 30, logistics: 45, reach: 40 };
export function upgradePrice(id: UpgradeId, tier: number, gross: number, pay: number, revision: JobRevision): number | undefined {
  const u = UPGRADES.find(u => u.id === id); if (!u || !Number.isInteger(tier) || tier < 0 || tier >= u.costs.length) return undefined;
  if (revision === 1) return u.costs[tier];
  return round(tier === 0 && id !== 'precision' ? early[id]! * pay : weights[id][tier]! * gross);
}
