import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4177', '--strictPort'], { stdio: 'inherit' });
let browser;
const errors = [], consoleLog = [], readings = [];
await mkdir('artifacts/visual', { recursive: true });
const report = async () => writeFile('artifacts/visual/report.json', JSON.stringify({ errors, consoleLog, readings, graphics: 'low preset, 1024x640, SwiftShader', note: 'Showcase is a development fixture, not manual campaign completion. Software-renderer timings do not measure real GPU performance.' }, null, 2));
try {
  for (let i = 0; i < 80; i++) { try { if ((await fetch('http://127.0.0.1:4177')).ok) break; } catch {} await new Promise(r => setTimeout(r, 200)); }
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { consoleLog.push(`${m.type()}: ${m.text()}`); if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://127.0.0.1:4177/?qa=1');
  await page.waitForFunction(() => window.__KALDIRIM_QA__ || document.querySelector('#error'), undefined, { timeout: 40000 });
  if (await page.locator('#error').count()) throw new Error(await page.locator('#error').innerText());
  readings.push({ stage: 'boot', ...await page.evaluate(() => window.__KALDIRIM_QA__.read()) }); await report();
  // Select an ordinary supported graphics setting through the visible game UI.
  await page.locator('#overlay [data-action="settings"]').click();
  await page.locator('[data-setting="quality"]').selectOption('low');
  await page.locator('[data-setting="reducedMotion"]').check();
  await page.locator('#overlay [data-action="back"]').click();
  await page.waitForTimeout(500);
  readings.push({ stage: 'low-preset', ...await page.evaluate(() => window.__KALDIRIM_QA__.read()) }); await report();
  await page.screenshot({ path: 'artifacts/visual/01-home.png', timeout: 45000 });
  await page.locator('[data-action="fresh"]').click();
  await page.waitForTimeout(1500);
  readings.push({ stage: 'first-person', ...await page.evaluate(() => window.__KALDIRIM_QA__.read()) }); await report();
  await page.screenshot({ path: 'artifacts/visual/02-first-person.png', timeout: 45000 });
  await page.mouse.down(); await page.waitForTimeout(2200); await page.mouse.up();
  readings.push({ stage: 'after-placement', ...await page.evaluate(() => window.__KALDIRIM_QA__.read()) }); await report();
  await page.keyboard.press('b');
  await page.screenshot({ path: 'artifacts/visual/03-shop.png', timeout: 45000 });
  await page.evaluate(() => window.__KALDIRIM_QA__.showcase());
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'artifacts/visual/04-paving-showcase-fixture.png', timeout: 45000 });
  if (errors.length) throw new Error(errors.join('\n'));
} catch (error) { errors.push(String(error)); process.exitCode = 1; }
finally { await report(); await browser?.close(); server.kill(); }
