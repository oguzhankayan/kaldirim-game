import './work-reticle.css';
import type { GameSession } from '../game/session';
import { workFeedback, type WorkTarget, type WorkFeedback } from '../game/work-feedback';

/** Transparent center, high-contrast dot, and a true dwell/refill progress ring. */
export class WorkReticle {
  private arc: SVGCircleElement;
  private progress = -1;
  constructor(private root: HTMLElement) {
    root.setAttribute('aria-hidden', 'true');
    root.innerHTML = '<svg viewBox="0 0 32 32" focusable="false"><circle class="reticle-shadow" cx="16" cy="16" r="12"/><circle class="reticle-track" cx="16" cy="16" r="12"/><circle class="reticle-progress" cx="16" cy="16" r="12" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100" transform="rotate(-90 16 16)"/><circle class="reticle-dot" cx="16" cy="16" r="1.8"/><path class="reticle-block" d="M8 24 24 8"/></svg>';
    this.arc = root.querySelector<SVGCircleElement>('.reticle-progress')!;
  }
  update(session: GameSession, target: WorkTarget): WorkFeedback {
    const cue = workFeedback(session, target);
    if (this.root.dataset.state !== cue.state) this.root.dataset.state = cue.state;
    const progress = Math.round(cue.progress * 1000) / 10;
    if (progress !== this.progress) {
      this.progress = progress;
      this.arc.setAttribute('stroke-dashoffset', String(100 - progress));
    }
    return cue;
  }
}
