import { describe, it, expect } from 'vitest';
import { FrameMeter, drawingRatio } from '../src/render/performance';
describe('honest frame diagnostics', () => {
  it('measures presentation intervals rather than averaging instantaneous FPS', () => {
    const meter = new FrameMeter();
    for (let i = 0; i < 120; i++) meter.record(1000 / 60, 4);
    const s = meter.summary();
    expect(s.samples).toBe(120); expect(s.averageFps).toBeCloseTo(60);
    expect(s.frameMsP99).toBeCloseTo(16.6667); expect(s.slowFrames).toBe(0);
  });
  it('does not hide a half-second hitch with a simulation-delta clamp', () => {
    const meter = new FrameMeter();
    for (let i = 0; i < 59; i++) meter.record(1000 / 60, 4);
    meter.record(500, 150);
    const s = meter.summary();
    expect(s.averageFps).toBeLessThan(41); expect(s.worstFrameMs).toBe(500);
    expect(s.frameMsP99).toBe(500); expect(s.slowFrames).toBe(1);
  });
  it('uses bounded memory and can exclude paused intervals', () => {
    const meter = new FrameMeter(3); [10, 20, 30, 40].forEach(n => meter.record(n, 2));
    expect(meter.summary().samples).toBe(3); expect(meter.summary().averageFps).toBeCloseTo(1000 / 30);
    meter.reset(); meter.record(NaN, 2); meter.record(-1, 2); meter.record(16, Infinity);
    expect(meter.summary().samples).toBe(0);
  });
});
describe('sharpness policy', () => {
  it('never silently drops below one drawing pixel per CSS pixel', () => {
    for (const q of ['low', 'medium', 'high'] as const) for (const dpr of [.5, 1, 2, 3, NaN]) expect(drawingRatio(dpr, q)).toBeGreaterThanOrEqual(1);
    expect(drawingRatio(2, 'high')).toBe(2); expect(drawingRatio(1, 'high')).toBe(1);
  });
});
