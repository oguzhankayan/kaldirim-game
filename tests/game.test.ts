import { describe, it, expect } from 'vitest';
import { GameSession } from '../src/game/session';
import { PavingGrid } from '../src/game/grid';
import { LEVELS, TOOLS, paverCourseShift } from '../src/game/content';
import { SaveStore, SAVE_KEY, BACKUP_KEY, DEFAULT_SETTINGS, encodeSave, decodeSave, validateSettings, type SavedGame, type StorageLike } from '../src/game/save';
function work(s: GameSession, index: number) { let placed = 0; for (let i = 0; i < Math.ceil(s.dwell / .05) + 1; i++) placed += s.tick(.05, index, true, false, true).placed.length; return placed; }
function saveFixture(): SavedGame { const s = new GameSession(0); work(s, 0); return { version: 1, session: s.snapshot(), progress: s.progress, settings: { ...DEFAULT_SETTINGS }, pose: { x: -14, z: -10, yaw: 0, pitch: -.9 } }; }
class MemoryStorage implements StorageLike {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
}
describe('large campaign grids', () => {
  it('contains five authored jobs with the accepted stone counts', () => { expect(LEVELS.map(l => new PavingGrid(l).total)).toEqual([10000, 14280, 19280, 24000, 32280]); });
  it('maps every cell center to its stable ID', () => { for (const level of LEVELS) { const g = new PavingGrid(level); for (let i = 0; i < g.cells.length; i++) { const p = g.center(i); expect(g.fromWorld(p.x, p.z)).toBe(i); } } });
  it('aims at a seated stone on an offset course', () => { const g = new PavingGrid(LEVELS[0]!); for (let i = 0; i < g.cells.length; i += 97) { const p = g.center(i); expect(g.fromWorld(p.x + paverCourseShift(Math.floor(i / g.spec.cols)), p.z)).toBe(i); } });
  it('never pays or stores duplicate/invalid placements', () => { const g = new PavingGrid(LEVELS[0]!); expect(g.place([0, 0, -1, NaN, 1.5, g.cells.length])).toEqual([0]); expect(g.count).toBe(1); });
  it('protects tree and fountain islands', () => { const g = new PavingGrid(LEVELS[2]!); const hole = g.holes()[0]!; expect(g.place([g.index(hole.x, hole.z)])).toEqual([]); });
  it('clips large footprints and leaves edges repairable', () => { const g = new PavingGrid(LEVELS[0]!); const f = g.footprint(9999, 8, 6, false); expect(f.indices.length).toBeGreaterThan(0); expect(f.indices.every(i => i < 10000)).toBe(true); g.place(f.indices); expect(g.footprint(9999, 1, 1, false).indices).toEqual([]); });
  it('cannot compact an unfinished grid', () => { const g = new PavingGrid(LEVELS[0]!); expect(g.compact(0)).toBe(false); expect(g.compactedCount).toBe(0); });
  it('finds a real remaining cell, then no work after completion', () => { const g = new PavingGrid(LEVELS[0]!); g.place(Array.from(g.cells.keys()).slice(1)); expect(g.nearestUnfinished(100, 100)).toBe(0); g.place([0]); expect(g.nearestUnfinished(0, 0)).toBe(-1); });
  it('rejects invalid binary progress and early finish data', () => { const g = new PavingGrid(LEVELS[0]!); const cells = Array.from(g.cells), patches = Array.from(g.compacted); cells[0] = 2; expect(g.restore(cells, patches)).toBe(false); cells[0] = 0; patches[0] = 1; expect(g.restore(cells, patches)).toBe(false); });
});
describe('deliberate placement and job-local economy', () => {
  it('starts without money, with only a hand tool and sixteen stones', () => { const s = new GameSession(0); expect([s.money, s.unlockedTools, s.selectedTool, s.inventory, s.capacity]).toEqual([0, 0, 0, 16, 16]); });
  it('mouse sweeping cannot accumulate work across targets', () => { const s = new GameSession(0); for (let i = 0; i < 1000; i++) s.tick(.05, i % 100, true, false, true); expect(s.money).toBe(0); expect(s.grid.count).toBe(0); });
  it('release, loss of reach and explicit pause cancel accumulated work', () => { for (const reset of ['release', 'reach', 'pause']) { const s = new GameSession(0); for (let i = 0; i < 8; i++) s.tick(.05, 0, true, false, true); if (reset === 'pause') s.cancelWork(); else s.tick(.05, 0, reset !== 'release', false, reset !== 'reach'); s.tick(.05, 0, true, false, true); expect(s.grid.count).toBe(0); } });
  it('a stable dwell places once and pays once', () => { const s = new GameSession(0); expect(work(s, 0)).toBe(1); expect(work(s, 0)).toBe(0); expect([s.money, s.inventory, s.progress.totalStones]).toEqual([4, 15, 1]); });
  it('a delayed frame does not complete a whole job', () => { const s = new GameSession(0); s.tick(500, 0, true, false, true); expect(s.grid.count).toBe(0); expect(s.seconds).toBe(.05); });
  it('empty inventory cannot place or grant money', () => { const s = new GameSession(0); s.inventory = 0; expect(work(s, 0)).toBe(0); expect(s.money).toBe(0); });
  it('buys capacity through real earnings and retains the current job', () => { const s = new GameSession(0); for (let i = 0; i < 12; i++) work(s, i); expect(s.money).toBe(48); expect(s.buyUpgrade('capacity')).toBe(true); expect([s.money, s.capacity, s.grid.count]).toEqual([0, 29, 12]); });
  it('requires nearby supply until mobile refill is leased', () => { const s = new GameSession(0); s.inventory = 1; expect(s.startRefill(false)).toBe(false); expect(s.startRefill(true)).toBe(true); for (let i = 0; i < 40; i++) s.tick(.05, -1, false, false, false); expect(s.inventory).toBe(16); });
  it('does not allow tier skipping or unaffordable purchases', () => { const s = new GameSession(0); expect(s.buyTool(1)).toBe(false); s.money = 30000; expect(s.buyTool(3)).toBe(false); expect(s.buyTool(1)).toBe(true); expect(s.money).toBe(30000 - TOOLS[1]!.cost); expect(s.selectTool(3)).toBe(false); });
  it('restricts oversized groups to inventory and does not duplicate rewards', () => { const s = new GameSession(0); s.money = 240; s.buyTool(1); s.inventory = 2; expect(work(s, 0)).toBe(2); expect(s.inventory).toBe(0); expect(s.money).toBe(8); });
  it('new jobs reset tools and cash but preserve mastery', () => { const old = new GameSession(0); work(old, 0); old.progress.unlocked = 1; const next = new GameSession(1, old.progress); expect([next.money, next.unlockedTools, next.grid.count, next.capacity]).toEqual([0, 0, 0, 16]); expect(next.progress.achievements).toContain('first'); });
  it('refuses early completion', () => { const s = new GameSession(0); expect(s.complete()).toBe(false); expect(s.progress.unlocked).toBe(0); });
});
describe('validated saves and restricted storage', () => {
  it('round-trips progress, tool inventory and camera pose', () => { const data = saveFixture(); expect(decodeSave(encodeSave(data))).toEqual(data); });
  it('rejects checksum tampering and malformed or oversized input', () => { const raw = encodeSave(saveFixture()); expect(decodeSave(raw.replace('checksum', 'tampered'))).toBeNull(); expect(decodeSave('not json')).toBeNull(); expect(decodeSave('{}')).toBeNull(); expect(decodeSave('x'.repeat(2_000_001))).toBeNull(); });
  it('rejects invalid inventory even with a valid checksum', () => { const s = saveFixture(); s.session.inventory = 1000000; expect(decodeSave(encodeSave(s))).toBeNull(); });
  it('rejects inaccessible levels and non-finite/negative money', () => { const s = saveFixture(); s.session.level = 4; expect(decodeSave(encodeSave(s))).toBeNull(); s.session.level = 0; s.session.money = -1; expect(decodeSave(encodeSave(s))).toBeNull(); });
  it('recovers the previous verified save instead of replacing it with corruption', () => { const storage = new MemoryStorage(), store = new SaveStore(storage), s = saveFixture(); expect(store.save(s)).toBe(true); s.pose.yaw = 1; expect(store.save(s)).toBe(true); expect(storage.getItem(BACKUP_KEY)).not.toBeNull(); storage.setItem(SAVE_KEY, '{broken'); expect(store.load()?.pose.yaw).toBe(0); expect(store.warning).toBe('backup-restored'); });
  it('remains usable when browser storage is blocked', () => { const store = new SaveStore(null); expect(store.load()).toBeNull(); expect(store.save(saveFixture())).toBe(false); expect(store.warning).toBeTruthy(); });
  it('handles quota errors without crashing', () => { const storage = new MemoryStorage(); storage.setItem = () => { throw new Error('Quota exceeded'); }; const store = new SaveStore(storage); expect(store.save(saveFixture())).toBe(false); });
  it('clamps comfort settings and ignores unexpected keys', () => { const s = validateSettings({ fov: 900, sensitivity: -1, volume: 50, language: 'xx', quality: 'ultra', malicious: true }); expect([s.fov, s.sensitivity, s.volume, s.language, s.quality]).toEqual([100, .2, 1, 'tr', 'high']); expect(s).not.toHaveProperty('malicious'); });
});
