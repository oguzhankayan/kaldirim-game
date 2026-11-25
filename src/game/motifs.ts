import { CELL_X, CELL_Z, paverCourseShift, type LevelSpec } from './content';
import type { PavingGrid } from './grid';

/** Group visible motifs/panels; completion feedback is not another objective or currency. */
function panelKey(spec: LevelSpec, id: number): string {
  const x = (id % spec.cols + .5) * CELL_X + paverCourseShift(Math.floor(id / spec.cols)) - spec.cols * CELL_X / 2;
  const z = (Math.floor(id / spec.cols) + .5) * CELL_Z - spec.rows * CELL_Z / 2;
  if (spec.theme === 'square' && Math.abs(x) + Math.abs(z) < 6.85) return 'center';
  if (spec.theme === 'oldtown' && Math.max(Math.abs(x), Math.abs(z), (Math.abs(x) + Math.abs(z)) / Math.SQRT2) < 4.35) return 'center';
  if (spec.theme === 'coast') return `band:${Math.floor((z - Math.abs(x) * .72) / 5.76)}`;
  let px = spec.theme === 'square' || spec.theme === 'oldtown' ? 7.68 : 6.4;
  let pz = spec.theme === 'oldtown' ? 7.68 : spec.theme === 'park' ? 6.24 : 5.76;
  let ox = px / 2, oz = pz / 2;
  // Plaza/garden panels lie BETWEEN dark grid lines, unlike centered octagonal medallions.
  if (spec.theme === 'square' || spec.theme === 'park') { ox = 0; oz = 0; }
  if (spec.theme === 'street') {
    const nx = Math.max(1, Math.round((spec.cols * CELL_X - 2.5) / 6.4));
    const nz = Math.max(1, Math.round((spec.rows * CELL_Z - 2.5) / 5.76));
    px = (spec.cols * CELL_X - 2.5) / nx; pz = (spec.rows * CELL_Z - 2.5) / nz;
    ox = nx % 2 ? px / 2 : 0; oz = nz % 2 ? pz / 2 : 0;
  }
  return `${Math.floor((x + ox) / px)}:${Math.floor((z + oz) / pz)}`;
}
export class MotifTracker {
  private groupFor: Int16Array;
  private seen: Uint8Array;
  private remaining: number[] = [];
  private sizes: number[] = [];
  private names: string[] = [];
  completed = 0;
  readonly total: number;
  constructor(grid: PavingGrid) {
    this.groupFor = new Int16Array(grid.cells.length).fill(-1); this.seen = grid.cells.slice();
    const groups = new Map<string, number>();
    for (let id = 0; id < grid.cells.length; id++) if (grid.valid[id]) {
      const key = panelKey(grid.spec, id);
      let g = groups.get(key);
      if (g === undefined) { g = groups.size; groups.set(key, g); this.remaining[g] = this.sizes[g] = 0; this.names[g] = key; }
      this.groupFor[id] = g; this.sizes[g]!++; if (!grid.cells[id]) this.remaining[g]!++;
    }
    this.total = this.sizes.filter(n => n >= 48).length;
    for (let g = 0; g < this.sizes.length; g++) if (this.sizes[g]! >= 48 && this.remaining[g] === 0) this.completed++;
  }
  placed(indices: readonly number[]): string[] {
    const completed: string[] = [];
    for (const id of indices) {
      if (!Number.isInteger(id) || id < 0 || id >= this.seen.length || this.seen[id]) continue;
      const group = this.groupFor[id]!; if (group < 0) continue;
      this.seen[id] = 1;
      if (--this.remaining[group]! === 0 && this.sizes[group]! >= 48) { this.completed++; completed.push(this.names[group]!); }
    }
    return completed;
  }
}
