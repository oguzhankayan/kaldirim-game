import { describe, it, expect } from 'vitest';
import * as T from 'three';
import { StoneField, stoneColor } from '../src/render/stone-field';
import { paverPieces } from '../src/render/models';
import { LEVELS, type LevelSpec } from '../src/game/content';

function placedPieces(spec: LevelSpec): { meshes: number; instances: number } {
  const ids = new Set<string>();
  let instances = 0;
  for (let row = 0; row < spec.rows; row++) for (let col = 0; col < spec.cols; col++) {
    const cx = Math.floor(col / 16), cz = Math.floor(row / 16);
    for (const piece of paverPieces(col, row, spec.cols, spec.rows)) { ids.add(`${cx}:${cz}:${piece.key}`); instances++; }
  }
  return { meshes: ids.size, instances };
}

describe('spatial paving renderer', () => {
  it('uses bounded chunks, retains all stones and ignores duplicate updates', () => {
    const field = new StoneField(LEVELS[0]!, new T.MeshBasicMaterial());
    for (let i = 0; i < 10000; i++) field.addStone(i, .012);
    const expected = placedPieces(LEVELS[0]!);
    expect(field.count).toBe(10000);
    expect(field.children).toHaveLength(expected.meshes);
    expect(field.addStone(0, .3)).toBe(false);
    expect(field.addStone(NaN, .3)).toBe(false);
    expect(field.addStone(-1, .3)).toBe(false);
    expect(field.addStone(10000, .3)).toBe(false);
    let total = 0;
    for (const child of field.children) {
      const m = child as T.InstancedMesh;
      total += m.count;
      expect(m.count).toBeLessThanOrEqual(256);
      expect(m.frustumCulled).toBe(true);
      expect(m.boundingSphere!.radius).toBeLessThan(3.5);
      const matrix = new T.Matrix4();
      for (let i = 0; i < m.count; i++) { m.getMatrixAt(i, matrix); expect(m.boundingBox!.containsPoint(new T.Vector3().setFromMatrixPosition(matrix))).toBe(true); }
    }
    expect(total).toBe(expected.instances);
    expect(expected.instances).toBeGreaterThan(10000);
    field.dispose(); expect(field.children).toHaveLength(0);
  });
  it('keeps the same stone color when a job is loaded in a different order', () => {
    const material = new T.MeshBasicMaterial();
    const a = new StoneField(LEVELS[0]!, material), b = new StoneField(LEVELS[0]!, material);
    a.addStone(403, .012); a.addStone(404, .012);
    b.addStone(404, .012); b.addStone(403, .012);
    const x = new T.Color(), y = new T.Color();
    (a.children[0] as T.InstancedMesh).getColorAt(0, x);
    (b.children[0] as T.InstancedMesh).getColorAt(1, y);
    expect(x.toArray()).toEqual(y.toArray());
    expect(x.r).toBeCloseTo(stoneColor(LEVELS[0]!, 403).r, 6);
    a.dispose(); b.dispose(); material.dispose();
  });
});
