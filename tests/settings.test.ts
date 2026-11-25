import { describe, it, expect } from 'vitest';
import { GameSession } from '../src/game/session';
import { SaveStore, DEFAULT_SETTINGS, type SavedGame, type StorageLike } from '../src/game/save';
class MemoryStorage implements StorageLike {
  private data = new Map<string, string>();
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  setItem(key: string, value: string): void { this.data.set(key, value); }
  removeItem(key: string): void { this.data.delete(key); }
}
function fixture(): SavedGame {
  const session = new GameSession(0);
  return { version: 1, session: session.snapshot(), progress: session.progress, settings: { ...DEFAULT_SETTINGS }, pose: { x: -14, z: -10, yaw: 0, pitch: -.9 } };
}
describe('settings independent of campaign saves', () => {
  it('uses Turkish for a new standalone player', () => {
    expect(DEFAULT_SETTINGS.language).toBe('tr');
  });
  it('persists preferences before a new game has begun', () => {
    const storage = new MemoryStorage(), store = new SaveStore(storage);
    expect(store.loadSettings()).toBeNull();
    expect(store.saveSettings({ ...DEFAULT_SETTINGS, language: 'en', reducedMotion: true })).toBe(true);
    expect(new SaveStore(storage).loadSettings()?.language).toBe('en');
    expect(new SaveStore(storage).loadSettings()?.reducedMotion).toBe(true);
    expect(store.load()).toBeNull();
  });
  it('clearing the campaign does not discard comfort preferences', () => {
    const storage = new MemoryStorage(), store = new SaveStore(storage);
    store.saveSettings({ ...DEFAULT_SETTINGS, volume: 0 });
    store.save(fixture());
    store.clear();
    expect(store.load()).toBeNull();
    expect(store.loadSettings()?.volume).toBe(0);
  });
});
