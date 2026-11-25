import { describe, expect, it } from 'vitest';
import { GameSession } from '../src/game/session';

describe('affordable equipment notice', () => {
  it('fires on reaching the exact price, once per tool, without buying anything', () => {
    const s = new GameSession(0);
    s.money = s.toolPrice(1) - 1; expect(s.claimEquipmentNotice()).toBeNull();
    s.money++; const balance = s.money; expect(s.claimEquipmentNotice()).toBe(1);
    expect(s.money).toBe(balance); expect(s.unlockedTools).toBe(0);
    expect(s.claimEquipmentNotice()).toBeNull();
    s.money = 0; s.money = balance; expect(s.claimEquipmentNotice()).toBeNull();
    expect(s.buyTool(1)).toBe(true); s.money = s.toolPrice(2);
    expect(s.claimEquipmentNotice()).toBe(2);
  });
  it('persists acknowledgement on reload but resets on a new job', () => {
    const s = new GameSession(0); s.money = s.toolPrice(1); s.claimEquipmentNotice();
    const loaded = GameSession.restore(s.snapshot(), s.progress)!;
    expect(loaded.claimEquipmentNotice()).toBeNull();
    const fresh = new GameSession(0); fresh.money = fresh.toolPrice(1);
    expect(fresh.claimEquipmentNotice()).toBe(1);
    const legacy = s.snapshot(); delete legacy.noticeMask;
    expect(GameSession.restore(legacy, s.progress)!.claimEquipmentNotice()).toBe(1);
    expect(GameSession.restore({ ...s.snapshot(), noticeMask: NaN }, s.progress)).toBeNull();
  });
  it('waits during refills and never announces during final compaction', () => {
    const s = new GameSession(0); s.money = s.toolPrice(1); s.inventory = 0;
    s.startRefill(true); expect(s.claimEquipmentNotice()).toBeNull();
    s.refilling = false; s.grid.place(Array.from(s.grid.valid.keys()).filter(i => s.grid.valid[i]));
    expect(s.claimEquipmentNotice()).toBeNull();
  });
});
