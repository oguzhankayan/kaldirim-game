import { qaAimPoint } from './aim-point';
import type { GameSession } from '../game/session';
import type { Player } from '../render/player';
import type { SavedGame } from '../game/save';
import type { PerspectiveCamera } from 'three';
/** Imported only inside import.meta.env.DEV. Mutation fixtures are absent from release chunks. */
export function installQA(host: {
    session: () => GameSession;
    player: () => Player;
    camera: () => PerspectiveCamera;
    read: NonNullable<Window['__KALDIRIM_QA__']>['read'];
    save: () => void;
    rebuild: (pose?: SavedGame['pose']) => void;
    home: () => void;
}): void {
    window.__KALDIRIM_QA__ = {
        read: host.read,
        aim: index => { const c = qaAimPoint(host.session().grid, index), p = host.player(), dx = c.x - p.position.x, dz = c.z - p.position.z; p.yaw = Math.atan2(-dx, -dz); p.pitch = -Math.atan2(host.camera().position.y - .085, Math.hypot(dx, dz)); },
        nearby: () => { const s = host.session(), p = host.player(), out: number[] = []; for (let i = 0; i < s.grid.cells.length; i++) {
            const c = qaAimPoint(s.grid, i);
            if (!s.grid.cells[i] && s.grid.valid[i] && Math.hypot(c.x - p.position.x, c.z - p.position.z) < 1.6)
                out.push(i);
        } return out; },
        save: host.save,
        seedFinish: () => { const g = host.session().grid; g.place(Array.from(g.valid.keys()).filter(i => g.valid[i])); for (let i = 0; i < g.compacted.length; i++)
            g.compact(i); const id = g.valid.indexOf(1), patch = g.patchAt(id), c = qaAimPoint(g, id); g.compacted[patch] = 0; g.compactedCount--; host.rebuild({ x: c.x, z: c.z + .85, yaw: 0, pitch: -.9 }); },
        showcase: () => { const s = host.session(), g = s.grid; g.place(Array.from(g.valid.keys()).filter(i => g.valid[i] && ((i % g.spec.cols) < 28 || Math.floor(i / g.spec.cols) > g.spec.rows - 22))); s.money = g.count * g.spec.pay; host.rebuild(); host.home(); },
    };
}
