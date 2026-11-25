import { expect, it } from 'vitest';
import * as T from 'three';
import { GameSession } from '../src/game/session';
import { compactorTarget } from '../src/game/compactor';
import { Player, initPhysics } from '../src/render/player';
import { DEFAULT_SETTINGS } from '../src/game/save';

it('actual Rapier walking completes consecutive finish patches regardless of camera pitch and still works after completion', async () => {
  await initPhysics();
  for (const pitch of [-1.2, .05, .9]) {
    const s = GameSession.newJob(0), g = s.grid;
    g.place(Array.from(g.valid.keys()).filter(i => g.valid[i]));
    for (let p = 3; p < g.compacted.length; p++) g.compact(p);
    const camera = new T.PerspectiveCamera(72, 1.6, .1, 240);
    const player = new Player(camera, [], { width: g.width, depth: g.depth }, {
      x: -g.width / 2 + 1, z: -g.depth / 2 + 1, yaw: -Math.PI / 2, pitch,
    });
    try {
      const start = player.pose();
      for (let i = 0; i < 240 && s.phase !== 'complete'; i++) {
        player.update(1 / 60, { x: 0, z: -1, sprint: false }, DEFAULT_SETTINGS);
        const id = compactorTarget(g, player.position.x, player.position.z, player.yaw);
        s.tick(1 / 60, id, true, false, id >= 0);
      }
      expect(s.phase).toBe('complete');
      expect(player.position.x).toBeGreaterThan(start.x + 4);
      expect(s.money).toBe(0); expect(s.inventory).toBe(16);
      const finished = s.snapshot(), position = player.position.clone();
      for (let i = 0; i < 30; i++) {
        player.update(1 / 60, { x: 1, z: 0, sprint: false }, DEFAULT_SETTINGS);
        s.tick(1 / 60, 0, true, false, true);
      }
      expect(player.position.distanceTo(position)).toBeGreaterThan(1);
      expect(s.snapshot()).toEqual(finished);
      expect(player.yaw).toBe(start.yaw); expect(player.pitch).toBe(pitch);
    } finally { player.dispose(); }
  }
});
