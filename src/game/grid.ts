import { CELL_X, CELL_Z, PATCH, paverCourseShift, type LevelSpec } from './content';
import { siteMask, siteHoles } from './job-layouts';
export interface Cell {
    x: number;
    z: number;
}
export interface Footprint {
    indices: number[];
    key: string;
    ideal: number;
}
export class PavingGrid {
    readonly cells: Uint8Array;
    readonly valid: Uint8Array;
    readonly compacted: Uint8Array;
    readonly patchCols: number;
    readonly patchRows: number;
    readonly total: number;
    readonly patchValid: Uint8Array;
    readonly patchTotal: number;
    count = 0;
    compactedCount = 0;
    constructor(readonly spec: LevelSpec) {
        this.cells = new Uint8Array(spec.cols * spec.rows);
        this.valid = siteMask(spec);
        this.patchCols = Math.ceil(spec.cols / PATCH);
        this.patchRows = Math.ceil(spec.rows / PATCH);
        this.compacted = new Uint8Array(this.patchCols * this.patchRows);
        this.patchValid = new Uint8Array(this.compacted.length);
        for (let i = 0; i < this.valid.length; i++) if (this.valid[i]) this.patchValid[this.patchAt(i)] = 1;
        this.patchTotal = this.patchValid.reduce((a, b) => a + b, 0);
        // Empty garden/road patches are not a second job and cannot block completion.
        for (let p = 0; p < this.patchValid.length; p++) if (!this.patchValid[p]) this.compacted[p] = 1;
        this.total = this.valid.reduce((a, b) => a + b, 0);
    }
    holes() { return siteHoles(this.spec); }
    get width(): number { return this.spec.cols * CELL_X; }
    get depth(): number { return this.spec.rows * CELL_Z; }
    index(x: number, z: number): number { return x >= 0 && z >= 0 && x < this.spec.cols && z < this.spec.rows ? z * this.spec.cols + x : -1; }
    center(index: number): Cell { return { x: ((index % this.spec.cols) + 0.5) * CELL_X - this.width / 2, z: (Math.floor(index / this.spec.cols) + 0.5) * CELL_Z - this.depth / 2 }; }
    fromWorld(x: number, z: number): number {
        const row = Math.floor((z + this.depth / 2) / CELL_Z + 1e-6);
        let col = Math.floor((x - paverCourseShift(row) + this.width / 2) / CELL_X + 1e-6);
        // An odd course includes a half-cut filler on the western edge of each path.
        if (this.spec.layout && (row & 1) && x >= -this.width / 2 && x < this.width / 2) {
            const next = this.index(col + 1, row), here = this.index(col, row);
            if (next >= 0 && this.valid[next] && (here < 0 || !this.valid[here])) col++;
        }
        return this.index(col, row);
    }
    footprint(index: number, width: number, depth: number, rotated: boolean): Footprint {
        if (index < 0 || index >= this.cells.length)
            return { indices: [], key: '', ideal: 0 };
        const w = rotated ? depth : width, h = rotated ? width : depth;
        const x = index % this.spec.cols, z = Math.floor(index / this.spec.cols);
        const sx = Math.floor(x / w) * w, sz = Math.floor(z / h) * h;
        const indices: number[] = [];
        let ideal = 0;
        for (let dz = 0; dz < h; dz++)
            for (let dx = 0; dx < w; dx++) {
                const i = this.index(sx + dx, sz + dz);
                if (i >= 0 && this.valid[i]) {
                    ideal++;
                    if (!this.cells[i])
                        indices.push(i);
                }
            }
        return { indices, key: `${sx}:${sz}:${w}:${h}`, ideal };
    }
    place(indices: readonly number[]): number[] {
        const changed: number[] = [];
        for (const i of indices)
            if (Number.isInteger(i) && i >= 0 && i < this.cells.length && this.valid[i] && !this.cells[i]) {
                this.cells[i] = 1;
                this.count++;
                changed.push(i);
            }
        return changed;
    }
    patchAt(index: number): number { if (index < 0 || index >= this.cells.length)
        return -1; return Math.floor(Math.floor(index / this.spec.cols) / PATCH) * this.patchCols + Math.floor((index % this.spec.cols) / PATCH); }
    compact(patch: number): boolean { if (!Number.isInteger(patch) || patch < 0 || patch >= this.compacted.length || !this.patchValid[patch] || this.compacted[patch] || this.count !== this.total)
        return false; this.compacted[patch] = 1; this.compactedCount++; return true; }
    get finished(): boolean { return this.count === this.total && this.compactedCount === this.patchTotal; }
    nearestUnfinished(x: number, z: number, finishing = false): number {
        let best = -1, distance = Infinity;
        for (let i = 0; i < this.cells.length; i++) {
            if (!this.valid[i] || (!finishing && this.cells[i]) || (finishing && this.compacted[this.patchAt(i)]))
                continue;
            const c = this.center(i), d = (c.x - x) ** 2 + (c.z - z) ** 2;
            if (d < distance) {
                distance = d;
                best = i;
            }
        }
        return best;
    }
    restore(cells: number[], patches: number[]): boolean {
        if (cells.length !== this.cells.length || patches.length !== this.compacted.length || cells.some((v, i) => (v !== 0 && v !== 1) || (v === 1 && !this.valid[i])) || patches.some(v => v !== 0 && v !== 1))
            return false;
        const count = cells.reduce((a, b) => a + b, 0), finished = patches.reduce((a, b, i) => a + (this.patchValid[i] ? b : 0), 0);
        if (finished && count !== this.total)
            return false;
        this.cells.set(cells);
        this.compacted.set(patches);
        for (let p = 0; p < this.patchValid.length; p++) if (!this.patchValid[p]) this.compacted[p] = 1;
        this.count = count;
        this.compactedCount = finished;
        return true;
    }
}
