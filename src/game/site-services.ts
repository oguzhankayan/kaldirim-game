import { CELL_X, CELL_Z, type LevelSpec } from './content';
/** Shared by the world and the map so supply icons cannot lie after a layout changes. */
export function supplyPoints(spec: LevelSpec): { x: number; z: number }[] {
  const w = spec.cols * CELL_X, d = spec.rows * CELL_Z;
  if (spec.layout === 'elbow') return [
    { x: -w / 2 - 1.2, z: -d / 2 + 1.5 },
    { x: 112 * CELL_X - w / 2 - 1.2, z: -d / 2 + 14 },
    { x: 112 * CELL_X - w / 2 - 1.2, z: d / 2 - 3 },
  ];
  if (spec.layout === 'courtyard') return [
    { x: -w / 2 + 8, z: -d / 2 - 1.6 }, { x: -w / 2 - 1.2, z: 0 }, { x: w / 2 - 8, z: d / 2 + 1.2 },
  ];
  return [-d / 2 + 1.5, 0, d / 2 - 1.5].map(z => ({ x: -w / 2 - 1.2, z }));
}
