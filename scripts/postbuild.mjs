import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
const root = path.resolve('dist');
async function files(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await files(p)); else out.push(p);
  }
  return out;
}
const assets = (await files(root)).filter(p => !p.endsWith('sw.js')).sort();
const hash = createHash('sha256'); let total = 0, gzip = 0;
for (const file of assets) {
  const data = await readFile(file); hash.update(data); total += data.length; gzip += gzipSync(data).length;
  if (file.endsWith('.js')) {
    const source = data.toString('utf8');
    for (const forbidden of ['__KALDIRIM_QA__', 'seedFinish', 'installQA']) if (source.includes(forbidden)) throw new Error(`Development mutation helper leaked into release: ${path.basename(file)} / ${forbidden}`);
  }
}
if (!(await stat(path.join(root, 'index.html'))).size) throw new Error('Missing entry point');
if (total > 20 * 1024 * 1024) throw new Error(`Initial download exceeds 20 MiB: ${total}`);
const version = hash.digest('hex').slice(0, 16);
const relative = assets.map(p => './' + path.relative(root, p).replaceAll('\\', '/'));
const worker = `const CACHE = 'kaldirim-${version}';
const ASSETS = ${JSON.stringify(relative)};
const urls = ASSETS.map(p => new URL(p, self.registration.scope).href);
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(urls))));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('kaldirim-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.open(CACHE).then(c => c.match(new URL('./index.html', self.registration.scope).href))));
    return;
  }
  if (!urls.includes(url.href)) return;
  event.respondWith(caches.open(CACHE).then(cache => cache.match(event.request).then(cached => cached || fetch(event.request))));
});\n`;
await writeFile(path.join(root, 'sw.js'), worker);
await writeFile(path.join(root, '_headers'), '/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n/sw.js\n  Cache-Control: no-cache\n/index.html\n  Cache-Control: no-cache\n/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n');
await writeFile(path.join(root, 'build-info.json'), JSON.stringify({ version, bytes: total, gzipBytes: gzip, assets: assets.length, debugHelpers: false }, null, 2));
console.log(`Release verified: ${assets.length} assets, ${(total / 1048576).toFixed(2)} MiB raw / ${(gzip / 1048576).toFixed(2)} MiB gzip; cache ${version}`);
