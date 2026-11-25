import { describe, expect, it } from 'vitest';
import { LEVELS } from '../src/game/content';
import { PavingGrid } from '../src/game/grid';
import { qaAimPoint } from '../src/dev/aim-point';

describe('QA aiming follows the current interlocking courses', () => {
  it('aims inside every logical ID, including half-cut stones at the eastern kerb', () => {
    for (const spec of LEVELS) {
      const grid = new PavingGrid(spec);
      for (let i = 0; i < grid.cells.length; i++) {
        const p = qaAimPoint(grid, i);
        expect(grid.fromWorld(p.x, p.z)).toBe(i);
      }
    }
  });
  it('tolerates subpixel camera jitter instead of targeting an odd-course boundary', () => {
    const grid = new PavingGrid(LEVELS[0]!);
    for (const id of [0, 99, 100, 101, 199, 9900, 9999]) {
      const p = qaAimPoint(grid, id);
      for (const dx of [-.001, .001]) for (const dz of [-.001, .001])
        expect(grid.fromWorld(p.x + dx, p.z + dz)).toBe(id);
    }
    expect(() => qaAimPoint(grid, -1)).toThrow(RangeError);
  });
});
