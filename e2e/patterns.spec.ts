import { expect, test, type Page } from '@playwright/test';

async function patternRaster(page: Page): Promise<string> {
  return page.locator('#full-map').evaluate((canvas: HTMLCanvasElement) => {
    const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    // This test stays at the initial south-west spawn. The subpixel player arrow can move
    // by a fraction of a pixel when Rapier restores its pose; it is not part of the pattern.
    // Mask ONLY its 32x32 corner, not the paving interior. Unit tests cover every border ID.
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) data.fill(0, (y * canvas.width + x) * 4, (y * canvas.width + x) * 4 + 4);
    let hash = 2166136261;
    for (const byte of data) hash = Math.imul(hash ^ byte, 16777619);
    return `${canvas.width}:${canvas.height}:${hash >>> 0}`;
  });
}

// Functional test at the ordinary CI viewport. Actual placement still uses the mouse;
// the existing QA helper only points the camera inside a reachable stone.
test('paving plan is read-only, localized and stable after a save reload', async ({ page }) => {
  test.setTimeout(180000);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    if (!localStorage.getItem('kaldirim.settings.v1')) localStorage.setItem('kaldirim.settings.v1', JSON.stringify({ language: 'tr', quality: 'low', reducedMotion: true, volume: 0, ambient: false }));
  });
  await page.goto('/?qa=1');
  await page.waitForFunction(() => !!window.__KALDIRIM_QA__);
  await page.locator('#overlay [data-action="fresh"]').click();
  await page.waitForFunction(() => document.pointerLockElement !== null);
  const index = await page.evaluate(() => window.__KALDIRIM_QA__!.nearby()[0]!);
  await page.evaluate(id => window.__KALDIRIM_QA__!.aim(id), index);
  await page.mouse.down();
  try { await expect.poll(() => page.evaluate(() => window.__KALDIRIM_QA__!.read().stones), { timeout: 45000 }).toBe(1); }
  finally { await page.mouse.up(); }
  await page.keyboard.press('Tab');
  await expect(page.locator('#full-map')).toHaveAttribute('data-mode', 'progress');
  const before = await page.evaluate(() => window.__KALDIRIM_QA__!.read());
  const progress = await page.locator('#full-map').evaluate((c: HTMLCanvasElement) => c.toDataURL());
  await page.locator('[data-action="map-mode"][data-id="plan"]').click();
  await expect(page.locator('#full-map')).toHaveAttribute('data-mode', 'plan');
  await expect(page.locator('[data-id="plan"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.pattern-label')).toContainText('Baklava şeritleri');
  await expect(page.locator('.pattern-swatches span')).toHaveCount(4);
  const plan = await page.locator('#full-map').evaluate((c: HTMLCanvasElement) => c.toDataURL());
  expect(plan).not.toBe(progress);
  const signature = await patternRaster(page);
  const after = await page.evaluate(() => window.__KALDIRIM_QA__!.read());
  for (const key of ['stones', 'money', 'inventory', 'tool'] as const) expect(after[key]).toBe(before[key]);
  await page.screenshot({ path: 'artifacts/pattern-map-plan.png' });
  await page.reload(); await page.waitForFunction(() => !!window.__KALDIRIM_QA__);
  await page.locator('#overlay [data-action="play"]').click();
  await page.waitForFunction(() => document.pointerLockElement !== null);
  await page.keyboard.press('Tab');
  await page.locator('[data-action="map-mode"][data-id="plan"]').click();
  expect(await patternRaster(page)).toBe(signature);
  const reloaded = await page.evaluate(() => window.__KALDIRIM_QA__!.read());
  for (const key of ['stones', 'money', 'inventory', 'tool'] as const) expect(reloaded[key]).toBe(before[key]);
  expect(reloaded.position.x).toBeCloseTo(before.position.x, 3);
  expect(reloaded.position.z).toBeCloseTo(before.position.z, 3);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.pointerLockElement !== null);
  await page.keyboard.press('Escape');
  await expect(page.locator('#overlay [data-action="settings"]')).toBeVisible();
  await page.locator('#overlay [data-action="settings"]').click();
  await page.locator('[data-setting="language"]').selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.locator('#overlay [data-action="back"]').click();
  await page.locator('#overlay [data-action="map"]').click();
  await expect(page.locator('.pattern-label')).toContainText('Diamond bands');
  await expect(page.locator('[data-id="plan"]')).toHaveText('Finished pattern');
  expect(errors).toEqual([]);
});
