// Captures CrazyGames store material from the real engine on this machine's GPU.
// Needs the dev server (`npm run dev -- --port 4180`). Writes PNG stills and a WebM per
// orientation into artifacts/store/. Usage: node scripts/store-capture.mjs [landscape|portrait]
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = 'artifacts/store';
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:4180/?qa=1';
const SIZES = { landscape: { width: 1920, height: 1080 }, portrait: { width: 1080, height: 1620 } };
const which = process.argv[2] ?? 'landscape';
const size = SIZES[which];
mkdirSync(`${OUT}/${which}`, { recursive: true });

const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] });
const context = await browser.newContext({ viewport: size, deviceScaleFactor: 1 });
const page = await context.newPage();
// Chrome's screencast streams real rendered frames; system ffmpeg assembles them afterwards.
const frames = [];
const cdp = await context.newCDPSession(page);
mkdirSync(`${OUT}/${which}/frames`, { recursive: true });
cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
    const file = `${OUT}/${which}/frames/${String(frames.length).padStart(5, '0')}.jpg`;
    writeFileSync(file, Buffer.from(data, 'base64'));
    frames.push({ file, t: metadata.timestamp });
    await cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
});
const startCast = () => cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: size.width, maxHeight: size.height, everyNthFrame: 1 });
const wait = ms => page.waitForTimeout(ms);
const shot = name => page.screenshot({ path: `${OUT}/${which}/${name}.png` });

await page.goto(BASE);
await page.waitForFunction(() => !!window.__KALDIRIM_QA__, null, { timeout: 60000 });
// English, high quality, no head bob for steady footage.
await page.evaluate(() => localStorage.clear());
await page.locator('#overlay [data-action="settings"]').click();
await page.locator('[data-setting="language"]').selectOption('en');
await page.locator('[data-setting="quality"]').selectOption('high');
await page.locator('[data-action="back"]').click();

// A partly paved site reads as progress on the home screen and in the cover.
await page.evaluate(() => window.__KALDIRIM_QA__.showcase());
await wait(2500);
await shot('01-home');

await startCast();
await page.locator('#overlay [data-action="play"], #overlay [data-action="fresh"]').first().click();
await page.waitForFunction(() => document.pointerLockElement !== null, null, { timeout: 20000 }).catch(() => {});
await wait(1500);

// Slow look around the finished part of the site.
for (let i = 0; i < 40; i++) { await page.mouse.move(size.width / 2 + i * 6, size.height / 2); await wait(25); }
await shot('02-site-view');

// Pave by hand near the player for a few seconds.
const near = await page.evaluate(() => window.__KALDIRIM_QA__.nearby());
if (near.length) await page.evaluate(i => window.__KALDIRIM_QA__.aim(i), near[0]);
await wait(400);
await page.mouse.down();
await wait(4500);
await shot('03-paving');
await page.keyboard.down('w'); await wait(1200); await page.keyboard.up('w');
await wait(2500);
await page.mouse.up();
await shot('04-progress');

// Walk and look across the street.
await page.keyboard.down('a'); await wait(900); await page.keyboard.up('a');
for (let i = 0; i < 50; i++) { await page.mouse.move(size.width / 2 - i * 5, size.height / 2 - i); await wait(25); }
await shot('05-street');
await wait(1500);

await cdp.send('Page.stopScreencast').catch(() => {});
// Concat list with real frame durations so playback speed matches the session.
const list = frames.map((f, i) => `file '${f.file.split('/').pop()}'\nduration ${Math.max(0.001, ((frames[i + 1]?.t ?? f.t + 1 / 30) - f.t)).toFixed(4)}`).join('\n');
writeFileSync(`${OUT}/${which}/frames/list.txt`, list + '\n');
console.log('frames', frames.length, 'seconds', frames.length ? (frames.at(-1).t - frames[0].t).toFixed(1) : 0);
await context.close();
await browser.close();
console.log('captured', which);
