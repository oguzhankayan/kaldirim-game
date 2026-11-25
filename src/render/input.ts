export interface Axes { x: number; z: number; sprint: boolean }
export class Input {
  held = false;
  onLook: (dx: number, dy: number) => void = () => {};
  onUnlock: () => void = () => {};
  onLockFailure: () => void = () => {};
  onKey: (code: string) => void = () => {};
  private keys = new Set<string>();
  private abort = new AbortController();
  private touchAxes = { x: 0, z: 0 };
  private touchMode = false;
  private wasLocked = false;
  private enabled = false;
  constructor(private canvas: HTMLCanvasElement) {
    const signal = this.abort.signal;
    document.addEventListener('keydown', e => {
      // Menus retain native Tab, Space, Enter and browser shortcuts.
      if (!this.enabled || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target instanceof HTMLElement && e.target.closest('input,select,textarea,button,a,[contenteditable="true"]')) return;
      if (['Tab', 'F3', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      this.keys.add(e.code);
      if (!e.repeat) this.onKey(e.code);
    }, { signal });
    document.addEventListener('keyup', e => this.keys.delete(e.code), { signal });
    document.addEventListener('mousemove', e => { if (this.enabled && document.pointerLockElement === canvas) this.onLook(e.movementX, e.movementY); }, { signal });
    document.addEventListener('mousedown', e => { if (this.enabled && e.button === 0 && document.pointerLockElement === canvas) this.held = true; }, { signal });
    document.addEventListener('mouseup', e => { if (e.button === 0) this.held = false; }, { signal });
    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === canvas;
      if (this.wasLocked && !locked) { this.enabled = false; this.clear(); this.onUnlock(); }
      this.wasLocked = locked;
    }, { signal });
    document.addEventListener('pointerlockerror', () => { this.enabled = false; this.clear(); this.onLockFailure(); }, { signal });
    const loseFocus = () => { this.enabled = false; this.clear(); this.onUnlock(); };
    window.addEventListener('blur', loseFocus, { signal });
    document.addEventListener('visibilitychange', () => { if (document.hidden) loseFocus(); }, { signal });
    canvas.addEventListener('contextmenu', e => e.preventDefault(), { signal });
  }
  async lock(): Promise<void> {
    this.enabled = true;
    this.canvas.focus({ preventScroll: true });
    this.touchMode = matchMedia('(pointer:coarse)').matches;
    if (this.touchMode || document.pointerLockElement === this.canvas) return;
    try { await this.canvas.requestPointerLock(); } catch { this.enabled = false; this.onLockFailure(); }
  }
  unlock(): void { this.enabled = false; this.clear(); if (document.pointerLockElement === this.canvas) document.exitPointerLock(); }
  clear(): void { this.held = false; this.keys.clear(); this.touchAxes.x = 0; this.touchAxes.z = 0; }
  axes(): Axes {
    if (!this.enabled) return { x: 0, z: 0, sprint: false };
    const x = Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) - Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft')) + this.touchAxes.x;
    const z = Number(this.keys.has('KeyS') || this.keys.has('ArrowDown')) - Number(this.keys.has('KeyW') || this.keys.has('ArrowUp')) + this.touchAxes.z;
    const length = Math.max(1, Math.hypot(x, z));
    return { x: x / length, z: z / length, sprint: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') };
  }
  bindTouch(root: HTMLElement): void {
    const signal = this.abort.signal;
    for (const pad of root.querySelectorAll<HTMLElement>('[data-touch]')) {
      let pointer = -1, ox = 0, oy = 0, px = 0, py = 0;
      const mode = pad.dataset.touch;
      pad.addEventListener('pointerdown', e => {
        if (!this.enabled || pointer !== -1) return;
        e.preventDefault(); pointer = e.pointerId; ox = px = e.clientX; oy = py = e.clientY;
        pad.setPointerCapture(pointer);
        if (mode === 'work') this.held = true;
      }, { signal });
      pad.addEventListener('pointermove', e => {
        if (!this.enabled || e.pointerId !== pointer) return;
        if (mode === 'move') { this.touchAxes.x = Math.max(-1, Math.min(1, (e.clientX - ox) / 45)); this.touchAxes.z = Math.max(-1, Math.min(1, (e.clientY - oy) / 45)); }
        else if (mode === 'look') this.onLook((e.clientX - px) * 2, (e.clientY - py) * 2);
        px = e.clientX; py = e.clientY;
      }, { signal });
      const end = (e: PointerEvent) => { if (e.pointerId !== pointer) return; pointer = -1; if (mode === 'work') this.held = false; if (mode === 'move') this.touchAxes = { x: 0, z: 0 }; };
      pad.addEventListener('pointerup', end, { signal }); pad.addEventListener('pointercancel', end, { signal }); pad.addEventListener('lostpointercapture', end, { signal });
    }
  }
  dispose(): void { this.unlock(); this.abort.abort(); }
}
