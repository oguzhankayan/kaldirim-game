import { ACHIEVEMENTS, LEVELS } from './content';
import { GameSession, type Progress, type SessionSnapshot } from './session';
export interface Settings {
  language: 'tr' | 'en'; quality: 'low' | 'medium' | 'high'; fov: number; sensitivity: number;
  invertY: boolean; headBob: boolean; reducedMotion: boolean; volume: number; ambient: boolean;
}
export interface SavedGame {
  version: 1; session: SessionSnapshot; progress: Progress; settings: Settings;
  pose: { x: number; z: number; yaw: number; pitch: number };
}
export const DEFAULT_SETTINGS: Settings = { language: 'tr', quality: 'high', fov: 72, sensitivity: 1, invertY: false, headBob: false, reducedMotion: false, volume: .55, ambient: true };
export const SAVE_KEY = 'kaldirim.save.v1';
export const BACKUP_KEY = 'kaldirim.save.v1.backup';
const LIMIT = 2_000_000;
function record(x: unknown): x is Record<string, unknown> { return x !== null && typeof x === 'object' && !Array.isArray(x); }
function number(x: unknown, fallback: number, min: number, max: number): number { return typeof x === 'number' && Number.isFinite(x) ? Math.min(max, Math.max(min, x)) : fallback; }
export function validateSettings(value: unknown): Settings {
  const s = record(value) ? value : {};
  return { language: s.language === 'en' ? 'en' : 'tr', quality: s.quality === 'low' || s.quality === 'medium' ? s.quality : 'high', fov: number(s.fov, 72, 55, 100), sensitivity: number(s.sensitivity, 1, .2, 3), invertY: s.invertY === true, headBob: s.headBob === true, reducedMotion: s.reducedMotion === true, volume: number(s.volume, .55, 0, 1), ambient: s.ambient !== false };
}
function checksum(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16).padStart(8, '0');
}
export function encodeSave(data: SavedGame): string {
  const payload = JSON.stringify(data);
  return JSON.stringify({ format: 'kaldirim', version: 1, checksum: checksum(payload), payload });
}
function validateProgress(value: unknown): Progress | null {
  if (!record(value) || !Number.isInteger(value.unlocked) || (value.unlocked as number) < 0 || (value.unlocked as number) >= LEVELS.length) return null;
  const completed = value.completed, achievements = value.achievements;
  if (!Array.isArray(completed) || completed.length > LEVELS.length || completed.some(id => typeof id !== 'string' || !LEVELS.some(l => l.id === id)) || new Set(completed).size !== completed.length) return null;
  if (!Array.isArray(achievements) || achievements.length > ACHIEVEMENTS.length || achievements.some(id => typeof id !== 'string' || !ACHIEVEMENTS.some(a => a.id === id)) || new Set(achievements).size !== achievements.length) return null;
  if (!Number.isSafeInteger(value.totalStones) || (value.totalStones as number) < 0 || !record(value.bestTimes)) return null;
  const bestTimes: Record<string, number> = {};
  for (const [id, seconds] of Object.entries(value.bestTimes)) {
    if (!LEVELS.some(l => l.id === id || `${l.id}@2` === id) || typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0 || seconds > 1e9) return null;
    bestTimes[id] = seconds;
  }
  return { unlocked: value.unlocked as number, completed: [...completed], achievements: [...achievements], bestTimes, totalStones: value.totalStones as number };
}
/** Checksums detect accidental corruption, not cheating or malicious local modification. */
export function decodeSave(raw: string): SavedGame | null {
  if (typeof raw !== 'string' || raw.length > LIMIT) return null;
  try {
    const envelope: unknown = JSON.parse(raw);
    if (!record(envelope) || envelope.format !== 'kaldirim' || envelope.version !== 1 || typeof envelope.payload !== 'string' || envelope.payload.length > LIMIT || envelope.checksum !== checksum(envelope.payload)) return null;
    const data: unknown = JSON.parse(envelope.payload);
    if (!record(data) || data.version !== 1 || !record(data.session) || !record(data.pose)) return null;
    const progress = validateProgress(data.progress);
    if (!progress) return null;
    const session = GameSession.restore(data.session as unknown as SessionSnapshot, progress);
    if (!session) return null;
    const pose = data.pose;
    if (![pose.x, pose.z, pose.yaw, pose.pitch].every(x => typeof x === 'number' && Number.isFinite(x))) return null;
    return { version: 1, session: session.snapshot(), progress, settings: validateSettings(data.settings), pose: {
      x: number(pose.x, 0, -session.grid.width / 2 - 4, session.grid.width / 2 + 4),
      z: number(pose.z, 0, -session.grid.depth / 2 - 4, session.grid.depth / 2 + 4),
      yaw: (pose.yaw as number) % (Math.PI * 2), pitch: number(pose.pitch, -.8, -1.48, 1.48),
    } };
  } catch { return null; }
}
export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export class SaveStore {
  warning: string | null = null;
  private expectedRaw: string | null | undefined;
  constructor(private storage: StorageLike | null) {}
  loadSettings(): Settings | null {
    try { const raw = this.storage?.getItem('kaldirim.settings.v1'); if (!raw) return null; const parsed: unknown = JSON.parse(raw); return record(parsed) ? validateSettings(parsed) : null; }
    catch { return null; }
  }
  saveSettings(settings: Settings): boolean {
    try { if (!this.storage) return false; this.storage.setItem('kaldirim.settings.v1', JSON.stringify(validateSettings(settings))); return true; }
    catch { this.warning = 'storage-full-or-blocked'; return false; }
  }
  load(): SavedGame | null {
    if (!this.storage) { this.warning = 'storage-unavailable'; return null; }
    try {
      const raw = this.storage.getItem(SAVE_KEY);
      this.expectedRaw = raw;
      const primary = raw ? decodeSave(raw) : null;
      if (primary) return primary;
      const backup = this.storage.getItem(BACKUP_KEY);
      const recovered = backup ? decodeSave(backup) : null;
      if (raw || backup) this.warning = recovered ? 'backup-restored' : 'corrupt-save';
      return recovered;
    } catch { this.warning = 'storage-unavailable'; return null; }
  }
  save(data: SavedGame): boolean {
    if (!this.storage) { this.warning = 'storage-unavailable'; return false; }
    try {
      const raw = encodeSave(data);
      if (!decodeSave(raw)) { this.warning = 'invalid-save'; return false; }
      const old = this.storage.getItem(SAVE_KEY);
      // Another tab must not silently replace hours of newer work.
      if (this.expectedRaw !== undefined && old !== this.expectedRaw) { this.warning = 'save-conflict'; return false; }
      let backupFailed = false;
      if (old && old !== raw && decodeSave(old)) {
        try { this.storage.setItem(BACKUP_KEY, old); } catch { backupFailed = true; }
      }
      this.storage.setItem(SAVE_KEY, raw);
      this.expectedRaw = raw;
      this.warning = backupFailed ? 'backup-unavailable' : null;
      return true;
    } catch { this.warning = 'storage-full-or-blocked'; return false; }
  }
  clear(): void {
    try { this.storage?.removeItem(SAVE_KEY); this.storage?.removeItem(BACKUP_KEY); this.expectedRaw = null; this.warning = null; }
    catch { this.warning = 'storage-unavailable'; }
  }
}
