import { CELL_X, CELL_Z, paverCourseShift, type LevelSpec, type LocalText, type Theme } from './content';
import { PavingGrid } from './grid';

/** Color inlays, NOT a different structural bond. Never rotate/change the saved grid. */
export const PATTERN_REVISION = 1;
export type PaverTone = 0 | 1 | 2 | 3;
export const PAVER_SWATCHES = [
  { id: 'natural', name: { tr: 'Doğal gri', en: 'Natural grey' }, tint: '#f2f0e9', map: '#b9b6a9' },
  { id: 'charcoal', name: { tr: 'Antrasit', en: 'Charcoal' }, tint: '#525b61', map: '#485052' },
  { id: 'terracotta', name: { tr: 'Kiremit', en: 'Terracotta' }, tint: '#cc8462', map: '#ad7258' },
  { id: 'buff', name: { tr: 'Kum beji', en: 'Buff' }, tint: '#f4d8a0', map: '#c6af83' },
] as const;
export interface PatternDefinition {
  readonly id: string;
  readonly name: LocalText;
  readonly description: LocalText;
}
const PATTERNS: Readonly<Record<Theme, PatternDefinition>> = {
  street: { id: 'diamond-bands', name: { tr: 'Baklava şeritleri', en: 'Diamond bands' }, description: { tr: 'Antrasit hatlar, kiremit baklavalar ve açık renkli geçişler.', en: 'Charcoal outlines, terracotta diamonds and light linking bands.' } },
  square: { id: 'plaza-medallion', name: { tr: 'Meydan göbeği', en: 'Plaza medallion' }, description: { tr: 'Çeşmenin çevresinde iç içe baklavalar; çevrede çerçeveli panolar.', en: 'Nested diamonds around the fountain with framed outer panels.' } },
  park: { id: 'garden-panels', name: { tr: 'Park panoları', en: 'Garden panels' }, description: { tr: 'Açık ve kum beji panolar, küçük göbekler ve ağaç çevresi kuşakları.', en: 'Light and buff panels, small center motifs and tree-island bands.' } },
  coast: { id: 'coastal-chevron', name: { tr: 'Kıyı zikzağı', en: 'Coastal chevrons' }, description: { tr: 'Yol boyunca tekrar eden geniş, üç renkli zikzak kuşakları.', en: 'Broad three-color chevron inlays repeating along the walk.' } },
  oldtown: { id: 'heritage-octagons', name: { tr: 'Sekizgen halı', en: 'Octagon carpet' }, description: { tr: 'Kiremit zeminli sekizgen göbekler, açık iç panolar ve antrasit konturlar.', en: 'Terracotta octagonal medallions, light inner panels and charcoal outlines.' } },
};
export function patternDefinition(spec: LevelSpec): PatternDefinition { return PATTERNS[spec.theme]; }
const mod = (x: number, period: number): number => ((x % period) + period) % period;
const repeat = (x: number, period: number): number => Math.abs(mod(x + period / 2, period) - period / 2);
const octagon = (x: number, z: number): number => Math.max(x, z, (x + z) / Math.SQRT2);

/** Meter-space motifs keep diamonds square despite non-square cells and shifted courses. */
function interior(theme: Theme, x: number, z: number, width: number, depth: number): PaverTone {
  const ax = Math.abs(x), az = Math.abs(z);
  switch (theme) {
    case 'street': {
      const nx = Math.max(1, Math.round((width - 2.5) / 6.4)), nz = Math.max(1, Math.round((depth - 2.5) / 5.76));
      const px = (width - 2.5) / nx, pz = (depth - 2.5) / nz;
      const dx = repeat(x - (nx % 2 ? 0 : px / 2), px), dz = repeat(z - (nz % 2 ? 0 : pz / 2), pz);
      const diamond = dx + dz, radius = Math.min(px, pz) * .35;
      if (diamond < radius * .25) return 3;
      if (diamond < radius * .78) return 2;
      if (diamond < radius) return 1;
      if (dz > pz / 2 - .42) return 3;
      return 0;
    }
    case 'square': {
      const d = ax + az;
      if (d < 3.45) return 3;
      if (d < 3.9) return 1;
      if (d < 5.0) return 2;
      if (d < 5.38) return 0;
      if (d < 5.8) return 1;
      if (d < 6.45) return 3;
      if (d < 6.85) return 1;
      const dx = repeat(x, 7.68), dz = repeat(z, 5.76);
      if (dx < .3 || dz < .3) return 1;
      if (dx < .57 || dz < .57) return 3;
      const center = Math.abs(dx - 1.92) + Math.abs(dz - 1.44);
      return center < .65 ? 2 : 0;
    }
    case 'park': {
      const dx = repeat(x, 6.4), dz = repeat(z, 6.24);
      if (dx < .25 || dz < .25) return 1;
      if (dx < .5 || dz < .5) return 0;
      if (Math.abs(dx - 1.6) + Math.abs(dz - 1.56) < .55) return 2;
      return mod(Math.floor(x / 3.2) + Math.floor(z / 3.12), 2) === 0 ? 0 : 3;
    }
    case 'coast': {
      // A color chevron in the existing Double-T bond, not rotated herringbone geometry.
      const band = mod(z - ax * .72, 5.76);
      if (band < .64) return 1;
      if (band < .96) return 0;
      if (band < 2.25) return 3;
      if (band < 2.57) return 0;
      if (band < 3.4) return 2;
      return 0;
    }
    case 'oldtown': {
      const central = octagon(ax, az);
      if (central < 2.8) return 3;
      if (central < 3.2) return 1;
      if (central < 4.0) return 2;
      if (central < 4.35) return 1;
      const dx = repeat(x, 7.68), dz = repeat(z, 7.68), d = octagon(dx, dz);
      if (d < .55) return 2;
      if (d < 1.25) return 3;
      if (d < 1.6) return 1;
      if (d < 2.38) return 0;
      if (d < 2.75) return 1;
      if (d < 3.3) return 2;
      return 3;
    }
  }
}

export class PavingPatternPlan {
  readonly definition: PatternDefinition;
  private readonly tones: Uint8Array;
  private readonly shades: Float32Array;
  constructor(readonly spec: LevelSpec) {
    this.definition = patternDefinition(spec);
    // Share the actual layout rules, rather than duplicating island coordinates in art code.
    const grid = new PavingGrid(spec), holes = grid.holes();
    this.tones = new Uint8Array(grid.cells.length);
    this.shades = new Float32Array(grid.cells.length);
    for (let i = 0; i < this.tones.length; i++) {
      const col = i % spec.cols, row = Math.floor(i / spec.cols);
      const x = Math.min((col + .5) * CELL_X + paverCourseShift(row), grid.width - CELL_X / 4);
      const z = (row + .5) * CELL_Z;
      let tone = interior(spec.theme, x - grid.width / 2, z - grid.depth / 2, grid.width, grid.depth);
      // A deliberate double border joins the inside motif; never a border-only design.
      const edge = Math.min(x, grid.width - x, z, grid.depth - z);
      if (edge < .4) tone = 1;
      else if (edge < .65) tone = 0;
      else if (edge < 1.0) tone = 2;
      else if (edge < 1.25) tone = 0;
      for (const h of holes) {
        const dx = Math.max(h.x * CELL_X - x, x - (h.x + h.w) * CELL_X, 0);
        const dz = Math.max(h.z * CELL_Z - z, z - (h.z + h.h) * CELL_Z, 0);
        const distance = Math.max(dx, dz);
        if (distance < .42) tone = 1;
        else if (distance < .72) tone = 3;
      }
      this.tones[i] = grid.valid[i] ? tone : 0;
      // Restrained material variation cannot scramble a motif or depend on placement order.
      let hash = Math.imul(i ^ spec.seed, 0x45d9f3b) >>> 0;
      hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b) >>> 0;
      this.shades[i] = .96 + (hash & 1023) / 1023 * .08;
    }
  }
  toneAt(index: number): PaverTone { return (this.tones[index] ?? 0) as PaverTone; }
  shadeAt(index: number): number { return this.shades[index] ?? 1; }
}

// Fixed level descriptors are immutable. Weak keys do not retain abandoned custom/test jobs.
const plans = new WeakMap<LevelSpec, PavingPatternPlan>();
export function patternPlan(spec: LevelSpec): PavingPatternPlan {
  let plan = plans.get(spec);
  if (!plan) { plan = new PavingPatternPlan(spec); plans.set(spec, plan); }
  return plan;
}
