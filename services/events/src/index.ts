/**
 * Anonymous play counter for Kaldırım. The game sends at most one beacon per event per device;
 * this worker only increments a daily count. Nothing that identifies a player is read or stored.
 */
interface Env { DB: D1Database }

const EVENTS = new Set(['first-open', 'job-start', 'job-complete', 'tool-leased']);
const MAX_PER_ROW = 5_000_000; // guards the table against junk floods
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };

const PRIVACY = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Kaldırım: Paving Simulator – Privacy</title>
<style>body{font:17px/1.6 -apple-system,system-ui,sans-serif;max-width:680px;margin:40px auto;padding:0 20px;color:#1e2a28;background:#f6f3ec}h1{font-size:28px}</style>
<h1>Privacy</h1>
<p><strong>Kaldırım: Paving Simulator</strong> has no accounts, no ads of its own and no tracking. Your progress is saved only in your browser.</p>
<p>To learn how far players get, the game sends a few anonymous counts: the first time it is opened, when a job is started or finished, and which equipment tier was first leased. Each event is sent at most once per device. No name, account, device identifier, advertising ID or IP address is stored; the server keeps only daily totals per event.</p>
<p>When played on CrazyGames, CrazyGames' own privacy policy applies to their platform and ads.</p>
<p>Questions or deletion requests: <a href="mailto:hi@creativefactory.tr">hi@creativefactory.tr</a></p>
<p>Türkçe: Oyun hesap, kendi reklamı veya takip içermez. Yalnızca ilk açılış, iş başlangıcı/bitişi ve ilk kiralanan ekipman gibi anonim sayımlar gönderilir; kimlik, cihaz bilgisi veya IP adresi saklanmaz.</p>
</html>`;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/privacy')) {
      return new Response(PRIVACY, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
    if (request.method !== 'POST' || url.pathname !== '/e') return new Response('Not found', { status: 404, headers: CORS });

    let body: { e?: unknown; j?: unknown; d?: unknown };
    try { body = await request.json(); } catch { return new Response('Bad request', { status: 400, headers: CORS }); }
    const event = typeof body.e === 'string' ? body.e : '';
    const job = Number.isInteger(body.j) && (body.j as number) >= -1 && (body.j as number) < 20 ? (body.j as number) : -1;
    const detail = typeof body.d === 'string' && /^[a-z0-9-]{0,24}$/.test(body.d) ? body.d : '';
    if (!EVENTS.has(event)) return new Response('Unknown event', { status: 400, headers: CORS });

    const day = new Date().toISOString().slice(0, 10);
    await env.DB.prepare(
      `INSERT INTO counts (day, event, job, detail, n) VALUES (?1, ?2, ?3, ?4, 1)
       ON CONFLICT (day, event, job, detail) DO UPDATE SET n = n + 1 WHERE n < ${MAX_PER_ROW}`,
    ).bind(day, event, job, detail).run();
    return new Response(null, { status: 204, headers: CORS });
  },
};
