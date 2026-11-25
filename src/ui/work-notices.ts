import './work-notices.css';

export interface WorkNotice {
  id: string;
  title: string;
  detail: string;
  kind: 'equipment' | 'motif' | 'cleanup';
}
/** One quiet notice outside the aiming corridor. No timers survive pause or a new job. */
export class WorkNotices {
  readonly element = document.createElement('aside');
  private title = document.createElement('strong');
  private detail = document.createElement('span');
  private remaining = 0;
  private current: WorkNotice | null = null;
  private pending: WorkNotice | null = null;
  constructor(parent: HTMLElement) {
    this.element.id = 'work-notice'; this.element.hidden = true;
    this.element.setAttribute('role', 'status'); this.element.setAttribute('aria-live', 'polite');
    this.element.setAttribute('aria-atomic', 'true');
    this.element.append(this.title, this.detail); parent.append(this.element);
  }
  show(notice: WorkNotice): void {
    // An equipment milestone takes precedence; coalesce craft feedback, never queue dozens.
    if (this.current?.kind === 'equipment' && notice.kind !== 'equipment') { this.pending = notice; return; }
    this.current = notice; this.remaining = notice.kind === 'equipment' ? 6 : 3.5;
    this.title.textContent = notice.title; this.detail.textContent = notice.detail;
    this.element.dataset.kind = notice.kind; this.element.dataset.notice = notice.id;
    this.element.hidden = false;
  }
  update(dt: number, active: boolean): void {
    if (!active) { this.clear(); return; }
    if (!this.current) return;
    this.remaining -= Math.max(0, Math.min(.1, dt));
    if (this.remaining > 0) return;
    const next = this.pending; this.clear(); if (next) this.show(next);
  }
  cancelEquipment(tier: number, affordable: boolean): void {
    if (this.current?.kind === 'equipment' && (this.current.id !== `tool:${tier}` || !affordable)) this.clear();
  }
  clear(): void { this.remaining = 0; this.current = null; this.pending = null; this.element.hidden = true; }
}
