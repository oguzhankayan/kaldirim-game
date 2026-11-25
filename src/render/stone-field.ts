import * as T from 'three';
import { CELL_X, CELL_Z, type LevelSpec } from '../game/content';
import { paverGeometry, paverPieces, type PaverEdges } from './models';

import { siteMask } from '../game/job-layouts';
import { stoneColor } from './paver-color';
export { stoneColor } from './paver-color';

const CHUNK = 16;

/** Spatially bounded instances: looking at one row does not submit the entire job. */
export class StoneField extends T.Group {
  private chunks = new Map<string, T.InstancedMesh>();
  private slots = new Map<number, { mesh: T.InstancedMesh; slot: number; x: number; z: number }[]>();
  private geometries = new Map<string, T.BufferGeometry>();
  private transform = new T.Matrix4();
  private valid?: Uint8Array;
  constructor(private spec: LevelSpec, private material: T.Material) { super(); if (spec.layout) this.valid = siteMask(spec); }
  get count(): number { return this.slots.size; }
  has(index: number): boolean { return this.slots.has(index); }
  private geometry(key: string, edges: PaverEdges): T.BufferGeometry {
    let geometry = this.geometries.get(key);
    if (!geometry) { geometry = paverGeometry(edges); this.geometries.set(key, geometry); }
    return geometry;
  }
  private chunk(col: number, row: number, key: string, edges: PaverEdges): T.InstancedMesh {
    const cx = Math.floor(col / CHUNK), cz = Math.floor(row / CHUNK), id = `${cx}:${cz}:${key}`;
    let mesh = this.chunks.get(id);
    if (mesh) return mesh;
    const cols = Math.min(CHUNK, this.spec.cols - cx * CHUNK), rows = Math.min(CHUNK, this.spec.rows - cz * CHUNK);
    mesh = new T.InstancedMesh(this.geometry(key, edges), this.material, cols * rows);
    mesh.name = `pavers:${id}`;
    mesh.count = 0;
    mesh.receiveShadow = true;
    // These ground-level stones do not need a second full-scene shadow pass.
    mesh.castShadow = false;
    mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    mesh.setColorAt(0, new T.Color());
    mesh.instanceColor!.setUsage(T.DynamicDrawUsage);
    const x = cx * CHUNK * CELL_X - this.spec.cols * CELL_X / 2;
    const z = cz * CHUNK * CELL_Z - this.spec.rows * CELL_Z / 2;
    // Odd courses and the seating heads hang past the cell rectangle.
    mesh.boundingBox = new T.Box3(new T.Vector3(x - .04, -.02, z - .06), new T.Vector3(x + cols * CELL_X + CELL_X / 2 + .04, .5, z + rows * CELL_Z + .06));
    mesh.boundingSphere = mesh.boundingBox.getBoundingSphere(new T.Sphere());
    this.chunks.set(id, mesh);
    this.add(mesh);
    return mesh;
  }
  addStone(index: number, y: number): boolean {
    if (!Number.isInteger(index) || index < 0 || index >= this.spec.cols * this.spec.rows || this.has(index) || (this.valid && !this.valid[index])) return false;
    const col = index % this.spec.cols, row = Math.floor(index / this.spec.cols);
    const color = stoneColor(this.spec, index);
    const records: { mesh: T.InstancedMesh; slot: number; x: number; z: number }[] = [];
    for (const piece of paverPieces(col, row, this.spec.cols, this.spec.rows, this.valid)) {
      const mesh = this.chunk(col, row, piece.key, piece.edges);
      const slot = mesh.count++;
      records.push({ mesh, slot, x: piece.x, z: piece.z });
      mesh.setColorAt(slot, color);
      mesh.instanceColor!.addUpdateRange(slot * 3, 3);
      mesh.instanceColor!.needsUpdate = true;
    }
    this.slots.set(index, records);
    this.setHeight(index, y);
    return true;
  }
  setHeight(index: number, y: number): void {
    const records = this.slots.get(index);
    if (!records) return;
    for (const record of records) {
      record.mesh.setMatrixAt(record.slot, this.transform.makeTranslation(record.x, y, record.z));
      record.mesh.instanceMatrix.addUpdateRange(record.slot * 16, 16);
      record.mesh.instanceMatrix.needsUpdate = true;
    }
  }
  dispose(): void {
    this.removeFromParent();
    for (const mesh of this.chunks.values()) mesh.dispose();
    for (const geometry of this.geometries.values()) geometry.dispose();
    this.chunks.clear(); this.slots.clear(); this.geometries.clear(); this.clear();
  }
}
