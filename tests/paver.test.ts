import { describe, it, expect } from 'vitest';
import * as T from 'three';
import { CELL_X, CELL_Z, paverCourseShift } from '../src/game/content';
import { paverGeometry, paverPieces, type PaverEdges } from '../src/render/models';

function overlap(aEdges: PaverEdges, ax: number, az: number, bEdges: PaverEdges, bx: number, bz: number): number {
  const aGeo = paverGeometry(aEdges), bGeo = paverGeometry(bEdges), material = new T.MeshBasicMaterial();
  const a = new T.Mesh(aGeo, material), b = new T.Mesh(bGeo, material);
  a.position.set(ax, 0, az); b.position.set(bx, 0, bz);
  a.updateMatrixWorld(); b.updateMatrixWorld();
  const ray = new T.Raycaster();
  let shared = 0;
  for (let ix = -24; ix <= 48; ix++) for (let iz = -24; iz <= 48; iz++) {
    ray.set(new T.Vector3(ix * .008, 2, iz * .008), new T.Vector3(0, -1, 0));
    if (ray.intersectObject(a)[0] && ray.intersectObject(b)[0]) shared++;
  }
  aGeo.dispose(); bGeo.dispose(); material.dispose();
  return shared;
}

describe('interlocking pavers', () => {
  it('builds a solid double-T', () => {
    const geometry = paverGeometry();
    expect(geometry.getAttribute('position').count).toBeGreaterThan(24);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    expect(box.max.x - box.min.x).toBeGreaterThan(CELL_X * .9);
    expect(box.max.z - box.min.z).toBeGreaterThan(CELL_Z);
    geometry.dispose();
  });
  it('seats the next course in the pockets without occupying the same stone', () => {
    const geometry = paverGeometry();
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    expect(box.max.z).toBeGreaterThan(CELL_Z / 2);
    geometry.dispose();
    expect(overlap({}, 0, 0, {}, paverCourseShift(1), CELL_Z)).toBe(0);
  });
  it('leaves a joint between stones in the same course', () => {
    expect(overlap({}, 0, 0, {}, CELL_X, 0)).toBe(0);
  });
  it('cuts the outer course flat against the kerb and still clears the next course', () => {
    const south = paverGeometry({ south: true });
    south.computeBoundingBox();
    const southBox = south.boundingBox!;
    // Shape +y is world −z, so the south cut must land on min.z, just inside the cell edge.
    expect(southBox.min.z).toBeGreaterThan(-CELL_Z / 2 - .003);
    expect(southBox.min.z).toBeLessThan(-CELL_Z / 2 + .008);
    expect(southBox.max.z).toBeGreaterThan(CELL_Z / 2);
    expect(overlap({ south: true }, 0, 0, {}, CELL_X / 2, CELL_Z)).toBe(0);
    const north = paverGeometry({ north: true });
    north.computeBoundingBox();
    expect(north.boundingBox!.max.z).toBeLessThan(CELL_Z / 2 + .003);
    expect(north.boundingBox!.max.z).toBeGreaterThan(CELL_Z / 2 - .008);
    expect(north.boundingBox!.min.z).toBeLessThan(-CELL_Z / 2);
    south.dispose(); north.dispose();
  });
  it('fills the shifted course up to the kerb without landing on its neighbours', () => {
    const west = paverGeometry({ west: true });
    west.computeBoundingBox();
    const box = west.boundingBox!;
    expect(box.min.x).toBeGreaterThan(-.003);
    expect(box.min.x).toBeLessThan(.006);
    expect(box.max.x - box.min.x).toBeGreaterThan(CELL_X * .4);
    expect(box.max.x - box.min.x).toBeLessThan(CELL_X * .55);
    expect(overlap({ west: true }, 0, 0, {}, CELL_X, 0)).toBe(0);
    expect(overlap({ west: true }, 0, 0, {}, CELL_X / 2, CELL_Z)).toBe(0);
    const odd = paverPieces(0, 1, 10, 4);
    expect(odd).toHaveLength(2);
    expect(odd[1]!.x).toBeCloseTo(-5 * CELL_X, 6);
    expect(odd[0]!.x).toBeCloseTo(-5 * CELL_X + CELL_X, 6);
    expect(paverPieces(0, 0, 10, 4)).toHaveLength(1);
    expect(paverPieces(0, 0, 10, 4)[0]!.edges.south).toBe(true);
    const last = paverPieces(9, 1, 10, 4)[0]!;
    expect(last.edges.east).toBe(true);
    expect(last.x).toBeCloseTo(5 * CELL_X, 6);
    const east = paverGeometry({ east: true });
    east.computeBoundingBox();
    expect(east.boundingBox!.max.x).toBeLessThan(.002);
    expect(east.boundingBox!.max.x).toBeGreaterThan(-.006);
    west.dispose(); east.dispose();
  });
});
