import { test, expect } from '@playwright/test';
import { GameSession } from '../src/game/session';
import { DEFAULT_SETTINGS, encodeSave, SAVE_KEY } from '../src/game/save';

// A valid earned-money save prepares advanced tools without calling a production cheat API.
// This fixture tests presentation/controls, not the time required to earn every machine.
function equipmentFixture(): string {
  const s = new GameSession(1, { unlocked: 1, completed: ['sahil'], achievements: [], bestTimes: {}, totalStones: 0 });
  const ids = Array.from(s.grid.valid.keys()).filter(i => s.grid.valid[i]).slice(-4000);
  s.grid.place(ids); s.money = s.grid.count * s.grid.spec.pay; s.progress.totalStones = s.grid.count;
  for (const tier of [1, 2, 3]) if (!s.buyTool(tier)) throw new Error('Fixture cannot afford equipment');
  s.selectTool(1);
  return encodeSave({ version: 1, session: s.snapshot(), progress: s.progress,
    settings: { ...DEFAULT_SETTINGS, quality: 'low', reducedMotion: true, volume: 0, ambient: false },
    pose: { x: -s.grid.width / 2 + 1, z: -s.grid.depth / 2 + 1, yaw: 0, pitch: -.9 } });
}

test('advanced equipment keeps the target readable and places through real input', async ({ page }) => {
  test.setTimeout(180000);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(({ key, save }) => localStorage.setItem(key, save), { key: SAVE_KEY, save: equipmentFixture() });
  await page.goto('/?qa=1'); await page.waitForFunction(() => !!window.__KALDIRIM_QA__);
  await page.locator('#overlay [data-action="play"]').click();
  await page.waitForFunction(() => document.pointerLockElement !== null);
  for (const [tier, name] of [[1, 'Mekanik Kıskaç'], [2, 'Sıra Aparatı'], [3, 'K-48']] as const) {
    await page.keyboard.press(String(tier + 1));
    await expect(page.locator('#hud-tool')).toContainText(name);
    const index = await page.evaluate(() => window.__KALDIRIM_QA__!.nearby()[0]!);
    await page.evaluate(id => window.__KALDIRIM_QA__!.aim(id), index);
    await expect(page.locator('#reticle')).toHaveAttribute('data-state', 'ready');
    await expect(page.locator('#hud-tool-icon svg')).toHaveCount(1);
    await page.screenshot({ path: `artifacts/aim-tool-${tier}.png` });
    const before = await page.evaluate(() => window.__KALDIRIM_QA__!.read().stones);
    await page.mouse.down();
    try { await expect.poll(() => page.evaluate(() => window.__KALDIRIM_QA__!.read().stones), { timeout: 45000 }).toBeGreaterThan(before); }
    finally { await page.mouse.up(); }
    await expect(page.locator('#reticle')).toHaveAttribute('data-state', 'done');
    const after = await page.evaluate(() => window.__KALDIRIM_QA__!.read().stones);
    await page.mouse.down(); await page.waitForTimeout(800); await page.mouse.up();
    expect(await page.evaluate(() => window.__KALDIRIM_QA__!.read().stones)).toBe(after);
  }
  await page.keyboard.press('q');
  await page.keyboard.press('Escape');
  await expect(page.locator('#hud')).toBeHidden();
  await page.locator('#overlay [data-action="play"]').click();
  await page.evaluate(() => window.__KALDIRIM_QA__!.seedFinish());
  await page.evaluate(() => window.__KALDIRIM_QA__!.aim(0));
  await expect(page.locator('#hud-tool')).toHaveText('Kompaktör');
  await expect(page.locator('#work-context')).toContainText('Son geçiş');
  await page.screenshot({ path: 'artifacts/aim-compactor.png' });
  expect(errors).toEqual([]);
});
