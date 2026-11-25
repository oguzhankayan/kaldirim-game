import { it, expect } from 'vitest';
import { LEVELS, TOOLS } from '../src/game/content';
import { GameSession, type Progress } from '../src/game/session';
it('completes the whole campaign with earned money and job-local resets', () => {
  const progress: Progress = { unlocked: 0, completed: [], achievements: [], bestTimes: {}, totalStones: 0 };
  const report: { job: string; stones: number; simulationSeconds: number; cash: number; tool: number; actions: number }[] = [];
  for (let level = 0; level < LEVELS.length; level++) {
    const s = new GameSession(level, progress);
    expect([s.money, s.selectedTool, s.inventory]).toEqual([0, 0, 16]);
    let cursor = 0, actions = 0;
    while (s.phase === 'laying') {
      const next = TOOLS[s.unlockedTools + 1];
      if (next && s.money >= next.cost) s.buyTool(s.unlockedTools + 1);
      if (s.unlockedTools >= 1 && s.upgrades.logistics === 0 && s.money >= 180) s.buyUpgrade('logistics');
      if (s.unlockedTools >= 2 && s.upgrades.capacity === 0 && s.money >= 48) s.buyUpgrade('capacity');
      if (s.unlockedTools === 3) { s.buyUpgrade('speed'); s.buyUpgrade('precision'); s.buyUpgrade('capacity'); }
      if (s.inventory === 0) {
        expect(s.startRefill(true)).toBe(true);
        for (let i = 0; s.refilling && i < 80; i++) s.tick(.05, -1, false, false, false);
        expect(s.refilling).toBe(false);
      }
      while (cursor < s.grid.cells.length && (s.grid.cells[cursor] || !s.grid.valid[cursor])) cursor++;
      const before = s.grid.count;
      for (let i = 0; i < 50 && s.grid.count === before; i++) s.tick(.05, cursor, true, false, true);
      expect(s.grid.count).toBeGreaterThan(before);
      actions++;
      if (actions > s.grid.total + 10) throw new Error('Campaign stalled');
    }
    expect(s.phase).toBe('finishing');
    for (let patch = 0; patch < s.grid.compacted.length; patch++) {
      let index = -1;
      for (let i = 0; i < s.grid.cells.length; i++) if (s.grid.valid[i] && s.grid.patchAt(i) === patch) { index = i; break; }
      expect(index).toBeGreaterThanOrEqual(0);
      for (let i = 0; i < 20 && !s.grid.compacted[patch]; i++) s.tick(.05, index, true, false, true);
      expect(s.grid.compacted[patch]).toBe(1);
    }
    expect(s.phase).toBe('complete'); expect(s.unlockedTools).toBe(3);
    expect(progress.completed).toContain(LEVELS[level]!.id);
    expect(progress.unlocked).toBe(Math.min(level + 1, LEVELS.length - 1));
    report.push({ job: s.grid.spec.id, stones: s.grid.total, simulationSeconds: Math.round(s.seconds), cash: s.money, tool: s.selectedTool, actions });
  }
  expect(progress.totalStones).toBe(99840);
  expect(progress.achievements).toContain('master');
  console.table(report);
  // Simulation time excludes movement, aiming, menu decisions and human reaction time.
}, 60000);
