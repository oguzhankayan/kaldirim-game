import { describe, expect, it } from 'vitest';
import { GameSession } from '../src/game/session';
import { workFeedback } from '../src/game/work-feedback';

describe('work feedback without automatic targeting', () => {
  it('describes ready, actual dwell, partial supply, empty supply, refill, done and unreachable states', () => {
    const s = new GameSession(0), target = { valid: true, count: 6 };
    expect(workFeedback(s, target)).toEqual({ state: 'ready', count: 6, progress: 0, partial: false });
    s.workProgress = s.dwell / 2;
    expect(workFeedback(s, target).state).toBe('working');
    expect(workFeedback(s, target).progress).toBe(.5);
    s.cancelWork(); s.inventory = 2;
    expect(workFeedback(s, target)).toEqual({ state: 'partial', count: 2, progress: 0, partial: true });
    s.inventory = 0;
    expect(workFeedback(s, target).state).toBe('blocked');
    s.startRefill(true); s.refillProgress = s.refillDuration / 2;
    expect(workFeedback(s, target)).toEqual({ state: 'refilling', count: 0, progress: .5, partial: false });
    s.refilling = false; s.inventory = 16;
    expect(workFeedback(s, { valid: true, count: 0 }).state).toBe('done');
    expect(workFeedback(s, { valid: false, count: 0 }).state).toBe('idle');
    expect(workFeedback(s, { valid: false, count: 6 }).state).toBe('blocked');
  });

  it('never pays, changes the job, or accumulates dwell during repeated preview reads', () => {
    const s = new GameSession(0), before = s.snapshot();
    for (let i = 0; i < 1000; i++) workFeedback(s, { valid: true, count: 6 });
    expect(s.snapshot()).toEqual(before); expect(s.workProgress).toBe(0);
    s.tick(.05, 0, true, false, true);
    expect(workFeedback(s, { valid: true, count: 1 }).progress).toBeGreaterThan(0);
    s.tick(.05, 1, false, false, true);
    expect(workFeedback(s, { valid: true, count: 1 }).progress).toBe(0);
    expect(s.money).toBe(0);
  });

  it('supports inventory-free final compaction and clamps malformed progress', () => {
    const s = new GameSession(0); s.grid.place(Array.from(s.grid.valid.keys())); s.inventory = 0;
    expect(workFeedback(s, { valid: true, count: 1 }).state).toBe('ready');
    s.workProgress = Infinity;
    expect(workFeedback(s, { valid: true, count: 1 }).progress).toBe(0);
    s.workProgress = s.dwell * 2;
    expect(workFeedback(s, { valid: true, count: 1 }).progress).toBe(1);
    for (let p = 0; p < s.grid.compacted.length; p++) s.grid.compact(p);
    expect(workFeedback(s, { valid: true, count: 1 })).toEqual({ state: 'done', count: 0, progress: 0, partial: false });
  });
});
