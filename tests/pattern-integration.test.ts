import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { LEVELS } from '../src/game/content';
import { PAVER_SWATCHES, patternPlan } from '../src/game/patterns';
import { GameSession } from '../src/game/session';
import { DEFAULT_SETTINGS, decodeSave, encodeSave } from '../src/game/save';
import { StoneField, stoneColor } from '../src/render/stone-field';
import { PlacementPreview } from '../src/render/placement-preview';
import { previewColor } from '../src/render/paver-color';
import { paverPieces } from '../src/render/models';
import { mapPixels } from '../src/ui/worksite-map';

const pixel = (data: Uint8ClampedArray, index: number) => Array.from(data.slice(index * 4, index * 4 + 4));
const meshes = (root: T.Object3D) => root.children.filter((m): m is T.InstancedMesh => m instanceof T.InstancedMesh);

describe('pattern integration with actual saves and rendering', () => {
  it('recolors legacy-format saves without changing money, tools, inventory or stone IDs', () => {
    const s = new GameSession(0);
    const ids = Array.from({ length: 300 }, (_, i) => i * 7);
    s.grid.place(ids); s.money = s.grid.count * s.grid.spec.pay; s.progress.totalStones = s.grid.count;
    s.buyTool(1);
    const snapshot = s.snapshot();
    const saved = decodeSave(encodeSave({ version: 1, session: snapshot, progress: s.progress,
      settings: DEFAULT_SETTINGS, pose: { x: 0, z: 0, yaw: 0, pitch: -.9 } }));
    expect(saved).not.toBeNull();
    const restored = GameSession.restore(saved!.session, saved!.progress)!;
    expect(restored.snapshot()).toEqual(snapshot);
    const before = mapPixels(s.grid), after = mapPixels(restored.grid);
    expect(after).toEqual(before);
    for (const id of ids) expect(stoneColor(s.grid.spec, id).toArray()).toEqual(stoneColor(restored.grid.spec, id).toArray());
  });
  it('uses one shared material for all four pigments in every completed job', () => {
    const material = new T.MeshBasicMaterial();
    try {
      for (const spec of LEVELS) {
        const s = new GameSession(LEVELS.indexOf(spec)), field = new StoneField(spec, material);
        try {
          const expectedChunks = new Set<string>(), seenTones = new Set<number>();
          for (let id = 0; id < s.grid.cells.length; id++) if (s.grid.valid[id]) {
            const col = id % spec.cols, row = Math.floor(id / spec.cols);
            for (const p of paverPieces(col, row, spec.cols, spec.rows)) expectedChunks.add(`${Math.floor(col / 16)}:${Math.floor(row / 16)}:${p.key}`);
            seenTones.add(patternPlan(spec).toneAt(id)); field.addStone(id, .012);
          }
          expect(seenTones.size).toBe(4); expect(field.count).toBe(s.grid.total);
          expect(field.children).toHaveLength(expectedChunks.size);
          expect(new Set(meshes(field).map(m => m.material))).toEqual(new Set([material]));
          for (const m of meshes(field)) expect(m.instanceColor).not.toBeNull();
        } finally { field.dispose(); }
      }
    } finally { material.dispose(); }
  });
  it('shows exact planned pigments on each ghost and does not upload them on idle frames', () => {
    const s = new GameSession(0), p = new PlacementPreview(s), color = new T.Color();
    s.unlockedTools = 3; s.selectTool(3); s.inventory = s.capacity;
    try {
      const id = 1723; p.setTarget(id, true, false);
      const expected = new Map<string, T.Color[]>();
      for (const index of s.target(id, false).indices) for (const piece of paverPieces(index % 100, Math.floor(index / 100), 100, 100)) {
        const list = expected.get(`ghost:${piece.key}`) ?? []; list.push(previewColor(s.grid.spec, index)); expected.set(`ghost:${piece.key}`, list);
      }
      for (const mesh of meshes(p)) for (let i = 0; i < mesh.count; i++) {
        mesh.getColorAt(i, color); const want = expected.get(mesh.name)![i]!;
        expect(color.r).toBeCloseTo(want.r, 6); expect(color.g).toBeCloseTo(want.g, 6); expect(color.b).toBeCloseTo(want.b, 6);
      }
      const versions = meshes(p).map(m => [m.instanceMatrix.version, m.instanceColor!.version]);
      const before = s.snapshot();
      for (let i = 0; i < 1000; i++) p.setTarget(id, true, false);
      expect(meshes(p).map(m => [m.instanceMatrix.version, m.instanceColor!.version])).toEqual(versions);
      expect(s.snapshot()).toEqual(before);
    } finally { p.dispose(); }
  });
  it('keeps plan inspection read-only and masks obstacles in both map modes', () => {
    for (let level = 0; level < LEVELS.length; level++) {
      const s = new GameSession(level), before = s.snapshot(), empty = mapPixels(s.grid), plan = mapPixels(s.grid, 'plan');
      expect(plan).not.toEqual(empty); expect(s.snapshot()).toEqual(before);
      const ids = Array.from(s.grid.valid.keys()).filter(i => s.grid.valid[i]);
      for (let i = 0; i < s.grid.valid.length; i++) if (!s.grid.valid[i]) expect(pixel(plan, i)).toEqual([65, 105, 79, 255]);
      s.grid.place(ids); for (let patch = 0; patch < s.grid.compacted.length; patch++) s.grid.compact(patch);
      expect(mapPixels(s.grid)).toEqual(plan);
      for (const tone of [0, 1, 2, 3]) {
        const id = ids.find(i => patternPlan(s.grid.spec).toneAt(i) === tone)!;
        const rgb = [1, 3, 5].map(n => parseInt(PAVER_SWATCHES[tone]!.map.slice(n, n + 2), 16));
        const want = new Uint8ClampedArray([...rgb.map(v => v * patternPlan(s.grid.spec).shadeAt(id)), 255]);
        expect(pixel(plan, id)).toEqual(Array.from(want));
      }
    }
  });
});
