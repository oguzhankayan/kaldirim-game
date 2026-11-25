import { type Settings, type StorageLike } from '../game/save';

export const BIRDOKU_PROMO_KEY = 'kaldirim.birdoku-promo.v1';
const APP_STORE_TR = 'https://apps.apple.com/tr/app/birdoku-bird-logic-puzzle/id6834830537';
const APP_STORE_US = 'https://apps.apple.com/us/app/birdoku-bird-logic-puzzle/id6834830537';

export function shouldShowBirdokuPromo(storage: StorageLike | null): boolean {
  if (!storage) return false;
  try { return storage.getItem(BIRDOKU_PROMO_KEY) !== 'seen'; }
  catch { return false; }
}

export function markBirdokuPromoSeen(storage: StorageLike | null): void {
  if (!storage) return;
  try { storage.setItem(BIRDOKU_PROMO_KEY, 'seen'); }
  catch { return; }
}

export class BirdokuPromo {
  private el: HTMLElement;
  private restoreFocus: HTMLElement | null = null;

  constructor(root: HTMLElement, private storage: StorageLike | null) {
    this.el = document.createElement('div');
    this.el.id = 'birdoku-promo';
    this.el.hidden = true;
    this.el.addEventListener('click', event => {
      const target = event.target as HTMLElement;
      if (target.closest('[data-birdoku-close]') || target.closest('a[href]')) this.hide();
    });
    this.el.addEventListener('keydown', event => this.keydown(event));
    root.append(this.el);
  }

  showFirstOpen(language: Settings['language']): boolean {
    if (!shouldShowBirdokuPromo(this.storage)) return false;
    markBirdokuPromoSeen(this.storage);
    this.render(language);
    this.restoreFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.el.hidden = false;
    this.el.querySelector<HTMLElement>('[data-birdoku-close]')?.focus({ preventScroll: true });
    return true;
  }

  hide(): void {
    this.el.hidden = true;
    if (this.restoreFocus?.isConnected) this.restoreFocus.focus({ preventScroll: true });
    this.restoreFocus = null;
  }

  private render(language: Settings['language']): void {
    const tr = language === 'tr';
    const title = tr ? 'Birdoku’ya davetlisin' : 'You’re invited to Birdoku';
    const body = tr
      ? 'Kaldırım’a hoş geldin. Bağımsız oyunlarımı desteklemek istersen App Store’daki kuş temalı mantık oyunum Birdoku’ya da göz at. Ücretsiz indirilebilir.'
      : 'Welcome to Kaldırım. If you’d like to support my independent games, take a look at Birdoku, my bird logic puzzle on the App Store. It’s free to download.';
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-modal', 'true');
    this.el.setAttribute('aria-labelledby', 'birdoku-promo-title');
    this.el.innerHTML = `<div class="birdoku-card"><button type="button" class="birdoku-close" data-birdoku-close aria-label="${tr ? 'Kapat' : 'Close'}"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button><img src="./birdoku-icon.webp" width="88" height="88" alt="${tr ? 'Birdoku uygulama simgesi' : 'Birdoku app icon'}"><h2 id="birdoku-promo-title">${title}</h2><p>${body}</p><a class="birdoku-download" href="${tr ? APP_STORE_TR : APP_STORE_US}" target="_blank" rel="noopener noreferrer">${tr ? 'Hemen indir' : 'Download now'}</a></div>`;
  }

  private keydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation(); this.hide(); return;
    }
    if (event.key !== 'Tab') return;
    const items = Array.from(this.el.querySelectorAll<HTMLElement>('button, a[href]')).filter(el => el.getClientRects().length > 0);
    if (!items.length) return;
    event.preventDefault(); event.stopPropagation();
    const current = items.indexOf(document.activeElement as HTMLElement);
    const next = current < 0 ? (event.shiftKey ? items.length - 1 : 0) : (current + (event.shiftKey ? -1 : 1) + items.length) % items.length;
    items[next]!.focus();
  }
}
