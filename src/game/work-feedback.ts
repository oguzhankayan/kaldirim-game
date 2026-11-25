import type { GameSession } from './session';

export type WorkState = 'idle' | 'ready' | 'working' | 'partial' | 'blocked' | 'refilling' | 'done';
export interface WorkFeedback { state: WorkState; progress: number; count: number; partial: boolean }
export interface WorkTarget { valid: boolean; count: number }
type WorkSnapshot = Pick<GameSession, 'phase' | 'inventory' | 'refilling' | 'workProgress' | 'dwell' | 'refillProgress' | 'refillDuration'>;
const fraction = (value: number, total: number): number => Number.isFinite(value) && Number.isFinite(total) && total > 0 ? Math.max(0, Math.min(1, value / total)) : 0;

/** Read-only presentation shared by the ground preview and HUD; never advances the simulation. */
export function workFeedback(session: WorkSnapshot, target: WorkTarget): WorkFeedback {
  const result: WorkFeedback = { state: 'idle', progress: 0, count: 0, partial: false };
  if (session.phase === 'complete') return { ...result, state: 'done' };
  if (session.refilling) return { ...result, state: 'refilling', progress: fraction(session.refillProgress, session.refillDuration) };
  if (session.phase === 'laying' && session.inventory <= 0) return { ...result, state: 'blocked' };
  if (!target.valid) return { ...result, state: target.count > 0 ? 'blocked' : 'idle' };
  if (target.count <= 0) return { ...result, state: 'done' };
  result.count = session.phase === 'finishing' ? 1 : Math.min(target.count, session.inventory);
  result.partial = session.phase === 'laying' && result.count < target.count;
  result.progress = fraction(session.workProgress, session.dwell);
  result.state = result.progress > 0 ? 'working' : result.partial ? 'partial' : 'ready';
  return result;
}
