import { test, expect, type Page } from '@playwright/test';
import { GameSession } from '../src/game/session';
// Functional tests use an explicit low preset on the CPU-only CI renderer.
// The dedicated visual test below still captures the high preset.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('kaldirim.settings.v1')) localStorage.setItem('kaldirim.settings.v1', JSON.stringify({ quality: 'low', reducedMotion: true, volume: 0, ambient: false }));
  });
});
const waitReady = async (page: Page) => { await page.goto('/?qa=1'); await page.waitForFunction(() => !!window.__KALDIRIM_QA__); };
const state = (page: Page) => page.evaluate(() => window.__KALDIRIM_QA__!.read());
const start = async (page: Page) => { await page.locator('#overlay [data-action="fresh"]').click(); await expect.poll(async () => (await state(page)).active).toBe(true); await page.waitForFunction(() => document.pointerLockElement !== null); };
const lay = async (page: Page) => { const before = (await state(page)).stones; const index = await page.evaluate(() => window.__KALDIRIM_QA__!.nearby()[0]!); await page.evaluate(i => window.__KALDIRIM_QA__!.aim(i), index); await page.mouse.down(); try { await expect.poll(async () => (await state(page)).stones, { timeout: 30000 }).toBe(before + 1); } finally { await page.mouse.up(); } };
test('real input: start, place, shop, refill, save, resume and pause', async ({ page }) => {
    test.setTimeout(180000);
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await waitReady(page);
    await page.screenshot({ path: 'artifacts/01-home.png' });
    await start(page);
    const a = await state(page);
    expect(a.total).toBe(GameSession.newJob(0).grid.total); expect(a.money).toBe(0);
    for (let i = 0; i < 12; i++) await lay(page);
    expect((await state(page)).money).toBe(48);
    await page.screenshot({ path: 'artifacts/02-first-stones.png' });
    await page.keyboard.press('b');
    await expect(page.locator('[data-action="upgrade"][data-id="capacity"]')).toBeEnabled();
    await page.locator('[data-action="upgrade"][data-id="capacity"]').click();
    expect((await state(page)).capacity).toBe(29); expect((await state(page)).money).toBe(0);
    await page.screenshot({ path: 'artifacts/03-equipment.png' });
    await page.locator('#overlay [data-action="close"]').click();
    await page.waitForFunction(() => document.pointerLockElement !== null);
    await page.keyboard.press('r');
    await expect.poll(async () => (await state(page)).inventory).toBe(29);
    await page.keyboard.press('Escape');
    await expect(page.locator('#overlay [data-action="play"]')).toBeVisible();
    const paused = await state(page);
    await page.waitForTimeout(400); expect((await state(page)).stones).toBe(paused.stones);
    await page.reload(); await page.waitForFunction(() => !!window.__KALDIRIM_QA__);
    expect((await state(page)).stones).toBe(12); expect((await state(page)).capacity).toBe(29);
    await page.locator('#overlay [data-action="play"]').click();
    await page.waitForFunction(() => document.pointerLockElement !== null);
    const pos = (await state(page)).position;
    await page.keyboard.down('w');
    try { await expect.poll(async () => (await state(page)).position.z).not.toBe(pos.z); } finally { await page.keyboard.up('w'); }
    expect(errors).toEqual([]);
});
test('final real compaction transitions to the next, larger job with a clean economy', async ({ page }) => {
    await waitReady(page); await start(page);
    await page.evaluate(() => window.__KALDIRIM_QA__!.seedFinish());
    await page.evaluate(() => window.__KALDIRIM_QA__!.aim(0));
    await page.mouse.down();
    await expect(page.locator('.complete-sheet')).toBeVisible({ timeout: 45000 });
    await page.mouse.up(); expect((await state(page)).unlocked).toBe(1);
    await page.screenshot({ path: 'artifacts/04-job-complete.png' });
    await page.locator('.complete-sheet [data-action="level"][data-id="1"]').click();
    await expect.poll(async () => (await state(page)).level).toBe(1);
    const s = await state(page);
    expect(s.total).toBe(GameSession.newJob(1).grid.total); expect(s.money).toBe(0); expect(s.tool).toBe(0);
    expect(s.capacity).toBe(16); expect(s.stones).toBe(0);
});
test('language, settings and original procedural world showcase', async ({ page }) => {
    await waitReady(page);
    await page.evaluate(() => window.__KALDIRIM_QA__!.showcase());
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'artifacts/05-neighborhood.png' });
    await page.locator('#overlay [data-action="settings"]').click();
    await page.locator('[data-setting="language"]').selectOption('en');
    await expect(page.locator('h2')).toContainText('At your own pace');
    await page.locator('[data-setting="quality"]').selectOption('medium');
    await page.screenshot({ path: 'artifacts/06-settings.png' });
});
test('production boots, plays and exposes no mutation/debug global', async ({ page }) => {
    await page.goto('http://127.0.0.1:4174/?qa=1');
    await expect(page.locator('#overlay [data-action="fresh"]')).toBeVisible({ timeout: 45000 });
    await expect(page.locator('#birdoku-promo')).toBeVisible();
    await expect(page.locator('#birdoku-promo-title')).toHaveText('Birdoku’ya davetlisin');
    await expect(page.locator('.birdoku-download')).toHaveAttribute('href', 'https://apps.apple.com/tr/app/birdoku-bird-logic-puzzle/id6834830537');
    await page.screenshot({ path: 'artifacts/09-birdoku-promo.png' });
    await page.locator('[data-birdoku-close]').click();
    await expect(page.locator('#birdoku-promo')).toBeHidden();
    expect(await page.evaluate(() => typeof window.__KALDIRIM_QA__)).toBe('undefined');
    await page.locator('#overlay [data-action="fresh"]').click();
    await expect(page.locator('#hud')).toBeVisible();
    await page.waitForFunction(() => document.pointerLockElement !== null);
    await page.mouse.down();
    try { await expect(page.locator('#hud-money')).not.toHaveText('0', { timeout: 45000 }); } finally { await page.mouse.up(); }
});
test('menus preserve keyboard focus and cannot move or spend while paused', async ({ page }) => {
    await waitReady(page);
    await page.keyboard.press('Tab');
    await expect(page.locator('#overlay [data-action="settings"]')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-setting="quality"]')).toBeVisible();
    await page.locator('[data-setting="fov"]').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('[data-setting="fov"]')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('.home-sheet')).toBeVisible();
    await start(page); await page.keyboard.press('Escape');
    const before = await state(page);
    await page.keyboard.down('w'); await page.waitForTimeout(350); await page.keyboard.up('w');
    expect((await state(page)).position).toEqual(before.position);
    expect((await state(page)).active).toBe(false);
});
test('high quality rendering has antialiasing and no sub-resolution scaling', async ({ page }) => {
    test.setTimeout(180000);
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await waitReady(page); await start(page); await lay(page);
    await page.keyboard.press('Escape');
    await page.locator('#overlay [data-action="settings"]').click();
    await page.locator('[data-setting="quality"]').selectOption('high');
    await page.locator('[data-action="back"]').click();
    await page.locator('[data-action="play"]').click();
    await expect.poll(async () => (await state(page)).frames.samples, { timeout: 60000 }).toBeGreaterThan(4);
    expect((await state(page)).antialias).toBe(true);
    expect((await state(page)).renderScale).toBeGreaterThanOrEqual(1);
    await page.screenshot({ path: 'artifacts/07-high-first-person.png', timeout: 45000 });
    await page.keyboard.press('Escape');
    await page.evaluate(() => window.__KALDIRIM_QA__!.showcase());
    await page.screenshot({ path: 'artifacts/08-high-neighborhood.png', timeout: 45000 });
    expect(errors).toEqual([]);
});
