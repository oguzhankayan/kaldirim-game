import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { GameSession } from '../src/game/session';
import { PlacementPreview } from '../src/render/placement-preview';
import { paverPieces } from '../src/render/models';

const ghosts = (p: PlacementPreview) => p.children.filter((c): c is T.InstancedMesh => c instanceof T.InstancedMesh);
function instances(p: PlacementPreview): string[] {
  const out: string[] = [], matrix = new T.Matrix4(), position = new T.Vector3();
  for (const mesh of ghosts(p)) for (let i = 0; i < mesh.count; i++) {
    mesh.getMatrixAt(i, matrix); position.setFromMatrixPosition(matrix);
    out.push(`${mesh.name}:${position.x.toFixed(4)}:${position.z.toFixed(4)}`);
  }
  return out.sort();
}

describe('readable ground preview', () => {
  it('matches exactly the next placeable shifted and cut pieces for all equipment and rotations', () => {
    const s = new GameSession(1), p = new PlacementPreview(s), spec = s.grid.spec;
    try {
      for (const tier of [0, 1, 2, 3]) for (const rotated of [false, true]) for (const stock of [1, 3, 200]) {
        s.unlockedTools = 3; s.selectTool(tier); s.upgrades.precision = tier >= 2 ? 3 : 0; s.inventory = stock;
        for (const index of [0, spec.cols, spec.cols * 2 - 1, spec.cols * spec.rows - 1, 1700]) {
          const before = s.snapshot();
          p.setTarget(index, true, rotated);
          const expected = s.target(index, rotated).indices.slice(0, stock).flatMap(id =>
            paverPieces(id % spec.cols, Math.floor(id / spec.cols), spec.cols, spec.rows).map(piece =>
              `ghost:${piece.key}:${piece.x.toFixed(4)}:${piece.z.toFixed(4)}`)).sort();
          expect(instances(p)).toEqual(expected);
          expect(s.snapshot()).toEqual(before);
          for (const ghost of ghosts(p)) expect(ghost.count).toBeLessThanOrEqual(256);
        }
      }
    } finally { p.dispose(); }
  });

  it('does not show payable ghost stones while blocked/refilling and hides on invalid target', () => {
    const s = new GameSession(0), p = new PlacementPreview(s);
    try {
      s.selectedTool = 1; s.unlockedTools = 1; s.inventory = 2;
      p.setTarget(102, true, false); expect(instances(p)).toHaveLength(2);
      expect(((p.children.find(c => c instanceof T.LineSegments) as T.LineSegments).material as T.LineBasicMaterial).color.getHexString()).toBe('f1c56c');
      p.setTarget(102, false, false); expect(instances(p)).toHaveLength(0);
      s.inventory = 0; p.setTarget(102, true, false); expect(instances(p)).toHaveLength(0);
      s.startRefill(true); p.setTarget(102, true, false); expect(instances(p)).toHaveLength(0);
      for (const id of [-1, NaN, s.grid.cells.length]) { p.setTarget(id, false, false); expect(p.visible).toBe(false); }
    } finally { p.dispose(); }
  });

  it('caches unchanged geometry and instance uploads while progress colors update', () => {
    const s = new GameSession(0), p = new PlacementPreview(s);
    try {
      p.setTarget(102, true, false);
      const initial = ghosts(p).map(m => [m.id, m.instanceMatrix.version]);
      const outline = p.children.find(c => c instanceof T.LineSegments) as T.LineSegments;
      const version = (outline.geometry.attributes.position as T.BufferAttribute).version;
      s.workProgress = s.dwell / 2;
      for (let i = 0; i < 200; i++) p.setTarget(102, true, false);
      expect(ghosts(p).map(m => [m.id, m.instanceMatrix.version])).toEqual(initial);
      expect((outline.geometry.attributes.position as T.BufferAttribute).version).toBe(version);
      expect(((p.children.find(c => c instanceof T.LineSegments) as T.LineSegments).material as T.LineBasicMaterial).color.getHexString()).toBe('f1c56c');
    } finally { p.dispose(); }
  });

  it('uses an elevated outline, not coplanar duplicate stone faces, for final compaction', () => {
    const s = new GameSession(0), p = new PlacementPreview(s);
    try {
      s.grid.place(Array.from(s.grid.valid.keys())); s.inventory = 0;
      p.setTarget(0, true, false);
      expect(p.visible).toBe(true); expect(instances(p)).toHaveLength(0);
      const outline = p.children.find(c => c instanceof T.LineSegments) as T.LineSegments;
      expect(outline.visible).toBe(true);
      const positions = outline.geometry.attributes.position!;
      for (let i = 0; i < positions.count; i++) expect(positions.getY(i)).toBeCloseTo(.104, 5);
      s.grid.compact(0); p.setTarget(0, true, false);
      expect((outline.material as T.LineBasicMaterial).color.getHexString()).toBe('b9c2ba');
      p.dispose(); p.dispose(); expect(p.children).toHaveLength(0);
    } finally { p.dispose(); }
  });
});
