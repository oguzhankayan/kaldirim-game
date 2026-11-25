import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { GameSession, type Progress } from '../src/game/session';
import { MotifTracker } from '../src/game/motifs';
import { compactorTarget } from '../src/game/compactor';
import { landingHeight, landingMotion } from '../src/render/placement-motion';
import { CompletionView } from '../src/render/completion-view';
import { PlaytestLog } from '../src/game/playtest';
import { decodeSave, encodeSave, DEFAULT_SETTINGS } from '../src/game/save';

describe('craft feedback remains presentation only', () => {
  it('completes each motif once and reconstructs it from existing saves', () => {
    for (let level = 0; level < 5; level++) {
      const s = GameSession.newJob(level), tracker = new MotifTracker(s.grid);
      const ids = Array.from(s.grid.valid.keys()).filter(i => s.grid.valid[i]);
      const before = s.snapshot(), notices = tracker.placed(ids);
      expect(tracker.completed).toBe(tracker.total); expect(notices.length).toBe(tracker.total);
      expect(tracker.placed(ids)).toEqual([]); expect(s.snapshot()).toEqual(before);
      s.grid.place(ids); const restored = new MotifTracker(s.grid);
      expect(restored.completed).toBe(restored.total); expect(restored.placed(ids)).toEqual([]);
    }
  });
  it('has distinct bounded landing rhythms and never moves a stone below the final surface', () => {
    const signatures = new Set<string>();
    for (let tier = 0; tier < 4; tier++) {
      signatures.add(JSON.stringify(landingMotion(tier, 9, 10)));
      for (let n = 0; n < 126; n++) {
        const motion = landingMotion(tier, n, 126); let last = Infinity;
        expect(motion.delay + motion.duration).toBeLessThan(.35);
        for (let i = 0; i <= 60; i++) { motion.age = i / 60; const y = landingHeight(motion); expect(y).toBeGreaterThanOrEqual(.012); expect(y).toBeLessThanOrEqual(last); last = y; }
        expect(last).toBe(.012);
      }
    }
    expect(signatures.size).toBe(4);
  });
  it('has a finite skippable reveal, fixed reduced-motion framing and before/after at the same camera', () => {
    for (const reduced of [false, true]) {
      const view = new CompletionView(), camera = new T.PerspectiveCamera(72, 16 / 9, .1, 240);
      camera.position.set(0, 1.66, 10); view.begin(camera, 50, 40, reduced);
      let before: number[] | undefined, after: number[] | undefined, ended = false;
      for (let frame = 0; frame < 400; frame++) {
        if (view.update(1 / 60, camera)) ended = true;
        if (view.before) before = camera.position.toArray();
        if (view.label === 'after') after = camera.position.toArray();
      }
      expect(ended).toBe(true); expect(view.active).toBe(false); expect(view.before).toBe(false);
      if (!reduced) expect(before).toEqual(after); else expect(before).toBeUndefined();
      view.begin(camera, 50, 40, reduced); view.cancel(); expect(view.active).toBe(false);
    }
  });
  it('uses real reveal time during slow frames without skipping before/after or stalling for physics ticks', () => {
    const view = new CompletionView(), camera = new T.PerspectiveCamera(72, 16 / 9, .1, 240);
    view.begin(camera, 50, 40, false);
    view.update(20, camera); expect(view.label).toBe('lift');
    view.update(20, camera); expect(view.label).toBe('before'); expect(view.before).toBe(true);
    view.update(20, camera); expect(view.label).toBe('after'); expect(view.before).toBe(false);
    expect(view.update(20, camera)).toBe(true);
    view.begin(camera, 50, 40, true); view.update(0, camera);
    expect(view.update(2.21, camera)).toBe(true);
  });
  it('keeps diagnostics local, bounded and independent of saved gameplay', () => {
    const s = GameSession.newJob(0), before = s.snapshot(), log = new PlaytestLog();
    for (let i = 0; i < 400; i++) log.record('test', s);
    expect(log.report()).toHaveLength(256); expect(s.snapshot()).toEqual(before);
  });
});

describe('continuous final pass', () => {
  it('is driven by a near-player contact and never a remote crosshair', () => {
    const s = GameSession.newJob(0), g = s.grid;
    const x = -g.width / 2 + 1, z = -g.depth / 2 + 1;
    const id = compactorTarget(g, x, z, 0), center = g.center(id);
    expect(g.valid[id]).toBe(1); expect(Math.hypot(center.x - x, center.z - z)).toBeLessThan(1.1);
    expect(compactorTarget(g, 999, 999, 0)).toBe(-1); expect(compactorTarget(g, NaN, z, 0)).toBe(-1);
  });
  it('carries the running pass over neighboring patches, never pays twice, and stops on release', () => {
    const s = GameSession.newJob(0); s.grid.place(Array.from(s.grid.valid.keys()).filter(i => s.grid.valid[i]));
    s.money = 123; const inventory = s.inventory;
    s.tick(.05, 9, true, false, true); s.tick(.05, 9, true, false, true);
    s.tick(.05, 10, true, false, true); s.tick(.05, 10, true, false, true);
    expect(s.grid.compacted[s.grid.patchAt(10)]).toBe(1);
    expect(s.grid.compacted[s.grid.patchAt(9)]).toBe(0);
    expect(s.money).toBe(123); expect(s.inventory).toBe(inventory);
    s.tick(.05, 20, true, false, true); s.tick(.05, 20, false, false, true);
    expect(s.workProgress).toBe(0);
  });
});

it('finishes all revised jobs with only earned income and preserves revision-specific records', () => {
  const progress: Progress = { unlocked: 0, completed: [], achievements: [], bestTimes: { sahil: 500 }, totalStones: 0 };
  const report: { job: string; stones: number; clampAt: number; rowAt: number; machineAt: number; simulationSeconds: number }[] = [];
  for (let level = 0; level < 5; level++) {
    const s = GameSession.newJob(level, progress), timings = [0, 0, 0]; let cursor = 0, actions = 0;
    while (s.phase === 'laying') {
      if (s.unlockedTools < 3 && s.money >= s.toolPrice(s.unlockedTools + 1)) {
        const tier = s.unlockedTools + 1; expect(s.buyTool(tier)).toBe(true); timings[tier - 1] = +(s.grid.count / s.grid.total).toFixed(4);
      }
      if (s.unlockedTools >= 1 && !s.upgrades.logistics) s.buyUpgrade('logistics');
      if (s.unlockedTools >= 2 && !s.upgrades.capacity) s.buyUpgrade('capacity');
      if (s.unlockedTools === 3) { s.buyUpgrade('speed'); s.buyUpgrade('precision'); s.buyUpgrade('capacity'); }
      if (s.inventory === 0) { expect(s.startRefill(true)).toBe(true); while (s.refilling) s.tick(.05, -1, false, false, false); }
      while (cursor < s.grid.cells.length && (s.grid.cells[cursor] || !s.grid.valid[cursor])) cursor++;
      const before = s.grid.count;
      for (let i = 0; i < 30 && s.grid.count === before; i++) s.tick(.05, cursor, true, false, true);
      expect(s.grid.count).toBeGreaterThan(before); if (++actions > s.grid.total) throw new Error('Stalled');
    }
    for (let patch = 0; patch < s.grid.compacted.length; patch++) if (s.grid.patchValid[patch]) {
      const id = s.grid.valid.findIndex((v, i) => v === 1 && s.grid.patchAt(i) === patch);
      while (!s.grid.compacted[patch]) s.tick(.05, id, true, false, true);
    }
    expect(s.phase).toBe('complete'); expect(s.unlockedTools).toBe(3);
    expect(timings[2]).toBeGreaterThan(.39); expect(timings[2]).toBeLessThan(.46);
    const encoded = encodeSave({ version: 1, session: s.snapshot(), progress, settings: DEFAULT_SETTINGS, pose: { x: 0, z: 0, yaw: 0, pitch: -.8 } });
    expect(decodeSave(encoded)).not.toBeNull(); expect(progress.bestTimes.sahil).toBe(500);
    report.push({ job: s.grid.spec.id, stones: s.grid.total, clampAt: timings[0]!, rowAt: timings[1]!, machineAt: timings[2]!, simulationSeconds: Math.round(s.seconds) });
  }
  console.table(report); // Excludes travel, menus, aiming and human reaction time.
  expect(progress.achievements).toContain('master');
}, 60000);
