import * as T from 'three';
import type { LevelSpec } from '../game/content';
import { PAVER_SWATCHES, patternPlan } from '../game/patterns';

const surface = PAVER_SWATCHES.map(s => new T.Color(s.tint));
const diagram = PAVER_SWATCHES.map(s => new T.Color(s.map));

/** Multipliers for the existing tactile stone albedo; no new material or draw per color. */
export function stoneColor(spec: LevelSpec, index: number, out = new T.Color()): T.Color {
  const plan = patternPlan(spec);
  return out.copy(surface[plan.toneAt(index)]!).multiplyScalar(plan.shadeAt(index));
}
/** Unlit ghosts show the planned pigment; the outline alone communicates work state. */
export function previewColor(spec: LevelSpec, index: number, out = new T.Color()): T.Color {
  const plan = patternPlan(spec);
  return out.copy(diagram[plan.toneAt(index)]!).multiplyScalar(plan.shadeAt(index));
}
