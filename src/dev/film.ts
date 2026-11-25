import { qaAimPoint } from './aim-point';
import type { GameSession } from '../game/session';
import type { Player } from '../render/player';
import type { PerspectiveCamera } from 'three';
import type { Axes } from '../render/input';

/**
 * Store-video film mode (dev only, `?film=1`). Frames are a function of time: the real
 * simulation runs in fixed 1/60 s steps under a scripted worker, so no pointer lock,
 * no wall clock and no human input. Driven by motion-kit through postMessage.
 */
export interface FilmHost {
    session: () => GameSession;
    player: () => Player;
    camera: () => PerspectiveCamera;
    /** Fresh job, pre-paved like the showcase, with the given tool leased and selected. */
    setup: (tool: number, place: (session: GameSession) => Pose) => void;
    /** One fixed simulation step with scripted input. */
    step: (dt: number, axes: Axes, held: boolean) => void;
    draw: () => void;
}
type Pose = { x: number; z: number; yaw: number; pitch: number };
/** `along`: where on the southern paved edge the shot starts (0 = west, 1 = east). */
interface Scene { start: number; end: number; tool: number; along: number; back: number; turn: number; lean: number }
const STEP = 1 / 60;
// Three beats on the same street: by hand, the six-stone clamp, the 48-stone K-48. Hard cuts.
const SCENES: Scene[] = [
    { start: 0, end: 6.5, tool: 0, along: .42, back: 1.3, turn: .35, lean: 0 },
    { start: 6.5, end: 13, tool: 1, along: .55, back: 2, turn: -.3, lean: .3 },
    { start: 13, end: 20, tool: 3, along: .35, back: 3.6, turn: .25, lean: .6 },
];
export const FILM_DURATION = 20;
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export function installFilm(host: FilmHost): void {
    let scene = -1, steps = 0, goal = -1, goalAge = 0;
    const pick = (lean: number): number => {
        const s = host.session(), g = s.grid, p = host.player(), cols = g.spec.cols, reach = s.reach * .85;
        let best = -1, bestScore = Infinity, near = -1, nearDist = Infinity;
        for (let i = 0; i < g.cells.length; i++) {
            if (g.cells[i] || !g.valid[i]) continue;
            const c = qaAimPoint(g, i), dx = c.x - p.position.x, dz = c.z - p.position.z, d = Math.hypot(dx, dz);
            if (d < nearDist) { nearDist = d; near = i; }
            if (d > reach || d < .7) continue;
            const turn = Math.abs(wrap(Math.atan2(-dx, -dz) - p.yaw));
            // Grow the paved edge row by row: cells touching finished work first, then the closest turn.
            const edge = (i % cols > 0 && g.cells[i - 1]) || g.cells[i - cols] || g.cells[i + cols] ? 0 : 1.6;
            const score = turn * 2.2 + edge + Math.abs(d - reach * (.55 + lean * .3)) * .5;
            if (score < bestScore) { bestScore = score; best = i; }
        }
        return best >= 0 ? best : near;
    };
    const tick = (lean: number): void => {
        const s = host.session(), g = s.grid, p = host.player(), cam = host.camera();
        s.inventory = s.capacity;
        if (goal < 0 || g.cells[goal] || goalAge > 2.5) { goal = pick(lean); goalAge = 0; }
        goalAge += STEP;
        let axes: Axes = { x: 0, z: 0, sprint: false }, held = false;
        if (goal >= 0) {
            const c = qaAimPoint(g, goal), dx = c.x - p.position.x, dz = c.z - p.position.z, d = Math.hypot(dx, dz);
            const yaw = Math.atan2(-dx, -dz), pitch = -Math.atan2(cam.position.y - .085, d);
            const k = Math.min(1, STEP * 6.5);
            p.yaw += wrap(yaw - p.yaw) * k; p.pitch += (pitch - p.pitch) * k;
            const err = Math.abs(wrap(yaw - p.yaw)) + Math.abs(pitch - p.pitch);
            if (d > s.reach * .9) axes = { x: 0, z: -.7, sprint: false };
            held = err < .06 && d <= s.reach;
        }
        host.step(STEP, axes, held);
    };
    const enter = (i: number): void => {
        const sc = SCENES[i]!; scene = i; steps = 0; goal = -1; goalAge = 0;
        host.setup(sc.tool, s => {
            // Stand on the open bed facing the finished work, `back` metres from its edge.
            const g = s.grid, cols = g.spec.cols, edges: { i: number; dir: [number, number] }[] = [];
            for (let i = 0; i < g.cells.length; i++) {
                if (!g.valid[i] || g.cells[i]) continue;
                const col = i % cols;
                const dir: [number, number] | null = g.cells[i + cols] ? [0, 1] : g.cells[i - cols] ? [0, -1] : col > 0 && g.cells[i - 1] ? [-1, 0] : col < cols - 1 && g.cells[i + 1] ? [1, 0] : null;
                // Only long straight edges read well on camera: open bed on the far side too.
                if (dir && g.valid[i - dir[1] * cols * 6 - dir[0] * 6] && !g.cells[i - dir[1] * cols * 6 - dir[0] * 6]) edges.push({ i, dir });
            }
            const e = edges[Math.floor(edges.length * sc.along)] ?? { i: 0, dir: [0, 1] as [number, number] }, c = g.center(e.i);
            const yaw = Math.atan2(-e.dir[0], -e.dir[1]) + sc.turn;
            return { x: c.x - e.dir[0] * sc.back, z: c.z - e.dir[1] * sc.back, yaw, pitch: -.8 };
        });
        // A seasoned crew: quicker hands, and the K-48 at its widest head.
        const s = host.session(); s.upgrades.speed = 3; if (sc.tool >= 2) s.upgrades.precision = 2;
        // Pre-roll so every cut lands mid-motion, never on a still frame.
        for (let n = 0; n < 45; n++) tick(sc.lean);
    };
    const render = (t: number): void => {
        const i = Math.max(0, SCENES.findIndex(s => t >= s.start && t < s.end)) || (t >= FILM_DURATION ? SCENES.length - 1 : 0);
        const sc = SCENES[i]!, target = Math.round((t - sc.start) / STEP);
        if (i !== scene || target < steps) enter(i);
        while (steps < target) { tick(sc.lean); steps++; }
        host.draw();
    };
    document.documentElement.classList.add('film');
    window.addEventListener('message', e => {
        const data = e.data as { film?: string; t?: number; id?: number };
        if (data?.film !== 'render' || typeof data.t !== 'number') return;
        render(data.t);
        requestAnimationFrame(() => requestAnimationFrame(() => (e.source as Window | null)?.postMessage({ film: 'done', id: data.id }, { targetOrigin: '*' })));
    });
    render(0);
    window.parent?.postMessage({ film: 'ready', duration: FILM_DURATION }, '*');
}
