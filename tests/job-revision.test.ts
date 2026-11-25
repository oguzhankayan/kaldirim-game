import { describe, expect, it } from 'vitest';
import { LEVELS, TOOLS, UPGRADES } from '../src/game/content';
import { jobSpec, maskRectangles } from '../src/game/job-layouts';
import { GameSession } from '../src/game/session';
import { PavingGrid } from '../src/game/grid';
import { decodeSave, encodeSave, DEFAULT_SETTINGS } from '../src/game/save';

describe('versioned large jobs and pacing', () => {
  it('keeps old in-progress/completed saves on their exact layout and original price list', () => {
    for (let level = 0; level < 5; level++) {
      const legacy = new GameSession(level, { unlocked: 4, completed: [], achievements: [], bestTimes: {}, totalStones: 0 });
      legacy.grid.place([1, 2, 3]); legacy.money = 8;
      const snapshot = legacy.snapshot(); delete snapshot.jobRevision; delete snapshot.noticeMask;
      const data = decodeSave(encodeSave({ version: 1, session: snapshot, progress: legacy.progress, settings: DEFAULT_SETTINGS, pose: { x: 0, z: 0, yaw: 0, pitch: -.8 } }));
      const loaded = GameSession.restore(data!.session, data!.progress)!;
      expect(loaded.jobRevision).toBe(1); expect(loaded.grid.spec).toBe(LEVELS[level]);
      expect(loaded.grid.cells).toEqual(legacy.grid.cells);
      expect(loaded.toolPrice(3)).toBe(10000);
    }
  });
  it('has five increasingly large connected sites with no inaccessible finish patches', () => {
    let lastTotal = 10000;
    for (let level = 0; level < 5; level++) {
      const g = new PavingGrid(jobSpec(level)); expect(g.total).toBeGreaterThan(lastTotal); lastTotal = g.total;
      const first = g.valid.indexOf(1), seen = new Set([first]), todo = [first];
      for (let c = 0; c < todo.length; c++) {
        const id = todo[c]!, x = id % g.spec.cols, z = Math.floor(id / g.spec.cols);
        for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const next = g.index(x + dx!, z + dz!); if (next >= 0 && g.valid[next] && !seen.has(next)) { seen.add(next); todo.push(next); }
        }
      }
      expect(seen.size).toBe(g.total);
      const rects = maskRectangles(g.spec, g.valid);
      expect(rects.reduce((sum, r) => sum + r.w * r.h, 0)).toBe(g.total);
      expect(rects.length).toBeLessThan(80);
      g.place(todo); for (let p = 0; p < g.compacted.length; p++) if (g.patchValid[p]) expect(g.compact(p)).toBe(true);
      expect(g.finished).toBe(true); expect(g.compactedCount).toBe(g.patchTotal);
    }
  });
  it('retains early comfort and spreads full progression through each job', () => {
    for (let level = 0; level < 5; level++) {
      const s = GameSession.newJob(level), gross = s.grid.total * s.grid.spec.pay;
      expect(s.toolPrice(1) / s.grid.spec.pay).toBe(60);
      const tools = TOOLS.reduce((sum, _, i) => sum + s.toolPrice(i), 0);
      expect(tools / gross).toBeCloseTo(.4, 3);
      const all = UPGRADES.reduce((sum, u) => sum + u.costs.reduce((v, _, i) => v + s.upgradePrice(u.id, i)!, 0), tools);
      expect(all / gross).toBeGreaterThan(.8); expect(all / gross).toBeLessThan(.95);
      expect(s.upgradePrice('capacity')).toBe(s.grid.spec.pay * 12);
      expect(s.buyTool(1)).toBe(false); s.money = s.toolPrice(1); expect(s.buyTool(1)).toBe(true);
      expect(s.money).toBe(0); expect(s.claimEquipmentNotice()).toBeNull();
    }
  });
  it('round-trips new masks, prices and notice acknowledgement without replaying or losing progress', () => {
    for (let level = 0; level < 5; level++) {
      const s = GameSession.newJob(level, { unlocked: 4, completed: [], achievements: [], bestTimes: {}, totalStones: 0 });
      const id = s.grid.valid.indexOf(1); s.grid.place([id]); s.money = s.grid.spec.pay;
      const restored = GameSession.restore(s.snapshot(), s.progress)!;
      expect(restored).not.toBeNull(); expect(restored.snapshot()).toEqual(s.snapshot());
      expect(restored.grid.valid).toEqual(s.grid.valid); expect(restored.toolPrice(2)).toBe(s.toolPrice(2));
      expect(GameSession.restore({ ...s.snapshot(), jobRevision: 3 } as never, s.progress)).toBeNull();
    }
  });
});
