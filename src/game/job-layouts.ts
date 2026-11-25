import { LEVELS, type LevelSpec } from './content';

export type JobRevision = 1 | 2;
export type SiteLayout = 'elbow' | 'plaza' | 'garden-walks' | 'promenade' | 'courtyard';
export interface SiteRect { x: number; z: number; w: number; h: number }
declare module './content' { interface LevelSpec { layout?: SiteLayout } }
/** A saved revision is a contract. Never reinterpret an old cell ID using a new site. */
export const CURRENT_JOB_REVISION: JobRevision = 2;
const jobs: readonly LevelSpec[] = [
  { ...LEVELS[0]!, cols: 160, rows: 160, layout: 'elbow' },
  { ...LEVELS[1]!, cols: 130, rows: 140, layout: 'plaza' },
  { ...LEVELS[2]!, cols: 180, rows: 190, layout: 'garden-walks' },
  { ...LEVELS[3]!, cols: 140, rows: 270, layout: 'promenade' },
  { ...LEVELS[4]!, cols: 210, rows: 210, layout: 'courtyard' },
];
export function jobSpec(level: number, revision: JobRevision = CURRENT_JOB_REVISION): LevelSpec {
  return (revision === 1 ? LEVELS : jobs)[level] ?? (revision === 1 ? LEVELS : jobs)[0]!;
}
/** Union of axis-aligned paths: one connected job, not separately gated missions. */
export function siteRectangles(spec: LevelSpec): readonly SiteRect[] {
  switch (spec.layout) {
    case 'elbow': return [{ x: 0, z: 0, w: 160, h: 36 }, { x: 112, z: 0, w: 48, h: 160 }];
    case 'garden-walks': return [
      { x: 0, z: 0, w: 180, h: 40 }, { x: 0, z: 72, w: 180, h: 46 }, { x: 0, z: 150, w: 180, h: 40 },
      { x: 24, z: 0, w: 32, h: 190 }, { x: 124, z: 0, w: 32, h: 190 },
    ];
    case 'promenade': return [{ x: 0, z: 0, w: 112, h: 270 }, { x: 112, z: 42, w: 28, h: 36 }, { x: 112, z: 182, w: 28, h: 36 }];
    default: return [{ x: 0, z: 0, w: spec.cols, h: spec.rows }];
  }
}
export function siteHoles(spec: LevelSpec): SiteRect[] {
  if (spec.layout === 'garden-walks') return [70, 98].flatMap(x => [51, 126].map(z => ({ x, z, w: 10, h: 12 })));
  const { cols, rows, theme } = spec;
  if (theme === 'park') return [0.25, 0.65].flatMap(x => [0.26, 0.64].map(z => ({ x: Math.floor(cols * x), z: Math.floor(rows * z), w: 8, h: 10 })));
  if (theme === 'square' || theme === 'oldtown') return [{ x: Math.floor(cols / 2) - 5, z: Math.floor(rows / 2) - 6, w: 10, h: 12 }];
  return [];
}
export function siteMask(spec: LevelSpec): Uint8Array {
  const mask = new Uint8Array(spec.cols * spec.rows);
  for (const r of siteRectangles(spec)) for (let z = r.z; z < Math.min(spec.rows, r.z + r.h); z++)
    for (let x = r.x; x < Math.min(spec.cols, r.x + r.w); x++) mask[z * spec.cols + x] = 1;
  if (spec.layout === 'courtyard') for (const x of [0, spec.cols - 20]) for (const z of [0, spec.rows - 20])
    for (let dz = 0; dz < 20; dz++) for (let dx = 0; dx < 20; dx++) mask[(z + dz) * spec.cols + x + dx] = 0;
  for (const h of siteHoles(spec)) for (let z = h.z; z < h.z + h.h; z++) for (let x = h.x; x < h.x + h.w; x++)
    if (x >= 0 && x < spec.cols && z >= 0 && z < spec.rows) mask[z * spec.cols + x] = 0;
  return mask;
}
/** Merge identical horizontal runs; render paths/landscaping without one mesh per cell. */
export function maskRectangles(spec: LevelSpec, mask: Uint8Array, value = 1): SiteRect[] {
  const out: SiteRect[] = []; let previous = new Map<string, SiteRect>();
  for (let z = 0; z < spec.rows; z++) {
    const current = new Map<string, SiteRect>();
    for (let x = 0; x < spec.cols;) {
      if (mask[z * spec.cols + x] !== value) { x++; continue; }
      const start = x; while (x < spec.cols && mask[z * spec.cols + x] === value) x++;
      const key = `${start}:${x}`, old = previous.get(key);
      const rect = old ?? { x: start, z, w: x - start, h: 0 };
      rect.h++; current.set(key, rect); if (!old) out.push(rect);
    }
    previous = current;
  }
  return out;
}
