import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CELL_X, CELL_Z, PATCH } from '../game/content';
import type { GameSession } from '../game/session';
import { Materials, rng } from './materials';
import { StoneField } from './stone-field';
import { supplyPoints } from '../game/site-services';
import { landingMotion, landingHeight, type LandingMotion } from './placement-motion';
import { siteSurface } from './site-surface';
import { PlacementPreview } from './placement-preview';
import { box, cylinder, pallet, cone, barrier, tree, bench, lamp, cart, building, machine, paverPieces, disposeGeometry } from './models';
import type { Solid } from './player';
/** Static prop geometries are baked into material batches; paving remains independently instanced. */
function batch(root: T.Group): T.Group {
  root.updateMatrixWorld(true);
  const buckets = new Map<T.Material, T.BufferGeometry[]>(), original = new Set<T.BufferGeometry>();
  root.traverse(o => {
    if (!(o instanceof T.Mesh) || o instanceof T.InstancedMesh || Array.isArray(o.material)) return;
    const copy = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); copy.applyMatrix4(o.matrixWorld); copy.clearGroups();
    const entries = buckets.get(o.material) ?? []; entries.push(copy); buckets.set(o.material, entries); original.add(o.geometry);
  });
  const result = new T.Group();
  for (const [material, geometries] of buckets) {
    const merged = mergeGeometries(geometries, false);
    if (!merged) throw new Error('Procedural geometry batch failed');
    const mesh = new T.Mesh(merged, material); mesh.castShadow = true; mesh.receiveShadow = true; result.add(mesh);
    for (const g of geometries) g.dispose();
  }
  for (const g of original) g.dispose();
  return result;
}
export class WorldView {
  readonly group = new T.Group();
  reducedMotion = false;
  readonly solids: Solid[] = [];
  private supply: T.Vector3[] = [];
  private stones: StoneField;
  private animating = new Map<number, LandingMotion>();
  private hintIndex = -1;
  private preview: PlacementPreview;
  private hint = new T.Group();
  private finishMesh: T.InstancedMesh;
  private finishApplied: Uint8Array;
  private ownedMaterials: T.Material[] = [];
  private ownedTextures: T.Texture[] = [];
  private scratch = new T.Object3D();
  private parked: T.Group;
  private dust: T.Points;
  private dustPositions = new Float32Array(96 * 3);
  private dustLives = new Float32Array(96);
  private dustNext = 0;
  private random: () => number;
  constructor(private session: GameSession, private materials: Materials) {
    const g = session.grid, spec = g.spec, m = materials, staticRoot = new T.Group(); this.random = rng(spec.seed);
    const floor = this.tiled('asphalt', (g.width + 28) / 4, (g.depth + 28) / 4);
    box(staticRoot, floor, g.width + 28, .15, g.depth + 28, 0, -.14);
    if (spec.layout) siteSurface(staticRoot, g, m);
    else {
    // A few millimetres of sand, then the kerb. The outer pavers are cut to this line.
    const joint = .003, half = .13, sand = .02;
    box(staticRoot, this.tiled('sand', (g.width + sand * 2) / 1.7, (g.depth + sand * 2) / 1.7), g.width + sand * 2, .035, g.depth + sand * 2, 0, -.016);
    for (const x of [-g.width / 2 - joint - half, g.width / 2 + joint + half]) for (let z = -g.depth / 2 - joint - half; z < g.depth / 2 + joint + half; z += 1.02) box(staticRoot, m.get('stone'), .26, .16, 1, x, .04, z + .5, .015);
    for (const z of [-g.depth / 2 - joint -half, g.depth / 2 + joint + half]) for (let x = -g.width / 2 - joint - half; x < g.width / 2 + joint + half; x += 1.02) box(staticRoot, m.get('stone'), 1, .16, .26, x + .5, .04, z, .015);
    }
    for (let x = -g.width / 2 + 1; x < g.width / 2; x += 3) for (const z of [-g.depth / 2 - 2.5, g.depth / 2 + 2.5]) box(staticRoot, m.get('white'), 1.2, .01, .09, x, -.052, z);
    const guidelines: number[] = [];
    for (let x = 0; x <= spec.cols; x += PATCH) { const xx = x * CELL_X - g.width / 2; guidelines.push(xx, .007, -g.depth / 2, xx, .007, g.depth / 2); }
    for (let z = 0; z <= spec.rows; z += PATCH) { const zz = z * CELL_Z - g.depth / 2; guidelines.push(-g.width / 2, .007, zz, g.width / 2, .007, zz); }
    const lineGeo = new T.BufferGeometry(); lineGeo.setAttribute('position', new T.Float32BufferAttribute(guidelines, 3));
    const lineMat = new T.LineBasicMaterial({ color: '#86765e', transparent: true, opacity: .24 }); this.ownedMaterials.push(lineMat); this.group.add(new T.LineSegments(lineGeo, lineMat));
    for (const hole of g.holes()) {
      const x = (hole.x + hole.w / 2) * CELL_X - g.width / 2, z = (hole.z + hole.h / 2) * CELL_Z - g.depth / 2;
      const w = hole.w * CELL_X, d = hole.h * CELL_Z;
      const pw = Math.max(.8, w - CELL_X - .08), pd = Math.max(.8, d - .16);
      box(staticRoot, m.get('stone'), pw, .26, pd, x, .13, z, .035); box(staticRoot, m.get('soil'), pw - .18, .05, pd - .18, x, .28, z);
      this.solids.push({ x, y: .2, z, hx: w / 2, hy: .2, hz: d / 2 });
      if (spec.theme === 'park') { const t = tree(m, spec.seed + hole.x, 5.8); t.position.set(x, .28, z); staticRoot.add(t); }
      else { cylinder(staticRoot, m.get('stone'), .8, .42, x, .5, z, .9, 16); cylinder(staticRoot, m.get('water'), .73, .025, x, .73, z, .73, 24); cylinder(staticRoot, m.get('stone'), .16, 1.4, x, 1.05, z, .09); cylinder(staticRoot, m.get('stone'), .48, .12, x, 1.7, z, .55, 16); }
    }
    const addProp = (o: T.Group, x: number, z: number, yaw = 0) => { o.position.set(x, 0, z); o.rotation.y = yaw; staticRoot.add(o); };
    for (const side of [-1, 1]) {
      for (let x = -g.width / 2 + 2; x <= g.width / 2 - 1; x += 6.3) {
        const h = 4.7 + this.random() * 3.2;
        addProp(building(m, spec.seed + Math.floor((x + g.width) * 9) + side, 5.8, h, 4.2), x, side * (g.depth / 2 + 6), side > 0 ? Math.PI : 0);
      }
      for (let z = -g.depth / 2 + 4; z < g.depth / 2 - 2; z += 8.5) {
        if (!(spec.theme === 'coast' && side > 0)) addProp(building(m, spec.seed + Math.floor((z + g.depth) * 7) + side, 6.2, 5 + this.random() * 2, 4), side * (g.width / 2 + 6.2), z, side > 0 ? -Math.PI / 2 : Math.PI / 2);
        addProp(lamp(m), side * (g.width / 2 + .75), z + 2.5, side > 0 ? Math.PI / 2 : -Math.PI / 2);
        if (side > 0) { addProp(bench(m), g.width / 2 + 1.6, z, -Math.PI / 2); addProp(tree(m, spec.seed + Math.floor(z + 200)), g.width / 2 + 3, z + 3.5); }
      }
    }
    for (const { x, z } of supplyPoints(spec)) { this.supply.push(new T.Vector3(x, 0, z)); addProp(pallet(m), x, z); addProp(pallet(m), x, z + 1.35);
      this.solids.push({ x, y: .42, z: z + .6, hx: .63, hy: .42, hz: 1.2 });
    }
    addProp(cart(m), -g.width / 2 - 2.8, -g.depth / 2 + 4);
    for (const x of [-g.width / 2 + .6, g.width / 2 - .6]) for (const z of [-g.depth / 2 - .7, g.depth / 2 + .7]) addProp(cone(m), x, z);
    addProp(barrier(m), 0, -g.depth / 2 - 1.4); addProp(barrier(m), 0, g.depth / 2 + 1.4, Math.PI);
    const sign = new T.Group(); for (const x of [-.65, .65]) box(sign, m.get('wood'), .07, 1.9, .07, x, .95); box(sign, m.label('KALDIRIM'), 1.65, .5, .07, 0, 1.65); addProp(sign, -g.width / 2 + 3.5, -g.depth / 2 - 1.5);
    if (spec.theme === 'coast') {
      box(staticRoot, this.tiled('water', 8, 16), 50, .1, g.depth + 100, g.width / 2 + 32, -.45, 0);
      for (let z = -g.depth / 2 - 3; z < g.depth / 2 + 3; z += 1.8) { cylinder(staticRoot, m.get('metal'), .04, 1.1, g.width / 2 + 5, .45, z); box(staticRoot, m.get('metal'), .05, .05, 1.8, g.width / 2 + 5, 1, z + .9); }
    }
    this.group.add(batch(staticRoot));
    this.parked = machine(m); this.parked.position.set(g.width / 2 + 2, 0, -g.depth / 2 + 4.5); this.parked.rotation.y = Math.PI / 2; this.group.add(this.parked);
    this.stones = new StoneField(spec, m.get('stone')); this.group.add(this.stones);
    this.preview = new PlacementPreview(session); this.group.add(this.preview);
    const finishMat = new T.MeshBasicMaterial({ color: '#e8d7a5', transparent: true, opacity: .055, depthWrite: false }); this.ownedMaterials.push(finishMat);
    this.finishApplied = new Uint8Array(g.compacted.length);
    this.finishMesh = new T.InstancedMesh(new T.PlaneGeometry(1, 1), finishMat, g.compacted.length * PATCH * 2); this.finishMesh.count = 0; this.finishMesh.frustumCulled = false; this.group.add(this.finishMesh);
    const hintMat = new T.MeshBasicMaterial({ color: '#ffe19a', transparent: true, opacity: .85, depthTest: false }); this.ownedMaterials.push(hintMat);
    const ring = new T.Mesh(new T.TorusGeometry(.35, .026, 6, 28), hintMat); ring.rotation.x = -Math.PI / 2; this.hint.add(ring);
    const marker = new T.Mesh(new T.ConeGeometry(.12, .35, 4), hintMat); marker.position.y = .65; marker.rotation.z = Math.PI; this.hint.add(marker); this.hint.visible = false; this.group.add(this.hint);
    const dustGeo = new T.BufferGeometry(); this.dustPositions.fill(-100); dustGeo.setAttribute('position', new T.BufferAttribute(this.dustPositions, 3));
    const dustMat = new T.PointsMaterial({ color: '#cbb99b', size: .038, transparent: true, opacity: .5, depthWrite: false }); this.ownedMaterials.push(dustMat); this.dust = new T.Points(dustGeo, dustMat); this.dust.frustumCulled = false; this.group.add(this.dust);
    const initial = Array.from(g.cells.keys()).filter(i => g.cells[i]); this.placed(initial, false);
    for (let i = 0; i < g.compacted.length; i++) if (g.patchValid[i] && g.compacted[i]) this.updateFinish(i);
  }
  private tiled(name: 'sand' | 'asphalt' | 'water', x: number, y: number): T.MeshStandardMaterial {
    const material = this.materials.get(name).clone();
    if (material.map) { material.map = material.map.clone(); material.map.repeat.set(x, y); material.map.needsUpdate = true; this.ownedTextures.push(material.map); }
    if (material.bumpMap) { material.bumpMap = material.bumpMap.clone(); material.bumpMap.repeat.set(x, y); material.bumpMap.needsUpdate = true; this.ownedTextures.push(material.bumpMap); }
    this.ownedMaterials.push(material); return material;
  }
  nearSupply(p: { x: number; z: number }): boolean { return this.supply.some(s => Math.hypot(p.x - s.x, p.z - s.z) < 3.3); }
  placed(indices: readonly number[], animate = true): void {
    animate = animate && !this.reducedMotion;
    for (let n = 0; n < indices.length; n++) {
      const i = indices[n]!, motion = landingMotion(this.session.selectedTool, n, indices.length);
      if (!this.stones.addStone(i, animate ? landingHeight(motion) : .012)) continue;
      const p = this.stoneAt(i);
      if (animate) { this.animating.set(i, motion); for (let k = 0; k < 2; k++) { const n = this.dustNext++ % 96; this.dustPositions[n * 3] = p.x + (this.random() - .5) * .3; this.dustPositions[n * 3 + 1] = .12; this.dustPositions[n * 3 + 2] = p.z + (this.random() - .5) * .2; this.dustLives[n] = .4 + this.random() * .2; } }
    }
  }
  updateFinish(patch: number): void {
    const g = this.session.grid;
    if (!g.patchValid[patch] || this.finishApplied[patch]) return;
    this.finishApplied[patch] = 1;
    const x0 = patch % g.patchCols * PATCH, z0 = Math.floor(patch / g.patchCols) * PATCH;
    // Clip sheen to the path. A finish pass must not paint the adjacent garden or road.
    for (let z = z0; z < Math.min(g.spec.rows, z0 + PATCH); z++) for (let x = x0; x < Math.min(g.spec.cols, x0 + PATCH);) {
      if (!g.valid[g.index(x, z)]) { x++; continue; }
      const first = x; while (x < Math.min(g.spec.cols, x0 + PATCH) && g.valid[g.index(x, z)]) x++;
      this.scratch.position.set((first + (x - first) / 2) * CELL_X - g.width / 2, .09, (z + .5) * CELL_Z - g.depth / 2);
      this.scratch.rotation.set(-Math.PI / 2, 0, 0); this.scratch.scale.set((x - first) * CELL_X - .009, CELL_Z - .003, 1); this.scratch.updateMatrix();
      this.finishMesh.setMatrixAt(this.finishMesh.count++, this.scratch.matrix);
    }
    this.finishMesh.instanceMatrix.needsUpdate = true;
  }
  setTarget(index: number, reachable: boolean, rotated: boolean): void { this.preview.setTarget(reachable ? index : -1, reachable, rotated); }
  private stoneAt(index: number): { x: number; z: number } {
    const spec = this.session.grid.spec, piece = paverPieces(index % spec.cols, Math.floor(index / spec.cols), spec.cols, spec.rows, spec.layout ? this.session.grid.valid : undefined)[0]!;
    return { x: piece.x, z: piece.z };
  }
  showHint(index: number): void { this.hintIndex = index; this.hint.visible = index >= 0; if (index >= 0) { const p = this.stoneAt(index); this.hint.position.set(p.x, .15, p.z); } }
  update(dt: number, time: number, position: T.Vector3): void {
    for (const [i, motion] of this.animating) {
      motion.age += dt;
      const settled = this.reducedMotion || motion.age >= motion.delay + motion.duration;
      this.stones.setHeight(i, settled ? .012 : landingHeight(motion));
      if (settled) this.animating.delete(i);
    }
    const g = this.session.grid;
    if (this.hintIndex >= 0 && (this.session.phase === 'complete' ||
        (this.session.phase === 'laying' ? Boolean(g.cells[this.hintIndex]) : Boolean(g.compacted[g.patchAt(this.hintIndex)])))) {
      this.showHint(g.nearestUnfinished(position.x, position.z, this.session.phase === 'finishing'));
    }
    let dirtyDust = false;
    for (let i = 0; i < 96; i++) if (this.dustLives[i]! > 0) { dirtyDust = true; this.dustLives[i] = this.dustLives[i]! - dt; this.dustPositions[i * 3 + 1] = this.dustLives[i]! > 0 ? this.dustPositions[i * 3 + 1]! + dt * .18 : -100; }
    if (dirtyDust) this.dust.geometry.attributes.position!.needsUpdate = true;
    this.dust.visible = !this.reducedMotion;
    if (this.hint.visible) this.hint.children[1]!.position.y = .65 + (this.reducedMotion ? 0 : Math.sin(time * 2) * .06);
    this.parked.visible = this.session.unlockedTools >= 3;
  }
  /** Read-only before/after presentation: never modifies the saved job or its earnings. */
  inspectionBefore(before: boolean): void { this.stones.visible = this.finishMesh.visible = !before; }
  dispose(): void { this.group.removeFromParent(); this.stones.dispose(); this.preview.dispose(); disposeGeometry(this.group); this.finishMesh.dispose(); for (const m of this.ownedMaterials) m.dispose(); for (const t of this.ownedTextures) t.dispose(); }
}
