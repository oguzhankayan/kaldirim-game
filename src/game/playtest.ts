import type { GameSession } from './session';
export interface PlaytestEvent { event: string; seconds: number; completed: number; balance: number; tool: number; detail?: string }
/** Local, bounded diagnostics. No network, identity, background tracking or save mutation. */
export class PlaytestLog {
  private events: PlaytestEvent[] = [];
  private percent = -1;
  record(event: string, session: GameSession, detail?: string): void {
    this.events.push({ event, seconds: +session.seconds.toFixed(2), completed: +(session.grid.count / session.grid.total).toFixed(4), balance: session.money, tool: session.selectedTool, ...(detail ? { detail } : {}) });
    if (this.events.length > 256) this.events.shift();
  }
  progress(session: GameSession): void {
    const percent = Math.floor(session.grid.count / session.grid.total * 10);
    if (percent !== this.percent) { this.percent = percent; this.record('paving-progress', session); }
  }
  report(): readonly PlaytestEvent[] { return this.events.map(event => ({ ...event })); }
}
