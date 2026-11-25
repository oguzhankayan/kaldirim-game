import type { PavingGrid } from './grid';
/** Driven contact under/in front of the player, never the distant mouse ray. */
export function compactorTarget(grid: PavingGrid, x: number, z: number, yaw: number): number {
  if (![x, z, yaw].every(Number.isFinite)) return -1;
  const contact = grid.fromWorld(x - Math.sin(yaw) * .85, z - Math.cos(yaw) * .85);
  if (contact >= 0 && grid.valid[contact]) return contact;
  // Standing at an edge must still allow the finishing pass without stepping off the path.
  const underneath = grid.fromWorld(x, z);
  return underneath >= 0 && grid.valid[underneath] ? underneath : -1;
}
