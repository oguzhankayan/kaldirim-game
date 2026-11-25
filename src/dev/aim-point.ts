import { CELL_X, paverCourseShift } from '../game/content';
import type { Cell, PavingGrid } from '../game/grid';

/** Test setup only: aim inside the visible stone, not the old logical cell's boundary. */
export function qaAimPoint(grid: PavingGrid, index: number): Cell {
  if (!Number.isInteger(index) || index < 0 || index >= grid.cells.length) throw new RangeError('Invalid QA target');
  const center = grid.center(index), row = Math.floor(index / grid.spec.cols);
  // The last stone of an odd course is cut in half at the eastern kerb.
  const col = index % grid.spec.cols;
  const edge = col === grid.spec.cols - 1 || Boolean(grid.spec.layout && !grid.valid[index + 1]);
  return { x: center.x + paverCourseShift(row) - ((row & 1) && edge ? CELL_X / 4 : 0), z: center.z };
}
