import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CELL_X, CELL_Z, paverCourseShift } from '../game/content';
import { Materials, type MaterialName, rng } from './materials';
export function mesh(geometry: T.BufferGeometry, material: T.Material, x = 0, y = 0, z = 0): T.Mesh {
  const m = new T.Mesh(geometry, material); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m;
}
export function box(g: T.Group, m: T.Material, w: number, h: number, d: number, x = 0, y = 0, z = 0, bevel = 0): T.Mesh {
  const o = mesh(bevel ? new RoundedBoxGeometry(w, h, d, 1, bevel) : new T.BoxGeometry(w, h, d), m, x, y, z); g.add(o); return o;
}
export function cylinder(g: T.Group, m: T.Material, r: number, h: number, x = 0, y = 0, z = 0, r2 = r, segments = 10): T.Mesh {
  const o = mesh(new T.CylinderGeometry(r2, r, h, segments), m, x, y, z); g.add(o); return o;
}
/** Shape +y becomes world −z. South is the field's −z edge, west its −x edge. */
export interface PaverEdges { west?: boolean; east?: boolean; south?: boolean; north?: boolean }
export function paverKey(edges: PaverEdges = {}): string {
  return `${edges.west ? 'w' : ''}${edges.east ? 'e' : ''}${edges.south ? 's' : ''}${edges.north ? 'n' : ''}` || 'full';
}
export interface PaverPiece { key: string; edges: PaverEdges; x: number; z: number }
/** Visual pieces for one cell. The logical center stays on the grid; edge pieces only close the kerb. */
export function paverPieces(col: number, row: number, cols: number, rows: number, valid?: Uint8Array): PaverPiece[] {
  const id = row * cols + col;
  const south = row === 0 || Boolean(valid && !valid[id - cols]), north = row === rows - 1 || Boolean(valid && !valid[id + cols]), odd = (row & 1) === 1;
  const west = col === 0 || Boolean(valid && !valid[id - 1]), east = col === cols - 1 || Boolean(valid && !valid[id + 1]);
  const z = (row + .5) * CELL_Z - rows * CELL_Z / 2, originX = -cols * CELL_X / 2;
  const main: PaverEdges = {};
  if (south) main.south = true;
  if (north) main.north = true;
  if (odd && east) main.east = true;
  const pieces: PaverPiece[] = [{ key: paverKey(main), edges: main, x: originX + (col + .5) * CELL_X + paverCourseShift(row), z }];
  // An odd course is shifted half a stone, so the kerb side needs the other half or it leaves a 16 cm gap.
  if (odd && west) {
    const filler: PaverEdges = { west: true };
    if (south) filler.south = true;
    if (north) filler.north = true;
    pieces.push({ key: paverKey(filler), edges: filler, x: originX + col * CELL_X, z });
  }
  return pieces;
}
function clipX(points: readonly (readonly [number, number])[], minX: number, maxX: number): [number, number][] {
  const out: [number, number][] = [];
  const inside = (x: number) => x >= minX - 1e-8 && x <= maxX + 1e-8;
  const push = (x: number, y: number) => {
    const last = out[out.length - 1];
    if (last && Math.abs(last[0] - x) < 1e-8 && Math.abs(last[1] - y) < 1e-8) return;
    out.push([x, y]);
  };
  for (let i = 0; i < points.length; i++) {
    const x = points[i]![0], y = points[i]![1];
    if (i > 0) {
      const px = points[i - 1]![0], py = points[i - 1]![1];
      const cuts = [minX, maxX].filter(edge => (px < edge && x > edge) || (px > edge && x < edge));
      cuts.sort((a, b) => Math.abs(a - px) - Math.abs(b - px));
      for (const edge of cuts) push(edge, py + (y - py) * (edge - px) / (x - px));
    }
    if (inside(x)) push(x, y);
  }
  return out;
}
export function paverGeometry(edges: PaverEdges = {}): T.BufferGeometry {
  // Double-T kilit taşı. Heads sit on the outer quarters, the pocket is the middle half.
  // A course shifted by CELL_X / 2 swaps heads and pockets, so each head seats in the pocket beside it.
  // Field edges replace that wave with a straight cut so the outer face sits on the kerb.
  const s = new T.Shape();
  const xL = -CELL_X / 2 + .003, xR = CELL_X / 2 - .003, xH = CELL_X / 4 + .0025;
  const zH = CELL_Z / 2 + .034, zN = CELL_Z / 2 - .039, c = .0035, edgeZ = CELL_Z / 2 - .003;
  const left = edges.west ? .003 : xL, right = edges.east ? -.003 : xR;
  const top: (readonly [number, number])[] = edges.south
    ? [[left, edgeZ], [right, edgeZ]]
    : [[xL, zH - c], [xL + c, zH], [-xH - c, zH], [-xH, zH - c], [-xH, zN + c], [-xH + c, zN], [xH - c, zN], [xH, zN + c], [xH, zH - c], [xH + c, zH], [xR - c, zH], [xR, zH - c]];
  const bottom: (readonly [number, number])[] = edges.north
    ? [[right, -edgeZ], [left, -edgeZ]]
    : [[xR, -zH + c], [xR - c, -zH], [xH + c, -zH], [xH, -zH + c], [xH, -zN - c], [xH - c, -zN], [-xH + c, -zN], [-xH, -zN - c], [-xH, -zH + c], [-xH - c, -zH], [xL + c, -zH], [xL, -zH + c]];
  const points = [...clipX(top, left, right), ...clipX(bottom, left, right)];
  points.forEach(([x, y], i) => i ? s.lineTo(x, y) : s.moveTo(x, y));
  s.closePath();
  const g = new T.ExtrudeGeometry(s, { depth: .046, bevelEnabled: true, bevelThickness: .004, bevelSize: .0012, bevelSegments: 1, steps: 1, curveSegments: 1 });
  g.rotateX(-Math.PI / 2); g.translate(0, .01, 0); return g;
}
export function pallet(m: Materials, loaded = true): T.Group {
  const g = new T.Group();
  for (const x of [-.43, 0, .43]) box(g, m.get('wood'), .16, .16, 1, x, .1);
  for (let i = 0; i < 6; i++) box(g, m.get('wood'), 1.18, .055, .14, 0, .22, -.42 + i * .17);
  if (loaded) {
    const stone = paverGeometry();
    for (let layer = 0; layer < 6; layer++) for (let x = 0; x < 3; x++) for (let z = 0; z < 3; z++) g.add(mesh(stone, m.get('stone'), (x - 1) * CELL_X + (z % 2 ? CELL_X / 2 : 0) - CELL_X / 4, .27 + layer * .072, (z - 1) * CELL_Z));
    for (const x of [-.5, .5]) { box(g, m.get('metal'), .027, .52, .86, x, .5, 0); box(g, m.get('metal'), .031, .012, .9, x, .77, 0); }
  }
  return g;
}
export function cone(m: Materials): T.Group {
  const g = new T.Group(); box(g, m.get('rubber'), .43, .055, .43, 0, .03, 0, .025);
  cylinder(g, m.get('orange'), .155, .5, 0, .3, 0, .036);
  cylinder(g, m.get('white'), .107, .085, 0, .29, 0, .087); return g;
}
export function barrier(m: Materials): T.Group {
  const g = new T.Group();
  for (const x of [-.65, .65]) { box(g, m.get('metal'), .065, .95, .065, x, .49); box(g, m.get('rubber'), .45, .07, .5, x, .035); }
  box(g, m.get('white'), 1.55, .26, .08, 0, .75);
  for (let i = 0; i < 5; i++) { const b = box(g, m.get('orange'), .13, .28, .012, -.58 + i * .29, .75, .05); b.rotation.z = -.35; }
  return g;
}
export function tree(m: Materials, seed: number, height = 5): T.Group {
  const g = new T.Group(), r = rng(seed);
  cylinder(g, m.get('wood'), .2, height * .65, 0, height * .3, 0, .1);
  for (let i = 0; i < 4; i++) {
    const angle = i * Math.PI / 2 + r(), branch = cylinder(g, m.get('wood'), .08, 1.5, Math.sin(angle) * .35, height * .56, Math.cos(angle) * .35, .025);
    branch.rotation.set(Math.cos(angle) * .6, 0, Math.sin(angle) * .6);
  }
  for (let i = 0; i < 7; i++) {
    const angle = i * 2.4, crown = mesh(new T.IcosahedronGeometry(1.2 + r() * .45, 1), m.get('leaf'), Math.cos(angle) * .75, height * .65 + r() * 1.3, Math.sin(angle) * .75);
    crown.scale.set(1, .83 + r() * .3, .9); g.add(crown);
  }
  return g;
}
export function bench(m: Materials): T.Group {
  const g = new T.Group();
  for (const x of [-.68, .68]) { box(g, m.get('metal'), .075, .6, .5, x, .3); box(g, m.get('metal'), .075, .6, .08, x, .72, -.18); }
  for (let i = 0; i < 4; i++) box(g, m.get('wood'), 1.75, .055, .11, 0, .54, -.18 + i * .125, .012);
  for (let i = 0; i < 3; i++) box(g, m.get('wood'), 1.75, .105, .055, 0, .7 + i * .13, -.215, .012);
  return g;
}
export function lamp(m: Materials): T.Group {
  const g = new T.Group(); cylinder(g, m.get('metal'), .16, .18, 0, .09); cylinder(g, m.get('metal'), .06, 3.6, 0, 1.8, 0, .04);
  box(g, m.get('metal'), .7, .06, .07, .28, 3.6); box(g, m.get('metal'), .48, .08, .25, .52, 3.56, 0, .035); box(g, m.get('white'), .38, .02, .18, .52, 3.505);
  return g;
}
export function cart(m: Materials): T.Group {
  const g = new T.Group(); box(g, m.get('green'), 1, .13, .75, 0, .45, 0, .025);
  for (const x of [-.5, .5]) box(g, m.get('green'), .06, .25, .75, x, .57);
  for (const x of [-.43, .43]) for (const z of [-.26, .26]) { const w = cylinder(g, m.get('rubber'), .19, .1, x, .2, z); w.rotation.z = Math.PI / 2; }
  for (const x of [-.4, .4]) box(g, m.get('metal'), .04, .6, .04, x, .7, .43);
  box(g, m.get('metal'), .86, .055, .055, 0, 1, .43); return g;
}
export function building(m: Materials, seed: number, w = 5, h = 6, d = 4): T.Group {
  const g = new T.Group(), r = rng(seed), facade: MaterialName = (['cream', 'blue', 'white', 'fabric'] as const)[Math.floor(r() * 4)]!;
  box(g, m.get(facade), w, h, d, 0, h / 2);
  box(g, m.get('stone'), w + .08, .45, d + .08, 0, .225);
  for (let floor = 1; floor <= Math.floor(h / 2.6); floor++) box(g, m.get('white'), w + .14, .12, d + .14, 0, floor * 2.5);
  for (const x of [-w / 2 + .12, w / 2 - .12]) box(g, m.get('white'), .16, h, .07, x, h / 2, d / 2 + .04);
  const roofShape = new T.Shape(); roofShape.moveTo(-w / 2 - .25, 0); roofShape.lineTo(0, 1.45); roofShape.lineTo(w / 2 + .25, 0); roofShape.closePath();
  const roof = mesh(new T.ExtrudeGeometry(roofShape, { depth: d + .5, bevelEnabled: false }), m.get('terra'), 0, h, -d / 2 - .25); g.add(roof);
  box(g, m.get('terra'), .48, 1.2, .5, w * .28, h + 1);
  const columns = Math.max(2, Math.floor(w / 1.7));
  for (let floor = 0; floor < Math.floor(h / 2.4); floor++) for (let j = 0; j < columns; j++) {
    const x = -w / 2 + (j + .5) * w / columns, y = 1.25 + floor * 2.5;
    box(g, m.get('wood'), 1.03, 1.4, .1, x, y, d / 2 + .08);
    box(g, m.get('glass'), .83, 1.18, .035, x, y, d / 2 + .15);
    box(g, m.get('white'), .055, 1.22, .025, x, y, d / 2 + .18); box(g, m.get('white'), .88, .055, .025, x, y, d / 2 + .18);
    box(g, m.get('white'), 1.14, .09, .3, x, y - .72, d / 2 + .13);
    for (const side of [-1, 1]) {
      box(g, m.get('green'), .28, 1.35, .08, x + side * .68, y, d / 2 + .08);
      for (let k = 0; k < 6; k++) box(g, m.get('wood'), .235, .035, .095, x + side * .68, y - .5 + k * .2, d / 2 + .1);
    }
    if (floor > 0 && j === 0) { box(g, m.get('terra'), .95, .18, .3, x, y - .63, d / 2 + .3); for (let n = 0; n < 3; n++) g.add(mesh(new T.IcosahedronGeometry(.16, 0), m.get('leaf'), x + (n - 1) * .26, y - .46, d / 2 + .3)); }
  }
  if (seed % 2 === 0) {
    box(g, m.get('wood'), 1.05, 2, .12, 0, 1, d / 2 + .2);
    box(g, m.get('glass'), .8, 1.4, .04, 0, 1.25, d / 2 + .28);
    const awning = new T.Group(); for (let i = 0; i < 10; i++) box(awning, m.get(i % 2 ? 'white' : 'green'), .3, .055, 1.1, (i - 4.5) * .3, 0, .4); awning.rotation.x = .15; awning.position.set(0, 2.55, d / 2); g.add(awning);
    box(g, m.label(seed % 4 === 0 ? 'MAHALLE FIRINI' : 'KÖŞE BAKKALI'), 2.8, .58, .06, 0, 3.05, d / 2 + .06);
  }
  return g;
}
export function machine(m: Materials): T.Group {
  const g = new T.Group();
  for (const x of [-.78, .78]) {
    box(g, m.get('rubber'), .42, .43, 2.1, x, .3, 0, .13);
    for (let i = 0; i < 5; i++) { const w = cylinder(g, m.get('metal'), .19, .43, x, .31, -.75 + i * .38); w.rotation.z = Math.PI / 2; }
  }
  box(g, m.get('orange'), 1.65, .55, 1.7, 0, .72, .1, .07);
  box(g, m.get('green'), 1.4, .58, .9, 0, 1.26, .32, .04);
  for (const x of [-.56, .56]) box(g, m.get('metal'), .07, 1.55, .07, x, 1.5, .62);
  box(g, m.get('orange'), 1.45, .08, 1.1, 0, 2.25, .3, .03);
  box(g, m.get('rubber'), .65, .16, .58, 0, 1.3, .38, .04); box(g, m.get('rubber'), .65, .52, .12, 0, 1.53, .62, .04);
  for (const x of [-.58, .58]) { const arm = box(g, m.get('orange'), .14, 1.3, .18, x, 1.26, -.62); arm.rotation.x = -.55; cylinder(g, m.get('metal'), .035, 1, x, 1.2, -.7); }
  box(g, m.get('metal'), 2.15, .13, 1.45, 0, .52, -1.65);
  for (const x of [-.95, .95]) box(g, m.get('orange'), .08, .25, 1.4, x, .37, -1.65);
  box(g, m.label('K-48', '#d69737', '#253d32'), .8, .24, .025, 0, .8, -.762);
  for (const x of [-.54, .54]) box(g, m.get('white'), .2, .12, .035, x, .78, -.78, .02);
  return g;
}
export function handheld(m: Materials, tier: number, finishing = false): T.Group {
  const g = new T.Group();
  if (finishing) {
    box(g, m.get('metal'), .64, .1, .52, 0, -.25, -.12, .04); box(g, m.get('orange'), .37, .24, .35, 0, -.1, -.08, .04);
    for (const x of [-.23, .23]) { const handle = cylinder(g, m.get('metal'), .024, .7, x, .15, .12); handle.rotation.x = -.4; }
    const grip = cylinder(g, m.get('rubber'), .038, .5, 0, .45, .25); grip.rotation.z = Math.PI / 2;
    return g;
  }
  if (tier === 0) {
    const p = mesh(paverGeometry(), m.get('stone'), .06, .04, -.15); p.scale.setScalar(1.5); p.rotation.set(.08, .15, 0); g.add(p);
    for (const x of [-.2, .28]) {
      box(g, m.get('fabric'), .16, .16, .38, x, -.13, .22, .04);
      box(g, m.get('skin'), .14, .1, .22, x, -.03, .005, .04);
      for (let i = 0; i < 4; i++) box(g, m.get('skin'), .025, .055, .11, x - .048 + i * .031, -.018, -.095, .01);
    }
    const mallet = new T.Group(); cylinder(mallet, m.get('wood'), .025, .44, 0, .1); box(mallet, m.get('rubber'), .2, .11, .1, 0, .34, 0, .02); mallet.rotation.z = -.5; mallet.position.set(.45, .03, .15); g.add(mallet);
  } else {
    const width = tier === 1 ? .7 : tier === 2 ? 1 : 1.25;
    box(g, m.get('orange'), width, .11, .46, 0, 0, -.2, .025);
    for (const x of [-width / 2 + .07, width / 2 - .07]) { box(g, m.get('metal'), .065, .35, .46, x, -.14, -.2); const h = cylinder(g, m.get('metal'), .025, .55, x, .22, .05); h.rotation.x = -.35; }
    const grip = cylinder(g, m.get('rubber'), .04, width * .85, 0, .5, .15); grip.rotation.z = Math.PI / 2;
    for (let i = 0; i < (tier === 1 ? 2 : 3); i++) g.add(mesh(paverGeometry(), m.get('stone'), (i - (tier === 1 ? .5 : 1)) * CELL_X, -.2, -.2));
    if (tier === 3) { box(g, m.get('green'), .43, .24, .18, 0, .15, .09, .015); box(g, m.label('K-48'), .31, .12, .015, 0, .19, .19); }
  }
  return g;
}
export function disposeGeometry(root: T.Object3D): void {
  const seen = new Set<T.BufferGeometry>(); root.traverse(o => { if (o instanceof T.Mesh || o instanceof T.Line || o instanceof T.Points) seen.add(o.geometry); });
  for (const g of seen) g.dispose();
}
