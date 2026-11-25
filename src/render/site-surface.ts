import * as T from 'three';
import { CELL_X, CELL_Z } from '../game/content';
import type { PavingGrid } from '../game/grid';
import { maskRectangles } from '../game/job-layouts';
import { Materials } from './materials';
import { box, tree, bench } from './models';

/** World-space UVs and merged static props; no texture is stretched across a whole L-shaped site. */
function surface(root: T.Group, material: T.Material, x: number, z: number, w: number, d: number, y: number, tile: number): void {
  const geometry = new T.PlaneGeometry(w, d); geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position!, uv = geometry.attributes.uv!;
  for (let i = 0; i < positions.count; i++) uv.setXY(i, (positions.getX(i) + x) / tile, (positions.getZ(i) + z) / tile);
  const mesh = new T.Mesh(geometry, material); mesh.position.set(x, y, z); mesh.receiveShadow = true; root.add(mesh);
}
export function siteSurface(root: T.Group, grid: PavingGrid, materials: Materials): void {
  const spec = grid.spec, mask = grid.valid;
  for (const r of maskRectangles(spec, mask)) surface(root, materials.get('sand'),
    (r.x + r.w / 2) * CELL_X - grid.width / 2, (r.z + r.h / 2) * CELL_Z - grid.depth / 2,
    r.w * CELL_X + .002, r.h * CELL_Z + .002, .0015, 1.7);
  const green = spec.layout === 'garden-walks' || spec.layout === 'courtyard';
  for (const r of maskRectangles(spec, mask, 0)) {
    if (r.w < 2 || r.h < 2) continue;
    const x = (r.x + r.w / 2) * CELL_X - grid.width / 2, z = (r.z + r.h / 2) * CELL_Z - grid.depth / 2;
    surface(root, materials.get(green ? 'leaf' : 'asphalt'), x, z, r.w * CELL_X, r.h * CELL_Z, -.012, 2.5);
    // Populate only large landscape pockets, not tiny clipped corners or the fountain island.
    if (green && r.w >= 20 && r.h >= 20) {
      const t = tree(materials, spec.seed + r.x * 19 + r.z, 4.2); t.position.set(x, 0, z); root.add(t);
      const b = bench(materials); b.position.set(x, 0, z - r.h * CELL_Z / 2 + .7); root.add(b);
    }
  }
  // Consolidated perimeter segments follow the actual path, including inner corners.
  const edges = new Map<string, number[]>();
  const put = (key: string, start: number) => { const list = edges.get(key) ?? []; list.push(start); edges.set(key, list); };
  for (let z = 0; z < spec.rows; z++) for (let x = 0; x < spec.cols; x++) if (mask[z * spec.cols + x]) {
    if (x === 0 || !mask[z * spec.cols + x - 1]) put(`v:${x}:-1`, z);
    if (x === spec.cols - 1 || !mask[z * spec.cols + x + 1]) put(`v:${x + 1}:1`, z);
    if (z === 0 || !mask[(z - 1) * spec.cols + x]) put(`h:${z}:-1`, x);
    if (z === spec.rows - 1 || !mask[(z + 1) * spec.cols + x]) put(`h:${z + 1}:1`, x);
  }
  for (const [key, positions] of edges) {
    const [orientation, coordinate, side] = key.split(':'); positions.sort((a, b) => a - b);
    for (let i = 0; i < positions.length;) {
      const first = positions[i]!, start = i; while (++i < positions.length && positions[i] === positions[i - 1]! + 1) {}
      const vertical = orientation === 'v', unit = vertical ? CELL_Z : CELL_X;
      const length = (i - start) * unit, n = Math.ceil(length), width = length / n;
      for (let j = 0; j < n; j++) {
        const along = first * unit + (j + .5) * width, across = Number(coordinate) * (vertical ? CELL_X : CELL_Z) + Number(side) * .103;
        box(root, materials.get('stone'), vertical ? .2 : width - .009, .14, vertical ? width - .009 : .2,
          (vertical ? across : along) - grid.width / 2, .034, (vertical ? along : across) - grid.depth / 2, .008);
      }
    }
  }
}
