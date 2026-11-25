import { describe, expect, it } from 'vitest';
import type { StorageLike } from '../src/game/save';
import { BIRDOKU_PROMO_KEY, markBirdokuPromoSeen, shouldShowBirdokuPromo } from '../src/ui/birdoku-promo';

class MemoryStorage implements StorageLike {
  data = new Map<string, string>();
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
  removeItem(key: string) { this.data.delete(key); }
}

describe('Birdoku first-open invitation', () => {
  it('appears in a fresh browser and only once', () => {
    const storage = new MemoryStorage();
    expect(shouldShowBirdokuPromo(storage)).toBe(true);
    markBirdokuPromoSeen(storage);
    expect(storage.getItem(BIRDOKU_PROMO_KEY)).toBe('seen');
    expect(shouldShowBirdokuPromo(storage)).toBe(false);
  });

  it('fails closed when storage is unavailable', () => {
    expect(shouldShowBirdokuPromo(null)).toBe(false);
  });
});
