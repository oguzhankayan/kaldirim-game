import { privacyUrl } from '../platform/events';
import './polish.css';
import './completion-view.css';
import { jobSpec } from '../game/job-layouts';
import { ACHIEVEMENTS, LEVELS, TOOLS, UPGRADES, type LocalText } from '../game/content';
import type { GameSession } from '../game/session';
import type { Settings } from '../game/save';
import { patternDefinition } from '../game/patterns';
import { patternCard, patternLegend, drawPatternCards } from './pattern-card';
import { WorksiteMap, type MapMode } from './worksite-map';
import { WorkNotices } from './work-notices';
import { WorkReticle } from './work-reticle';
export type Panel = 'home' | 'pause' | 'shop' | 'map' | 'settings' | 'journal' | 'jobs' | 'help' | 'confirm' | 'complete' | 'reveal' | null;
interface Actions {
  play(): void; fresh(): void; pause(): void; panel(panel: Panel): void;
  buyTool(tier: number): void; buyUpgrade(id: string): void; selectTool(tier: number): void; level(index: number): void;
  settings(value: Partial<Settings>): void; refill(): void; rotate(): void; hint(): void;
  reveal(): void; results(): void; tour(): void;
  exportSave(): void; importSave(raw: string): boolean; screenshot(): void;
}
const icon = '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M8 8h32v10l-7 6 7 6v10H8V30l7-6-7-6z" fill="currentColor"/><path d="M8 18h32M8 30h32" fill="none" stroke="var(--pine)" stroke-width="2"/></svg>';
export class GameUI {
  panel: Panel = 'home';
  hasSave = false;
  readonly touchRoot: HTMLElement;
  private overlay: HTMLElement;
  private hud: HTMLElement;
  private stats: HTMLElement;
  private toastEl: HTMLElement;
  private session!: GameSession;
  private toastTimer = 0;
  private mapAt = 0;
  private mapMode: MapMode = 'progress';
  private lastHud = '';
  private returnPanel: Panel = 'home';
  private worksiteMap = new WorksiteMap();
  private nodes = new Map<string, HTMLElement>();
  private reticle: WorkReticle;
  private notices: WorkNotices;
  private pose = { x: 0, z: 0, yaw: 0 };
  constructor(root: HTMLElement, private actions: Actions, private settings: Settings) {
    this.hud = document.createElement('div'); this.hud.id = 'hud'; this.hud.hidden = true;
    this.hud.innerHTML = '<div class="hud-job glass"><div class="eyebrow" id="hud-phase"></div><strong id="hud-title"></strong><div class="hud-progress"><i id="hud-progress-fill"></i></div><div class="hud-job-meta"><span id="hud-count"></span><span id="hud-percent"></span></div></div><div class="hud-wallet glass"><span id="hud-pay-label"></span><strong><span id="hud-money">0</span> <small>₺</small></strong><span id="save-status" role="status"></span></div><div id="reticle"><i></i></div><div id="work-context"></div><div id="tool-hud" class="glass"><span id="hud-tool-icon" aria-hidden="true"></span><div><span class="eyebrow" id="hud-tool-label"></span><strong id="hud-tool"></strong></div><div class="inventory"><b id="hud-inventory"></b><div class="hud-progress"><i id="inventory-fill"></i></div></div></div><div id="key-hints"></div><canvas id="mini-map" width="160" height="160" aria-label="Worksite minimap"></canvas>';
    this.notices = new WorkNotices(this.hud);
    this.reticle = new WorkReticle(this.hud.querySelector<HTMLElement>('#reticle')!);
    this.hud.insertAdjacentHTML('beforeend', '<div id="next-step" class="glass"><span class="eyebrow" id="next-step-label"></span><strong id="next-step-title"></strong><small id="next-step-detail"></small><div class="hud-progress"><i id="next-step-fill"></i></div></div>');
    this.overlay = document.createElement('section'); this.overlay.id = 'overlay'; this.overlay.setAttribute('role', 'dialog'); this.overlay.setAttribute('aria-modal', 'true'); this.overlay.setAttribute('aria-label', 'KALDIRIM');
    this.touchRoot = document.createElement('div'); this.touchRoot.id = 'touch-controls';
    this.touchRoot.innerHTML = '<div data-touch="move" class="touch-pad move-pad" aria-label="Move"><span>↕ ↔</span></div><div data-touch="look" class="touch-pad look-pad" aria-label="Look"></div><button data-touch="work" class="touch-work" aria-label="Work">'+icon+'</button><div class="touch-buttons"><button data-key="KeyR">R</button><button data-key="KeyB">B</button><button data-key="KeyQ">Q</button><button data-key="Escape">Ⅱ</button></div>';
    this.stats = document.createElement('pre'); this.stats.id = 'diagnostics'; this.stats.hidden = true;
    this.toastEl = document.createElement('div'); this.toastEl.id = 'toast'; this.toastEl.setAttribute('role', 'status'); this.toastEl.hidden = true;
    root.append(this.hud, this.touchRoot, this.overlay, this.stats, this.toastEl);
    this.overlay.addEventListener('click', e => { const el = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-action]'); if (el && !el.disabled) this.action(el.dataset.action!, el.dataset.id); });
    this.overlay.addEventListener('change', e => this.change(e));
    this.overlay.addEventListener('keydown', e => {
      if (!this.panel) return;
      if (e.key === 'Escape') {
        e.preventDefault(); e.stopPropagation();
        if (this.panel === 'home') return;
        if (this.panel === 'pause' || this.panel === 'shop' || this.panel === 'map') this.actions.play();
        else if (this.panel === 'reveal') this.actions.results();
        else if (this.panel === 'complete') this.actions.panel('home');
        else this.actions.panel(this.returnPanel);
        return;
      }
      if (e.key !== 'Tab') return;
      const items = Array.from(this.overlay.querySelectorAll<HTMLElement>('button:not(:disabled), input:not([hidden]), select, a[href]')).filter(el => el.getClientRects().length > 0);
      if (!items.length) return;
      e.preventDefault(); e.stopPropagation();
      const current = items.indexOf(document.activeElement as HTMLElement);
      const next = current < 0 ? (e.shiftKey ? items.length - 1 : 0) : (current + (e.shiftKey ? -1 : 1) + items.length) % items.length;
      items[next]!.focus();
    });
    this.touchRoot.addEventListener('click', e => { const key = (e.target as HTMLElement).closest<HTMLElement>('[data-key]')?.dataset.key; if (key === 'KeyR') actions.refill(); if (key === 'KeyB') actions.panel('shop'); if (key === 'KeyQ') actions.rotate(); if (key === 'Escape') actions.pause(); });
    this.setSettings(settings);
  }
  t(tr: string, en: string): string { return this.settings.language === 'tr' ? tr : en; }
  private text(value: LocalText): string { return value[this.settings.language]; }
  private n(value: number): string { return Math.round(value).toLocaleString(this.settings.language === 'tr' ? 'tr-TR' : 'en-US'); }
  private time(seconds: number): string { return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`; }
  private button(action: string, text: string, primary = false, id?: string | number, disabled = false): string { return `<button data-action="${action}"${id === undefined ? '' : ` data-id="${id}"`}${primary ? ' class="primary"' : ''}${disabled ? ' disabled' : ''}>${text}</button>`; }
  attach(session: GameSession): void { this.session = session; this.lastHud = ''; this.notices.clear(); }
  equipmentReady(tier: number): void {
    const tool = TOOLS[tier]; if (!tool) return;
    this.notices.show({ id: `tool:${tier}`, kind: 'equipment',
      title: `${this.text(tool.name)} ${this.t('için paran hazır', 'is now affordable')}`,
      detail: `${this.n(this.session.toolPrice(tier))} ₺ · B — ${this.t('Ekipman kirala', 'Lease equipment')}` });
  }
  craftNotice(id: string, title: string, detail: string, kind: 'motif' | 'cleanup' = 'motif'): void {
    this.notices.show({ id, title, detail, kind });
  }
  updateNotices(dt: number, active: boolean): void {
    const next = this.session.unlockedTools + 1;
    this.notices.cancelEquipment(next, this.session.phase === 'laying' && this.session.money >= this.session.toolPrice(next));
    this.notices.update(dt, active);
  }
  setSettings(settings: Settings): void {
    const focused = (document.activeElement as HTMLElement | null)?.dataset.setting;
    this.settings = settings; document.documentElement.lang = settings.language;
    document.documentElement.classList.toggle('reduced-motion', settings.reducedMotion);
    if (this.session && this.panel) this.show(this.panel);
    if (focused) this.overlay.querySelector<HTMLElement>(`[data-setting="${focused}"]`)?.focus({ preventScroll: true });
    this.lastHud = '';
  }
  private action(action: string, id?: string): void {
    switch (action) {
      case 'reveal': this.actions.reveal(); break;
      case 'results': this.actions.results(); break;
      case 'tour': this.actions.tour(); break;
      case 'play': case 'close': this.actions.play(); break;
      case 'fresh': if (this.hasSave) this.show('confirm'); else this.actions.fresh(); break;
      case 'reset-confirm': this.actions.fresh(); break;
      case 'home': this.actions.panel('home'); break;
      case 'settings': case 'shop': case 'map': case 'journal': case 'jobs': case 'help': this.actions.panel(action); break;
      case 'back': this.actions.panel(this.returnPanel); break;
      case 'tool': this.actions.buyTool(Number(id)); break;
      case 'select': this.actions.selectTool(Number(id)); break;
      case 'upgrade': this.actions.buyUpgrade(id!); break;
      case 'level': this.actions.level(Number(id)); break;
      case 'export': this.actions.exportSave(); this.toast(this.t('Kayıt dosyası hazırlandı.', 'Save export prepared.')); break;
      case 'import': this.overlay.querySelector<HTMLInputElement>('#import-file')?.click(); break;
      case 'photo': this.actions.screenshot(); break;
      case 'map-mode':
        if (this.panel !== 'map') break;
        this.mapMode = id === 'plan' ? 'plan' : 'progress'; this.show('map');
        this.overlay.querySelector<HTMLElement>(`[data-action="map-mode"][data-id="${this.mapMode}"]`)?.focus({ preventScroll: true });
        break;
      case 'hint': this.actions.hint(); break;
    }
  }
  private change(e: Event): void {
    const input = e.target as HTMLInputElement;
    if (input.id === 'import-file') {
      const file = input.files?.[0]; if (!file) return;
      if (file.size > 2_000_000) { this.toast(this.t('Dosya çok büyük.', 'File is too large.')); return; }
      void file.text().then(raw => { if (!this.actions.importSave(raw)) this.toast(this.t('Geçersiz veya bozulmuş kayıt. Mevcut ilerlemen korunuyor.', 'Invalid or corrupt save. Your current progress is safe.')); }).catch(() => this.toast(this.t('Dosya okunamadı.', 'Unable to read file.')));
      return;
    }
    const key = input.dataset.setting as keyof Settings | undefined; if (!key) return;
    const value = input.type === 'checkbox' ? input.checked : input.type === 'range' ? Number(input.value) : input.value;
    this.actions.settings({ [key]: value });
  }
  show(panel: Panel): void {
    if (panel && panel !== this.panel && ['settings', 'help', 'journal', 'confirm'].includes(panel)) this.returnPanel = this.panel ?? 'pause';
    if (panel) this.notices.clear();
    this.panel = panel; this.overlay.hidden = panel === null; this.hud.hidden = panel !== null; this.touchRoot.hidden = panel !== null;
    if (!panel || !this.session) return;
    const s = this.session, close = this.button('back', this.t('Geri', 'Back'));
    let body = '';
    if (panel === 'home') {
      body = `<div class="home-sheet"><div class="brand-mark">${icon}<span>${this.t('SAKİN BİR İŞ. BÜYÜK BİR DEĞİŞİM.', 'QUIET WORK. A BIG TRANSFORMATION.')}</span></div><h1>KALDIRIM<span>${this.t('KALDIRIM DÖŞEME SİMÜLATÖRÜ', 'PAVING SIMULATOR')}</span></h1><p class="home-promise">${this.t('Bir taşla başla.<br>Bütün sokağı döşe.', 'Start with one stone.<br>Pave the whole street.')}</p><p class="muted">${this.t('Acele yok. Önünde kocaman bir iş var.<br>Kazandıkça ekipmanını büyüt.', 'No rush. A huge job lies ahead.<br>Earn your way to bigger equipment.')}</p><div class="home-actions">${this.hasSave ? this.button('play', this.t('Şantiyeye dön', 'Continue job'), true) : ''}${this.button('fresh', this.t('İşe başla', 'Start paving'), !this.hasSave)}<div class="button-row">${this.button('settings', this.t('Ayarlar', 'Settings'))}${this.button('help', this.t('Nasıl oynanır?', 'How to play'))}</div></div><div class="home-foot">${this.n(s.grid.total)} ${this.t('taş seni bekliyor', 'stones are waiting')}<span>${this.t('Hesap yok · Çevrimdışı kayıt', 'No account · Local saves')}${privacyUrl ? ` · <a href="${privacyUrl}" target="_blank" rel="noopener">${this.t('Anonim istatistik · Gizlilik', 'Anonymous stats · Privacy')}</a>` : ''}</span></div></div>`;
    } else if (panel === 'reveal') {
      body = `<div class="reveal-sheet"><div class="eyebrow">${this.text(s.grid.spec.name)}</div><h2 id="reveal-label">${this.t('Yaptığın iş.', 'Your handiwork.')}</h2>${this.button('results', this.t('Geç · Sonuçları gör', 'Skip · View results'), true)}</div>`;
    } else if (panel === 'pause') {
      body = `<div class="sheet narrow"><div class="eyebrow">${this.t('KALDIĞIN YER BURADA', 'RIGHT WHERE YOU LEFT IT')}</div><h2>${this.t('Kısa bir mola.', 'Take a breather.')}</h2><p>${this.text(s.grid.spec.name)} · ${this.n(s.grid.count)} / ${this.n(s.grid.total)}</p><div class="menu-stack">${this.button('play', this.t('Oyuna devam', 'Continue'), true)}${this.button('shop', this.t('Ekipman kirala', 'Lease equipment'))}<div class="button-row">${this.button('map', this.t('İş haritası', 'Work map'))}${this.button('journal', this.t('Ustalık defteri', 'Craft journal'))}</div><div class="button-row">${this.button('settings', this.t('Ayarlar ve kayıt', 'Settings & saves'))}${this.button('help', this.t('Kontroller', 'Controls'))}</div>${this.button('home', this.t('Ana menü', 'Main menu'))}</div><p class="small muted">${this.t('Tarayıcıyı kapatmak ekipmanını sıfırlamaz.', 'Closing the browser does not reset your equipment.')}</p></div>`;
    } else if (panel === 'shop') body = this.shop();
    else if (panel === 'settings') body = this.settingsPanel();
    else if (panel === 'map') {
      const pattern = patternDefinition(s.grid.spec);
      body = `<div class="sheet map-sheet"><div class="sheet-top"><span class="eyebrow">${this.t('ŞANTİYE PLANI', 'SITE PLAN')}</span>${this.button('close', this.t('Oyuna dön', 'Return to work'))}</div><h2>${this.text(s.grid.spec.name)}</h2><p class="pattern-label"><strong>${this.text(pattern.name)}</strong> · ${this.text(pattern.description)}</p><div class="pattern-switch" role="group" aria-label="${this.t('Harita görünümü', 'Map view')}">${(['progress', 'plan'] as const).map(mode => `<button data-action="map-mode" data-id="${mode}" aria-pressed="${this.mapMode === mode}">${mode === 'plan' ? this.t('Bitmiş desen', 'Finished pattern') : this.t('İlerleme', 'Progress')}</button>`).join('')}</div><canvas id="full-map" data-mode="${this.mapMode}" aria-label="${this.mapMode === 'plan' ? this.text(pattern.name) : this.t('Döşenmiş ve eksik taşların haritası', 'Map of paved and unfinished areas')}"></canvas>${patternLegend(this.settings.language)}<p class="small muted">${this.t('Desen, döşediğin taşlarla ortaya çıkar. Renk seçmen gerekmez; aynı yerdeki taşın rengi her zaman aynıdır.', 'The pattern emerges as you pave. No color matching is required; each position always has the same pigment.')}</p><p class="map-legend"><i></i>${this.t('Boş alan koyu, desenli alan döşenmiş. Son geçişte bekleyen alanlar soluktur.', 'Empty ground is dark; paved ground shows its pattern. Pending final-pass areas are dimmed.')} <b></b>${this.t('Konumun', 'Your position')} <em></em>${this.t('İkmal paleti', 'Supply pallet')}</p><div class="button-row">${this.button('hint', this.t('En yakın eksik alanı işaretle', 'Mark nearest unfinished area'))}${this.button('photo', this.t('Fotoğraf al', 'Save photo'))}</div></div>`;
    }
    else if (panel === 'journal') body = `<div class="sheet"><div class="sheet-top"><span class="eyebrow">${this.n(s.progress.totalStones)} ${this.t('TAŞ DÖŞENDİ', 'STONES LAID')}</span>${close}</div><h2>${this.t('Ustalık defteri', 'Craft journal')}</h2><div class="achievement-grid">${ACHIEVEMENTS.map(a => `<article class="achievement ${s.progress.achievements.includes(a.id) ? 'earned' : ''}"><span>${s.progress.achievements.includes(a.id) ? '✓' : '○'}</span><div><h3>${this.text(a.name)}</h3><p>${this.text(a.description)}</p></div></article>`).join('')}</div><h3>${this.t('Tamamlanan işler', 'Completed jobs')}</h3>${LEVELS.map(l => `<p class="record-row"><span>${this.text(l.name)}</span><strong>${s.progress.completed.includes(l.id) ? this.time(s.progress.bestTimes[`${l.id}@2`] ?? s.progress.bestTimes[l.id] ?? 0) : '—'}</strong></p>`).join('')}</div>`;
    else if (panel === 'complete' || panel === 'jobs') {
      const master = LEVELS.every(l => s.progress.completed.includes(l.id));
      body = `<div class="sheet complete-sheet"><div class="completion-mark">${icon}</div><div class="eyebrow">${master ? this.t('BÜTÜN MAHALLE TAMAMLANDI', 'THE WHOLE NEIGHBORHOOD IS COMPLETE') : this.t('İŞ TAMAM', 'JOB COMPLETE')}</div><h2>${master ? this.t('Mahallenin ustası.', 'Master of the neighborhood.') : this.t('Eline sağlık, usta.', 'A job well done.')}</h2><p>${this.text(s.grid.spec.name)} · ${this.n(s.grid.total)} ${this.t('taş', 'stones')} · ${this.time(s.seconds)}</p><p class="muted">${this.t('Yeni işte kiralık ekipmanlar ve bakiye sıfırlanır. Ustalığın ve rekorların kalır.', 'A new job resets leased equipment and cash. Your mastery and records remain.')}</p>${patternCard(s.grid.spec, this.settings.language)}<div class="completion-actions">${this.button('tour', this.t('Bitirdiğin işi gez', 'Walk your finished site'), true)}${this.button('reveal', this.t('Önce / sonra', 'Before / after'))}</div><div class="job-list">${LEVELS.map((l, i) => this.button('level', `${String(i + 1).padStart(2, '0')} · ${this.text(l.name)}${s.progress.completed.includes(l.id) ? ' ✓' : ''}<small>${this.text(patternDefinition(jobSpec(i)).name)}</small>`, i === Math.min(s.level + 1, LEVELS.length - 1), i, i > s.progress.unlocked || s.phase !== 'complete')).join('')}</div><div class="button-row">${this.button('photo', this.t('Hatıra fotoğrafı', 'Save a photo'))}${this.button('home', this.t('Ana menü', 'Main menu'))}</div></div>`;
    } else if (panel === 'confirm') body = `<div class="sheet narrow"><h2>${this.t('Baştan başlayalım mı?', 'Start over?')}</h2><p>${this.t('Mevcut iş, ekipmanlar ve ustalık kayıtları silinecek. Önce Ayarlar’dan kayıt yedeği alabilirsin.', 'This clears the current job, equipment and mastery records. You can export a backup from Settings first.')}</p><div class="button-row">${this.button('back', this.t('Vazgeç', 'Cancel'))}${this.button('reset-confirm', this.t('Evet, yeni oyun', 'Yes, start over'), true)}</div></div>`;
    else if (panel === 'help') body = `<div class="sheet"><div class="sheet-top"><span class="eyebrow">${this.t('İŞİN PÜF NOKTASI', 'THE CRAFT')}</span>${close}</div><h2>${this.t('Bir sıra daha.', 'Just one more row.')}</h2><p>${this.t('Taş döşeyerek kazan. Aynı büyük işin içinde ekipman kirala. Alanı bitir, kompaktörle son geçişi yap.', 'Earn by placing stones. Lease better tools within the same large job. Finish paving, then make the final compaction pass.')}</p><div class="controls-grid">${[['W A S D', this.t('Yürü · Shift: hızlı yürü', 'Walk · Shift: move faster')], ['FARE / MOUSE', this.t('Bakış ve hedef seçimi', 'Look and select your target')], ['LMB', this.t('Sabit bir hedefte basılı tutarak döşe', 'Hold steadily over a target to pave')], ['R / E', this.t('Paletten ikmal', 'Refill at a pallet')], ['B', this.t('Ekipman ve geliştirmeler', 'Equipment and upgrades')], ['1 – 4', this.t('Alet seç', 'Choose tool')], ['Q', this.t('Yerleştirme grubunu döndür', 'Rotate footprint')], ['F', this.t('En yakın eksik alanı göster', 'Mark nearest unfinished work')], ['TAB', this.t('Şantiye haritası', 'Site map')], ['P / ESC', this.t('Mola / fareyi serbest bırak', 'Pause / release the mouse')]].map(([k, v]) => `<kbd>${k}</kbd><span>${v}</span>`).join('')}</div><aside>${this.t('Fareyi savurmak taşı yerleştirmez. Hedefte kal; alet hareketini tamamlasın. Paletler haritada mavi işaretlidir. Mobil İkmal ile her yerden malzeme alabilirsin.', 'Sweeping the mouse does not place stones. Hold a stable target and let the tool finish. Cyan map markers show the supply pallets. Mobile Supplies enables refills anywhere.')}</aside></div>`;
    this.overlay.className = panel === 'home' ? 'home' : panel === 'reveal' ? 'reveal' : 'modal'; this.overlay.innerHTML = body;
    this.overlay.querySelector<HTMLElement>('button:not(:disabled)')?.focus({ preventScroll: true });
    drawPatternCards(this.overlay);
    if (panel === 'map') this.drawMap(this.overlay.querySelector<HTMLCanvasElement>('#full-map')!, true);
  }
  revealLabel(label: 'lift' | 'before' | 'after'): void {
    const el = this.overlay.querySelector('#reveal-label');
    const text = label === 'before' ? this.t('Önce', 'Before') : label === 'after' ? this.t('Sonra. Senin eserin.', 'After. Built by you.') : this.t('Yaptığın iş.', 'Your handiwork.');
    if (el && el.textContent !== text) el.textContent = text;
  }
  private toolIcon(tier: number): string {
    const paths = [
      '<path d="M17 41V22c0-5 7-5 7 0v-9c0-5 7-5 7 0v12-5c0-5 7-5 7 0v5-2c0-5 7-5 7 0v13l-8 12H24z"/><path d="M13 11h10V5H6v15h8"/>',
      '<path d="M8 12h48M15 12v27h9M49 12v27h-9M27 12V6h10v6M19 44h26"/><rect x="23" y="28" width="18" height="12" rx="2"/>',
      '<path d="M10 42V19h44v23M18 19V8h28v11M8 48h48M15 34h34M26 26v15M38 26v15"/>',
      '<rect x="7" y="33" width="49" height="14" rx="7"/><path d="M16 33V18h29l9 15M25 18V8h16v10M44 27h15v17"/><circle cx="18" cy="40" r="3"/><circle cx="43" cy="40" r="3"/>',
    ];
    return `<svg viewBox="0 0 64 56" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${paths[tier]}</svg>`;
  }
  private shop(): string {
    const s = this.session;
    return `<div class="sheet shop-sheet"><div class="sheet-top"><span class="eyebrow">${this.t('BU İŞ İÇİN KİRALA', 'LEASE FOR THIS JOB')}</span>${this.button('close', this.t('Oyuna dön', 'Return to work'))}</div><div class="shop-title"><h2>${this.t('İşini büyüt.', 'Scale up your craft.')}</h2><strong>${this.n(s.money)} ₺</strong></div><p class="muted">${this.t('İş bitene kadar senin. Süreye bağlı kira veya malzeme faturası yok.', 'Yours until the job is done. No hourly rent or material bills.')}</p><div class="tool-grid">${TOOLS.map((t, i) => `<article class="tool-card ${i <= s.unlockedTools ? 'owned' : ''}"><span class="tool-number">0${i + 1}</span><div class="tool-icon">${this.toolIcon(i)}</div><h3>${this.text(t.name)}</h3><p>${this.text(t.description)}</p><div class="tool-metric">${(t.width + (i >= 2 ? s.upgrades.precision * 2 : 0)) * (t.depth + (i >= 2 ? s.upgrades.precision : 0))} <small>${this.t('taş / hareket', 'stones / motion')}</small></div>${i <= s.unlockedTools ? this.button('select', i === s.selectedTool ? this.t('Kullanılıyor', 'Equipped') : this.t('Kullan', 'Equip'), i === s.selectedTool, i, i === s.selectedTool) : this.button('tool', `${this.n(s.toolPrice(i))} ₺ · ${this.t('Kirala', 'Lease')}`, true, i, i !== s.unlockedTools + 1 || s.money < s.toolPrice(i) || s.phase !== 'laying')}</article>`).join('')}</div><h3>${this.t('Çalışma düzenin', 'Your workflow')}</h3><div class="upgrade-list">${UPGRADES.map(u => { const tier = s.upgrades[u.id], cost = s.upgradePrice(u.id); return `<article class="upgrade"><div><h4>${this.text(u.name)} <span>${'●'.repeat(tier)}${'○'.repeat(u.costs.length - tier)}</span></h4><p>${this.text(u.description)}</p></div>${this.button('upgrade', cost === undefined ? this.t('En üst kademe', 'Max level') : `${this.n(cost)} ₺`, false, u.id, cost === undefined || s.money < cost || s.phase !== 'laying' || (u.id === 'precision' && s.unlockedTools < 2))}</article>`; }).join('')}</div></div>`;
  }
  private settingsPanel(): string {
    const s = this.settings;
    const range = (id: keyof Settings, label: string, min: number, max: number, step: number) => `<label class="setting-row"><span>${label} <small>${s[id]}</small></span><input data-setting="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${s[id]}"></label>`;
    const toggle = (id: keyof Settings, label: string) => `<label class="setting-row"><span>${label}</span><input data-setting="${id}" type="checkbox" ${s[id] ? 'checked' : ''}></label>`;
    return `<div class="sheet settings-sheet"><div class="sheet-top"><span class="eyebrow">${this.t('AYARLAR', 'SETTINGS')}</span>${this.button('back', this.t('Geri', 'Back'))}</div><h2>${this.t('Kendi hızında.', 'At your own pace.')}</h2><label class="setting-row"><span>${this.t('Dil', 'Language')}</span><select data-setting="language"><option value="tr" ${s.language === 'tr' ? 'selected' : ''}>Türkçe</option><option value="en" ${s.language === 'en' ? 'selected' : ''}>English</option></select></label><label class="setting-row"><span>${this.t('Grafik kalitesi', 'Graphics quality')}</span><select data-setting="quality">${(['low', 'medium', 'high'] as const).map((q, i) => `<option value="${q}"${s.quality === q ? ' selected' : ''}>${[this.t('Düşük', 'Low'), this.t('Orta', 'Medium'), this.t('Yüksek', 'High')][i]}</option>`).join('')}</select></label>${range('fov', this.t('Görüş alanı', 'Field of view'), 55, 100, 1)}${range('sensitivity', this.t('Fare hassasiyeti', 'Mouse sensitivity'), .2, 3, .1)}${range('volume', this.t('Ses seviyesi', 'Volume'), 0, 1, .05)}${toggle('ambient', this.t('Ortam sesleri', 'Ambient sound'))}${toggle('invertY', this.t('Dikey bakışı ters çevir', 'Invert vertical look'))}${toggle('headBob', this.t('Hafif yürüme hareketi', 'Gentle walking motion'))}${toggle('reducedMotion', this.t('Hareketleri azalt', 'Reduce motion'))}<h3>${this.t('Kayıtlarını koru', 'Keep your progress safe')}</h3><p class="small muted">${this.t('Kayıtlar bu tarayıcıda saklanır. Cihaz değiştirirken yedeğini dışa aktar. Sunucuda kopya tutulmaz.', 'Saves stay in this browser. Export before switching devices. There is no server copy.')}</p><div class="button-row">${this.button('export', this.t('Yedeği dışa aktar', 'Export backup'))}${this.button('import', this.t('Yedeği içe aktar', 'Import backup'))}</div><input id="import-file" type="file" accept=".json,application/json" hidden></div>`;
  }
  update(time: number, target: { valid: boolean; count: number }, pose: { x: number; z: number; yaw: number }, nearSupply: boolean): void {
    this.pose = pose; if (!this.session) return;
    if (this.panel) { if (this.panel === 'map') this.drawMap(this.overlay.querySelector<HTMLCanvasElement>('#full-map')!, true); return; }
    const s = this.session, fraction = s.phase === 'laying' ? s.grid.count / s.grid.total : s.grid.compactedCount / s.grid.patchTotal;
    const key = `${s.grid.count}:${s.money}:${s.inventory}:${s.capacity}:${s.selectedTool}:${s.phase}:${this.settings.language}`;
    const put = (id: string, value: string) => {
      let node = this.nodes.get(id); if (!node) { node = this.hud.querySelector<HTMLElement>('#' + id)!; this.nodes.set(id, node); }
      if (node.textContent !== value) node.textContent = value;
    };
    if (key !== this.lastHud) {
      this.lastHud = key; put('hud-title', this.text(s.grid.spec.name)); put('hud-phase', s.phase === 'laying' ? this.t('TAŞ DÖŞEME', 'PAVING') : this.t('SON GEÇİŞ', 'FINAL PASS'));
      put('hud-pay-label', this.t('İŞÇİLİK BAKİYESİ', 'LABOR EARNINGS')); put('hud-money', this.n(s.money)); put('hud-tool-label', this.t('EKİPMAN', 'EQUIPMENT')); put('hud-tool', s.phase === 'finishing' ? this.t('Kompaktör', 'Compactor') : this.text(s.tool.name));
      this.hud.querySelector<HTMLElement>('#hud-tool-icon')!.innerHTML = s.phase === 'finishing' ? '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 35h30v7H9zM14 35v-9h20v9M17 26V9h14v17M17 9h14"/></svg>' : this.toolIcon(s.selectedTool);
      put('hud-inventory', `${this.n(s.inventory)} / ${this.n(s.capacity)}`); this.hud.querySelector<HTMLElement>('#inventory-fill')!.style.width = `${s.inventory / s.capacity * 100}%`;
      this.hud.querySelector<HTMLElement>('.inventory')!.hidden = s.phase !== 'laying';
      this.hud.querySelector<HTMLElement>('#key-hints')!.innerHTML = `<span><kbd>R</kbd> ${this.t('İkmal', 'Refill')}</span><span><kbd>B</kbd> ${this.t('Ekipman', 'Equipment')}</span><span><kbd>Q</kbd> ${this.t('Döndür', 'Rotate')}</span><span><kbd>F</kbd> ${this.t('Bul', 'Find')}</span><span><kbd>TAB</kbd> ${this.t('Harita', 'Map')}</span><span><kbd>P</kbd> ${this.t('Mola', 'Pause')}</span>`;
    }
    put('hud-count', s.phase === 'laying' ? `${this.n(s.grid.count)} / ${this.n(s.grid.total)} ${this.t('taş', 'stones')}` : `${s.grid.compactedCount} / ${s.grid.patchTotal} ${this.t('alan', 'patches')}`); put('hud-percent', `${(fraction * 100).toFixed(1)}%`);
    this.hud.querySelector<HTMLElement>('#hud-progress-fill')!.style.width = `${fraction * 100}%`;
    const cue = this.reticle.update(s, target);
    let context = '';
    if (s.phase === 'complete') context = this.t('İş tamam · P/Esc: Sonuçlar', 'Job complete · P/Esc: Results');
    else if (s.phase === 'finishing' && s.jobRevision === 2) context = this.t('Basılı tut ve yürü · Plaka önündeki zemini sıkıştırır', 'Hold and walk · The plate compacts the ground in front of you');
    else if (s.refilling) context = this.t('İkmal yapılıyor…', 'Refilling…');
    else if (s.phase === 'finishing') context = !target.valid ? this.t('Yakındaki zemine bak', 'Look at nearby ground') : target.count ? this.t('Basılı tut · Son geçiş', 'Hold · Final pass') : this.t('Burası hazır · Sonraki alana geç', 'Compacted · Choose the next patch');
    else if (!s.inventory) context = nearSupply || s.upgrades.logistics ? this.t('R · Taş al', 'R · Refill stones') : this.t('Taşlar bitti · İkmal paletine git', 'Out of stones · Find a supply pallet');
    else if (target.valid && target.count) context = cue.partial
      ? this.t(`Basılı tut · ${cue.count} taş (kısmi) · R: İkmal`, `Hold steady · ${cue.count} stones (partial) · R: Refill`)
      : this.t(`Basılı tut · ${cue.count} taş`, `Hold steady · ${cue.count} stones`);
    else if (target.valid) context = this.t('Burası tamam · Sıradaki boşluğa geç', 'Already paved · Choose the next space');
    else context = this.t('Yakındaki boş zemine bak', 'Look at nearby unfinished ground');
    put('work-context', context);
    const next = TOOLS[s.unlockedTools + 1];
    put('next-step-label', this.t('SIRADAKİ ADIM', 'YOUR NEXT STEP'));
    let title: string, detail: string, goal: number;
    if (s.phase === 'complete') {
      title = this.t('Bu iş senin eserin', 'Built by you'); detail = this.t('Gezebilir, fotoğraf alabilir veya P/Esc ile yeni işe geçebilirsin.', 'Explore, take a photo, or press P/Esc for your next job.'); goal = 1;
    } else if (s.phase === 'finishing') {
      title = this.t('Son geçiş', 'The finishing pass'); detail = this.t('F · Eksik alanı bul. İkmal gerekmiyor.', 'F · Find a remaining patch. No refill needed.'); goal = fraction;
    } else if (s.grid.count === 0) {
      title = this.t('İlk taşını yerleştir', 'Place your first stone'); detail = this.t('Boş zeminde sabit kal ve basılı tut.', 'Aim at empty ground and hold steadily.'); goal = 0;
    } else if (!s.inventory) {
      title = this.t('İkmal zamanı', 'Time to refill'); detail = nearSupply || s.upgrades.logistics ? this.t('R · Ücretsiz taş al.', 'R · Collect free stones.') : this.t('Haritadaki mavi kareler ikmal paletleri.', 'Cyan squares on the map are supply pallets.'); goal = 0;
    } else if (next) {
      title = this.text(next.name); goal = Math.min(1, s.money / s.toolPrice(s.unlockedTools + 1));
      detail = s.money >= s.toolPrice(s.unlockedTools + 1) ? this.t('Hazır · B ile ekipman kirala.', 'Ready · Press B to lease your upgrade.') : this.t(`${this.n(s.toolPrice(s.unlockedTools + 1) - s.money)} ₺ kaldı · ${next.width * next.depth} taş / hareket`, `${this.n(s.toolPrice(s.unlockedTools + 1) - s.money)} ₺ to go · ${next.width * next.depth} stones / motion`);
    } else {
      title = this.t('Büyük işi tamamla', 'Finish the big job'); detail = this.t(`${this.n(s.grid.total - s.grid.count)} taş kaldı.`, `${this.n(s.grid.total - s.grid.count)} stones remaining.`); goal = fraction;
    }
    put('next-step-title', title); put('next-step-detail', detail);
    this.hud.querySelector<HTMLElement>('#next-step-fill')!.style.width = `${goal * 100}%`;
    if (time - this.mapAt > .3) { this.mapAt = time; this.drawMap(this.hud.querySelector<HTMLCanvasElement>('#mini-map')!, false); }
  }
  private drawMap(canvas: HTMLCanvasElement, large: boolean): void { this.worksiteMap.draw(canvas, this.session.grid, this.pose, large, large ? this.mapMode : 'progress'); }
  toast(text: string): void { window.clearTimeout(this.toastTimer); this.toastEl.textContent = text; this.toastEl.hidden = false; this.toastTimer = window.setTimeout(() => { this.toastEl.hidden = true; }, 4500); }
  diagnostics(text: string, visible: boolean): void { this.stats.hidden = !visible; if (visible && this.stats.textContent !== text) this.stats.textContent = text; }
  saved(ok: boolean): void { this.hud.querySelector<HTMLElement>('#save-status')!.textContent = ok ? this.t('Kayıt alındı', 'Saved locally') : this.t('Kayıt alınamadı · Yedek dışa aktar', 'Save failed · Export a backup'); }
}
