import * as T from 'three';
import { previewColor } from './paver-color';
import { PATCH } from '../game/content';
import type { GameSession } from '../game/session';
import { workFeedback, type WorkState } from '../game/work-feedback';
import { paverGeometry, paverPieces, type PaverEdges } from './models';

const COLORS: Record<WorkState, string> = {
  idle: '#db8174', ready: '#76cdb2', working: '#f1c56c', partial: '#f1c56c',
  blocked: '#db8174', refilling: '#84c7df', done: '#b9c2ba',
};

/** A bounded, cached footprint. It uses the same shifted/cut pieces as the actual stone field. */
export class PlacementPreview extends T.Group {
  private pigment = new T.Color();
  private ghosts = new Map<string, T.InstancedMesh>();
  private material = new T.MeshBasicMaterial({ transparent: true, opacity: .48, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  private lineMaterial = new T.LineBasicMaterial({ transparent: true, opacity: .95, depthWrite: false, toneMapped: false });
  private outlinePositions = new Float32Array(24);
  private outlineGeometry = new T.BufferGeometry();
  private outline: T.LineSegments;
  private scratch = new T.Object3D();
  private bounds = new T.Box3();
  private point = new T.Vector3();
  private key = '';
  private available = 0;
  private lastState: WorkState | null = null;
  private disposed = false;

  constructor(private session: GameSession) {
    super();
    this.name = 'placement-preview';
    this.outlineGeometry.setAttribute('position', new T.BufferAttribute(this.outlinePositions, 3).setUsage(T.DynamicDrawUsage));
    this.outline = new T.LineSegments(this.outlineGeometry, this.lineMaterial);
    this.outline.frustumCulled = false;
    this.outline.renderOrder = 2;
    this.add(this.outline);
    this.visible = false;
  }

  private ghostFor(key: string, edges: PaverEdges): T.InstancedMesh {
    let mesh = this.ghosts.get(key);
    if (!mesh) {
      const geometry = paverGeometry(edges); geometry.computeBoundingBox();
      mesh = new T.InstancedMesh(geometry, this.material, 256);
      mesh.count = 0; mesh.frustumCulled = false; mesh.name = `ghost:${key}`;
      mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
      mesh.setColorAt(0, new T.Color());
      mesh.instanceColor!.setUsage(T.DynamicDrawUsage);
      this.ghosts.set(key, mesh); this.add(mesh);
    }
    return mesh;
  }

  setTarget(index: number, reachable: boolean, rotated: boolean): void {
    if (this.disposed) return;
    const s = this.session, g = s.grid;
    const validIndex = Number.isInteger(index) && index >= 0 && index < g.cells.length && g.valid[index] === 1;
    this.visible = validIndex && s.phase !== 'complete';
    if (!this.visible) { this.key = ''; return; }
    const key = `${index}:${reachable}:${rotated}:${s.phase}:${s.selectedTool}:${s.upgrades.precision}:${g.count}:${g.compactedCount}:${s.inventory}:${s.refilling}`;
    if (key !== this.key) {
      this.key = key; this.available = 0; this.bounds.makeEmpty();
      for (const mesh of this.ghosts.values()) mesh.count = 0;
      const finishing = s.phase === 'finishing';
      let cells: number[] = [];
      if (finishing) {
        const patch = g.patchAt(index);
        const x0 = (patch % g.patchCols) * PATCH, z0 = Math.floor(patch / g.patchCols) * PATCH;
        for (let z = z0; z < z0 + PATCH; z++) for (let x = x0; x < x0 + PATCH; x++) {
          const id = g.index(x, z); if (id >= 0 && g.valid[id]) cells.push(id);
        }
        this.available = g.compacted[patch] ? 0 : 1;
      } else {
        const target = s.target(index, rotated);
        this.available = target.indices.length;
        // Outline the full working footprint even if it is occupied, empty of supply or out of reach.
        const shape = s.shape, w = rotated ? shape.depth : shape.width, h = rotated ? shape.width : shape.depth;
        const x0 = Math.floor((index % g.spec.cols) / w) * w;
        const z0 = Math.floor(Math.floor(index / g.spec.cols) / h) * h;
        for (let z = z0; z < z0 + h; z++) for (let x = x0; x < x0 + w; x++) {
          const id = g.index(x, z); if (id >= 0 && g.valid[id]) cells.push(id);
        }
      }
      let left = finishing ? 0 : reachable && !s.refilling ? s.inventory : 0;
      for (const id of cells) {
        const previewStone = !finishing && !g.cells[id] && left > 0;
        if (previewStone) left--;
        for (const piece of paverPieces(id % g.spec.cols, Math.floor(id / g.spec.cols), g.spec.cols, g.spec.rows, g.spec.layout ? g.valid : undefined)) {
          const mesh = this.ghostFor(piece.key, piece.edges), box = mesh.geometry.boundingBox!;
          this.bounds.expandByPoint(this.point.set(box.min.x + piece.x, .104, box.min.z + piece.z));
          this.bounds.expandByPoint(this.point.set(box.max.x + piece.x, .104, box.max.z + piece.z));
          if (!previewStone) continue;
          this.scratch.position.set(piece.x, .022, piece.z); this.scratch.updateMatrix();
          mesh.setColorAt(mesh.count, previewColor(g.spec, id, this.pigment));
          mesh.setMatrixAt(mesh.count++, this.scratch.matrix);
        }
      }
      this.outline.visible = !this.bounds.isEmpty();
      if (this.outline.visible) {
        const { min, max } = this.bounds, y = .104;
        this.outlinePositions.set([min.x, y, min.z, max.x, y, min.z, max.x, y, min.z, max.x, y, max.z, max.x, y, max.z, min.x, y, max.z, min.x, y, max.z, min.x, y, min.z]);
        this.outlineGeometry.attributes.position!.needsUpdate = true;
      }
      for (const mesh of this.ghosts.values()) if (mesh.count) { mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor!.needsUpdate = true; }
    }
    // Progress changes only appearance, not geometry, instance data or game state.
    const state = workFeedback(s, { valid: reachable, count: this.available }).state;
    if (state !== this.lastState) {
      this.lastState = state;
      this.lineMaterial.color.set(COLORS[state]);
      this.lineMaterial.opacity = state === 'done' ? .4 : .95;
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true; this.removeFromParent();
    for (const mesh of this.ghosts.values()) { mesh.geometry.dispose(); mesh.dispose(); }
    this.ghosts.clear(); this.outlineGeometry.dispose(); this.material.dispose(); this.lineMaterial.dispose(); this.clear();
  }
}
