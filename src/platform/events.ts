/**
 * Anonymous funnel counts for the portal build. Each event leaves a device at most once
 * (remembered in localStorage), so the server can count players without any identifier.
 * Standalone builds have no endpoint and send nothing.
 */
const ENDPOINT = import.meta.env.VITE_EVENTS_URL as string | undefined;
const SENT_KEY = 'kaldirim:events-sent';

export type FunnelEvent = 'first-open' | 'job-start' | 'job-complete' | 'tool-leased';

export const eventsEnabled = Boolean(ENDPOINT);
export const privacyUrl = ENDPOINT ? new URL('/privacy', ENDPOINT).href : null;

function sent(): Set<string> {
    try { return new Set(JSON.parse(localStorage.getItem(SENT_KEY) ?? '[]') as string[]); } catch { return new Set(); }
}

export function track(event: FunnelEvent, job = -1, detail = ''): void {
    if (!ENDPOINT) return;
    const key = `${event}:${job}:${detail}`;
    const done = sent();
    if (done.has(key)) return;
    done.add(key);
    try { localStorage.setItem(SENT_KEY, JSON.stringify([...done])); } catch { /* storage full: skip silently */ }
    const body = JSON.stringify({ e: event, j: job, d: detail });
    try {
        if (!navigator.sendBeacon?.(new URL('/e', ENDPOINT).href, new Blob([body], { type: 'application/json' }))) {
            void fetch(new URL('/e', ENDPOINT).href, { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => undefined);
        }
    } catch { /* counting must never affect play */ }
}
