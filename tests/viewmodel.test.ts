import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { Materials } from '../src/render/materials';
import { ViewModel } from '../src/render/viewmodel';

describe('unobstructed first-person tooling', () => {
  it('retains only the small hand model and hides every machine, including final compaction', () => {
    const materials = new Materials(), view = new ViewModel(materials);
    try {
      expect(view.group.children).toHaveLength(1);
      for (const tier of [0, 1, 2, 3]) {
        view.update(1 / 60, 2, tier, 'laying', .5, true, 16);
        expect(view.group.visible).toBe(tier === 0);
        view.update(1 / 60, 2, tier, 'finishing', .5, true, 0);
        expect(view.group.visible).toBe(false);
      }
      view.update(1 / 60, 2, 0, 'complete', 0, false, 16);
      expect(view.group.visible).toBe(false);
      view.update(1 / 60, 2, 0, 'laying', 0, false, 0);
      expect(view.group.visible).toBe(false);
      view.update(1 / 60, 2, 0, 'laying', 0, false, 16);
      expect(view.group.visible).toBe(true);
    } finally { view.dispose(); materials.dispose(); }
  });

  it('keeps the hand bounds below the aiming corridor through motion and all viewport aspects', () => {
    const materials = new Materials(), view = new ViewModel(materials);
    try {
      for (const aspect of [16 / 9, 4 / 3, 9 / 16]) {
        const camera = new T.PerspectiveCamera(55, aspect, .03, 8);
        camera.updateMatrixWorld();
        for (const reduced of [false, true]) for (const progress of [0, .25, .5, 1]) {
          view.setReducedMotion(reduced); view.impact();
          view.update(1 / 60, 2.5, 0, 'laying', progress, true, 16);
          const bounds = new T.Box3().setFromObject(view.group);
          for (const x of [bounds.min.x, bounds.max.x])
            for (const y of [bounds.min.y, bounds.max.y])
              for (const z of [bounds.min.z, bounds.max.z])
                expect(new T.Vector3(x, y, z).project(camera).y).toBeLessThan(-.2);
        }
      }
    } finally { view.dispose(); materials.dispose(); }
  });
});
