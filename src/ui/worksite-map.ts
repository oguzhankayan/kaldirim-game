import { CELL_X, CELL_Z } from '../game/content';
import { PAVER_SWATCHES, patternPlan } from '../game/patterns';
import { supplyPoints } from '../game/site-services';
import type { PavingGrid } from '../game/grid';

export type MapMode = 'progress' | 'plan';
const rgb = PAVER_SWATCHES.map(s => [1, 3, 5].map(i => parseInt(s.map.slice(i, i + 2), 16)));
/** This is a schematic of the same color plan, not a second random pattern generator. */
export function mapPixels(g: PavingGrid, mode: MapMode = 'progress'): Uint8ClampedArray {
  const data = new Uint8ClampedArray(g.cells.length * 4), plan = patternPlan(g.spec);
  const finishing = g.count === g.total && g.compactedCount < g.patchTotal;
  for (let i = 0; i < g.cells.length; i++) {
    const colored = g.valid[i] && (mode === 'plan' || g.cells[i]);
    const color = !g.valid[i] ? [65, 105, 79] : !colored ? [98, 92, 71] : rgb[plan.toneAt(i)]!;
    const shade = colored ? plan.shadeAt(i) * (mode === 'progress' && finishing && !g.compacted[g.patchAt(i)] ? .72 : 1) : 1;
    const j = i * 4;
    data[j] = color[0]! * shade; data[j + 1] = color[1]! * shade; data[j + 2] = color[2]! * shade; data[j + 3] = 255;
  }
  return data;
}
export class WorksiteMap {
  private backing = document.createElement('canvas');
  private grid: PavingGrid | null = null;
  private version = '';
  draw(canvas: HTMLCanvasElement, g: PavingGrid, pose: { x: number; z: number; yaw: number }, large: boolean, mode: MapMode = 'progress'): void {
    const version = mode === 'plan' ? 'plan' : `progress:${g.count}:${g.compactedCount}`;
    if (this.grid !== g || version !== this.version) {
      this.grid = g; this.version = version;
      this.backing.width = g.spec.cols; this.backing.height = g.spec.rows;
      const context = this.backing.getContext('2d')!;
      const image = context.createImageData(g.spec.cols, g.spec.rows);
      image.data.set(mapPixels(g, mode)); context.putImageData(image, 0, 0);
    }
    const scale = large ? 3 : 1, w = Math.round(g.spec.cols * scale * CELL_X / CELL_Z), h = g.spec.rows * scale;
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    const c = canvas.getContext('2d')!;
    c.imageSmoothingEnabled = false;
    c.clearRect(0, 0, w, h); c.drawImage(this.backing, 0, 0, w, h);
    // The same supply positions are used by rendering, refill rules and this schematic.
    c.fillStyle = '#78c8ce';
    const size = large ? 8 : 3;
    for (const p of supplyPoints(g.spec)) c.fillRect(
      Math.max(0, Math.min(w - size, (p.x + g.width / 2) / g.width * w - size / 2)),
      Math.max(0, Math.min(h - size, (p.z + g.depth / 2) / g.depth * h - size / 2)), size, size);
    const x = Math.max(2, Math.min(w - 2, (pose.x + g.width / 2) / g.width * w));
    const z = Math.max(2, Math.min(h - 2, (pose.z + g.depth / 2) / g.depth * h));
    c.fillStyle = '#ffc45c'; c.strokeStyle = '#233b2c'; c.lineWidth = large ? 2 : 1;
    c.beginPath(); c.arc(x, z, large ? 5 : 2.5, 0, Math.PI * 2); c.fill(); c.stroke();
    c.strokeStyle = '#ffc45c'; c.beginPath(); c.moveTo(x, z);
    c.lineTo(x - Math.sin(pose.yaw) * (large ? 16 : 7), z - Math.cos(pose.yaw) * (large ? 16 : 7)); c.stroke();
  }
}
