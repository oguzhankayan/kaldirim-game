import { describe, expect, it } from 'vitest';
import { LEVELS } from '../src/game/content';
import { PavingGrid } from '../src/game/grid';
import { PATTERN_REVISION, PAVER_SWATCHES, PavingPatternPlan, patternDefinition, patternPlan } from '../src/game/patterns';

describe('authored paving color inlays', () => {
  it('gives every job a distinct named interior pattern, not just an outer frame', () => {
    expect(PATTERN_REVISION).toBe(1);
    expect(new Set(LEVELS.map(s => patternDefinition(s).id)).size).toBe(LEVELS.length);
    for (const spec of LEVELS) {
      const plan = patternPlan(spec), grid = new PavingGrid(spec), counts = [0, 0, 0, 0];
      expect(plan.definition.name.tr).toBeTruthy(); expect(plan.definition.name.en).toBeTruthy();
      for (let row = 10; row < spec.rows - 10; row++) for (let col = 10; col < spec.cols - 10; col++) {
        const id = grid.index(col, row); if (grid.valid[id]) counts[plan.toneAt(id)]!++;
      }
      const interior = counts.reduce((a, b) => a + b, 0);
      for (const n of counts) expect(n / interior).toBeGreaterThan(.025);
    }
  });
  it('is deterministic across clones, placement order and partial or completed saves', () => {
    for (const spec of LEVELS) {
      const a = patternPlan(spec), b = new PavingPatternPlan({ ...spec });
      expect(patternPlan(spec)).toBe(a);
      for (let id = 0; id < spec.cols * spec.rows; id++) {
        if (a.toneAt(id) !== b.toneAt(id) || a.shadeAt(id) !== b.shadeAt(id)) throw new Error(`Unstable color at ${spec.id}/${id}`);
        expect(PAVER_SWATCHES[a.toneAt(id)]).toBeDefined();
        expect(a.shadeAt(id)).toBeGreaterThanOrEqual(.9599);
        expect(a.shadeAt(id)).toBeLessThanOrEqual(1.0401);
      }
    }
  });
  it('does not mutate level specs, masks or cell state', () => {
    for (const spec of LEVELS) {
      const frozen = Object.freeze({ ...spec }), g = new PavingGrid(frozen), before = g.cells.slice();
      const valid = g.valid.slice(); new PavingPatternPlan(frozen);
      expect(g.cells).toEqual(before); expect(g.valid).toEqual(valid); expect(g.count).toBe(0);
    }
  });
  it('retains a full continuous outer dark course and safe invalid-index fallbacks', () => {
    for (const spec of LEVELS) {
      const plan = patternPlan(spec);
      for (let col = 0; col < spec.cols; col++) {
        expect(plan.toneAt(col)).toBe(1);
        expect(plan.toneAt((spec.rows - 1) * spec.cols + col)).toBe(1);
      }
      expect(plan.toneAt(-1)).toBe(0); expect(plan.shadeAt(NaN)).toBe(1);
    }
  });
});
