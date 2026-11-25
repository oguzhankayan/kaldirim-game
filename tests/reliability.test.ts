import { describe, it, expect } from 'vitest';
import { GameSession } from '../src/game/session';
import { SaveStore, SAVE_KEY, BACKUP_KEY, DEFAULT_SETTINGS, type StorageLike, type SavedGame } from '../src/game/save';
class MemoryStorage implements StorageLike {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
}
function fixture(): SavedGame { const s = new GameSession(0); return { version: 1, session: s.snapshot(), progress: s.progress, settings: { ...DEFAULT_SETTINGS }, pose: { x: -14, z: -10, yaw: 0, pitch: -.9 } }; }
describe('save reliability', () => {
  it('does not let a stale tab overwrite the newest checkpoint', () => {
    const storage = new MemoryStorage(), a = new SaveStore(storage), b = new SaveStore(storage);
    a.load(); b.load();
    const first = fixture(); first.pose.yaw = 1;
    expect(a.save(first)).toBe(true);
    expect(b.save(fixture())).toBe(false);
    expect(b.warning).toBe('save-conflict');
    expect(new SaveStore(storage).load()!.pose.yaw).toBe(1);
    expect(b.load()!.pose.yaw).toBe(1);
    expect(b.save(fixture())).toBe(true);
  });
  it('still writes the primary if only the optional backup reaches quota', () => {
    const storage = new MemoryStorage(), store = new SaveStore(storage);
    store.save(fixture());
    const original = storage.setItem.bind(storage);
    storage.setItem = (k, v) => { if (k === BACKUP_KEY) throw Error('quota'); original(k, v); };
    const data = fixture(); data.pose.yaw = 2;
    expect(store.save(data)).toBe(true);
    expect(store.warning).toBe('backup-unavailable');
    expect(new SaveStore(storage).load()!.pose.yaw).toBe(2);
    expect(storage.getItem(SAVE_KEY)).not.toBeNull();
  });
  it('supports an explicitly confirmed fresh start after a checkpoint', () => {
    const store = new SaveStore(new MemoryStorage()); store.load(); store.save(fixture()); store.clear();
    expect(store.save(fixture())).toBe(true);
  });
});
describe('authoritative gameplay guards', () => {
  it('rejects a head upgrade before leasing its compatible tool', () => {
    const s = new GameSession(0); s.money = 5000;
    expect(s.buyUpgrade('precision')).toBe(false); expect(s.money).toBe(5000);
    s.buyTool(1); s.buyTool(2);
    expect(s.buyUpgrade('precision')).toBe(true);
  });
  it('invalid targets cancel dwell and cannot carry progress to a valid cell', () => {
    for (const target of [NaN, Infinity, 0.5, -1, 10000]) {
      const s = new GameSession(0);
      for (let i = 0; i < 8; i++) s.tick(.05, 0, true, false, true);
      s.tick(.05, target, true, false, true);
      s.tick(.05, 0, true, false, true);
      expect(s.grid.count).toBe(0); expect(s.money).toBe(0);
    }
  });
});
