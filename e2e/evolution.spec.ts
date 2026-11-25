import { test, expect, type Page } from '@playwright/test';
import { GameSession } from '../src/game/session';
import { DEFAULT_SETTINGS, encodeSave, SAVE_KEY } from '../src/game/save';

const read = (page: Page) => page.evaluate(() => window.__KALDIRIM_QA__!.read());
function fixture(finishing: boolean): string {
  const s = GameSession.newJob(0), g = s.grid;
  const ids = Array.from(g.valid.keys()).filter(i => g.valid[i]);
  g.place(finishing ? ids : ids.slice(-59));
  s.progress.totalStones = g.count; s.money = finishing ? 0 : g.count * g.spec.pay;
  if (finishing) for (let p = 3; p < g.compacted.length; p++) g.compact(p);
  return encodeSave({ version: 1, session: s.snapshot(), progress: s.progress,
    settings: { ...DEFAULT_SETTINGS, quality: 'low', reducedMotion: !finishing, volume: 0, ambient: false },
    pose: { x: -g.width / 2 + 1, z: -g.depth / 2 + 1, yaw: finishing ? -Math.PI / 2 : 0, pitch: -.9 } });
}
async function startFixture(page: Page, save: string): Promise<void> {
  await page.addInitScript(({ key, data }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, data); }, { key: SAVE_KEY, data: save });
  await page.goto('/?qa=1'); await page.waitForFunction(() => !!window.__KALDIRIM_QA__);
  await page.locator('#overlay [data-action="play"]').click();
  await page.waitForFunction(() => document.pointerLockElement !== null);
}
// Fixtures prepare specific boundaries. The final earning, buying, walking, compacting,
// skipping and touring are actual mouse/keyboard inputs, not calls to session mutation APIs.
test('earned equipment notification is readable, non-blocking, once-only and saved', async ({ page }) => {
  test.setTimeout(180000);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await startFixture(page, fixture(false));
  await expect(page.locator('#work-notice')).toBeHidden();
  const id = await page.evaluate(() => window.__KALDIRIM_QA__!.nearby()[0]!);
  await page.evaluate(i => window.__KALDIRIM_QA__!.aim(i), id);
  await page.mouse.down();
  try { await expect.poll(async () => (await read(page)).money, { timeout: 45000 }).toBe(240); }
  finally { await page.mouse.up(); }
  const banner = page.locator('#work-notice');
  await expect(banner).toHaveAttribute('data-notice', 'tool:1');
  await expect(banner).toContainText('Mekanik Kıskaç için paran hazır');
  await expect(banner).toHaveAttribute('role', 'status');
  expect(await banner.evaluate(e => getComputedStyle(e).pointerEvents)).toBe('none');
  const b = (await banner.boundingBox())!, r = (await page.locator('#reticle').boundingBox())!;
  expect(b.y + b.height).toBeLessThan(r.y); expect((await read(page)).tool).toBe(0);
  await page.screenshot({ path: 'artifacts/equipment-affordable.png' });
  await page.keyboard.press('b'); await expect(banner).toBeHidden();
  await expect(page.locator('[data-action="tool"][data-id="1"]')).toContainText('240');
  await page.locator('[data-action="tool"][data-id="1"]').click();
  expect((await read(page)).tool).toBe(1); expect((await read(page)).money).toBe(0);
  await page.reload(); await page.waitForFunction(() => !!window.__KALDIRIM_QA__);
  await page.locator('#overlay [data-action="play"]').click();
  await page.waitForFunction(() => document.pointerLockElement !== null);
  await expect(banner).toBeHidden(); expect((await read(page)).tool).toBe(1);
  await page.keyboard.press('Escape');
  const savedMask = await page.evaluate(key => JSON.parse(JSON.parse(localStorage.getItem(key)!).payload).session.noticeMask, SAVE_KEY);
  expect(savedMask & 2).toBe(2); expect(errors).toEqual([]);
});

test('walk-to-compact finishes a revised site, reveals before-after and safely tours the result', async ({ page }) => {
  test.setTimeout(240000);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await startFixture(page, fixture(true));
  const initial = await read(page);
  await expect(page.locator('#work-context')).toContainText('Basılı tut ve yürü');
  // Use the ordinary work-facing camera for the CPU-only functional run. Looking at
  // the entire dense site takes 18s/frame in SwiftShader; it is not hardware timing.
  // The separate Rapier regression verifies this same path at upward/horizon/downward pitch.
  await page.mouse.down(); await page.keyboard.down('w');
  try { await expect.poll(async () => (await read(page)).phase, { timeout: 90000 }).toBe('complete'); }
  finally { await page.keyboard.up('w'); await page.mouse.up(); }
  const complete = await read(page);
  expect(complete.position.x).toBeGreaterThan(initial.position.x + 4);
  expect(complete.money).toBe(initial.money); expect(complete.inventory).toBe(initial.inventory);
  await expect(page.locator('#overlay')).toHaveClass('reveal');
  await expect(page.locator('#reveal-label')).toHaveText('Önce', { timeout: 45000 });
  await page.screenshot({ path: 'artifacts/site-reveal-before.png' });
  await expect(page.locator('#reveal-label')).toHaveText('Sonra. Senin eserin.', { timeout: 45000 });
  await page.screenshot({ path: 'artifacts/site-reveal-after.png' });
  await expect(page.locator('.complete-sheet')).toBeVisible({ timeout: 60000 });
  await page.locator('[data-action="reveal"]').click();
  await page.keyboard.press('Escape'); await expect(page.locator('.complete-sheet')).toBeVisible();
  await page.locator('[data-action="tour"]').click();
  await page.waitForFunction(() => document.pointerLockElement !== null);
  await expect(page.locator('#work-context')).toContainText('İş tamam');
  const tour = await read(page);
  expect(tour.active).toBe(true);
  expect(tour.position.x).toBeCloseTo(complete.position.x, 2);
  expect(tour.position.z).toBeCloseTo(complete.position.z, 2);
  await page.mouse.down(); await page.keyboard.down('d');
  try { await expect.poll(async () => {
    const p = (await read(page)).position; return Math.hypot(p.x - tour.position.x, p.z - tour.position.z);
  }).toBeGreaterThan(.2); }
  finally { await page.keyboard.up('d'); await page.mouse.up(); }
  expect((await read(page)).stones).toBe(tour.stones); expect((await read(page)).money).toBe(tour.money);
  await page.keyboard.press('Escape'); await expect(page.locator('.complete-sheet')).toBeVisible();
  await page.reload(); await page.waitForFunction(() => !!window.__KALDIRIM_QA__);
  expect((await read(page)).phase).toBe('complete'); expect((await read(page)).money).toBe(tour.money);
  expect(errors).toEqual([]);
});
