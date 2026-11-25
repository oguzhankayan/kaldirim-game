import { chromium } from '@playwright/test';
import { spawn, execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
const directory = 'artifacts/pattern-inspection'; await mkdir(directory, { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4182', '--strictPort'], { stdio: 'inherit' });
const report = { commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), samples: [], errors: [] };
let browser;
try {
  let ready = false;
  for (let i = 0; i < 80; i++) { try { ready = (await fetch('http://127.0.0.1:4182')).ok; } catch {} if (ready) break; await new Promise(r => setTimeout(r, 250)); }
  if (!ready) throw new Error('Inspection server did not start');
  browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  for (const view of ['0&revision=2', '1&revision=2', '2&revision=2', '3&revision=2', '4&revision=2', '0&revision=2&close=1', '0']) {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    page.on('pageerror', e => report.errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
    await page.goto(`http://127.0.0.1:4182/e2e/fixtures/pattern-stage.html?level=${view}`, { timeout: 120000 });
    await page.waitForFunction(() => window.__PATTERN_CAPTURE__, { }, { timeout: 120000 });
    const sample = await page.evaluate(() => window.__PATTERN_CAPTURE__);
    const name = `${sample.job}-r${sample.revision}${view.includes('close') ? '-close' : '-complete'}-1920x1080.png`;
    await page.screenshot({ path: `${directory}/${name}`, timeout: 120000 });
    report.samples.push({ ...sample, image: name }); console.log(JSON.stringify(sample));
    await page.close();
  }
  if (report.errors.length) throw new Error(report.errors.join('\n'));
} catch (error) { report.errors.push(String(error)); process.exitCode = 1; }
finally { await writeFile(`${directory}/report.json`, JSON.stringify(report, null, 2)); await browser?.close(); server.kill(); }
