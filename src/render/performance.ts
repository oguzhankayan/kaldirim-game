export interface FrameSummary {
  samples: number;
  averageFps: number;
  frameMsP95: number;
  frameMsP99: number;
  worstFrameMs: number;
  slowFrames: number;
  cpuMsP95: number;
}

/** Raw presentation intervals, never the clamped delta used by the simulation. */
export class FrameMeter {
  private frames: Float64Array;
  private cpu: Float64Array;
  private cursor = 0;
  private length = 0;
  constructor(capacity = 600) {
    if (!Number.isInteger(capacity) || capacity < 1) throw new Error('Invalid frame sample capacity');
    this.frames = new Float64Array(capacity);
    this.cpu = new Float64Array(capacity);
  }
  reset(): void { this.cursor = 0; this.length = 0; }
  record(frameMs: number, cpuMs: number): void {
    if (!Number.isFinite(frameMs) || frameMs <= 0 || !Number.isFinite(cpuMs) || cpuMs < 0) return;
    this.frames[this.cursor] = frameMs;
    this.cpu[this.cursor] = cpuMs;
    this.cursor = (this.cursor + 1) % this.frames.length;
    this.length = Math.min(this.length + 1, this.frames.length);
  }
  summary(): FrameSummary {
    const a = Array.from(this.frames.subarray(0, this.length)).sort((x, y) => x - y);
    const cpu = Array.from(this.cpu.subarray(0, this.length)).sort((x, y) => x - y);
    const percentile = (values: number[], p: number): number => values[Math.max(0, Math.ceil(values.length * p) - 1)] ?? 0;
    const total = a.reduce((sum, n) => sum + n, 0);
    return {
      samples: this.length, averageFps: total ? this.length * 1000 / total : 0,
      frameMsP95: percentile(a, .95), frameMsP99: percentile(a, .99),
      worstFrameMs: a[a.length - 1] ?? 0,
      slowFrames: a.filter(n => n > 33.34).length, cpuMsP95: percentile(cpu, .95),
    };
  }
}

export function drawingRatio(deviceRatio: number, quality: 'low' | 'medium' | 'high'): number {
  const safe = Number.isFinite(deviceRatio) && deviceRatio > 0 ? deviceRatio : 1;
  // No dynamic-resolution controller and no sub-CSS-pixel render scale.
  return Math.max(1, Math.min(safe, quality === 'high' ? 2 : quality === 'medium' ? 1.5 : 1));
}
