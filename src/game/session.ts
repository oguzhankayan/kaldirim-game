import { LEVELS, TOOLS, UPGRADES, type UpgradeId, type LevelSpec } from './content';
import { PavingGrid, type Footprint } from './grid';
import { jobSpec, type JobRevision } from './job-layouts';
import { toolPrice, upgradePrice } from './economy';
export type Phase = 'laying' | 'finishing' | 'complete';
export interface Progress {
    unlocked: number;
    completed: string[];
    achievements: string[];
    bestTimes: Record<string, number>;
    totalStones: number;
}
export interface SessionSnapshot {
    level: number;
    jobRevision?: JobRevision;
    money: number;
    inventory: number;
    unlockedTools: number;
    selectedTool: number;
    upgrades: Record<UpgradeId, number>;
    seconds: number;
    cells: number[];
    patches: number[];
    combo: number;
    noticeMask?: number;
}
export interface WorkResult {
    placed: number[];
    earned: number;
    compacted: number;
    achievement?: string;
}
const zeroUpgrades = (): Record<UpgradeId, number> => ({ capacity: 0, speed: 0, logistics: 0, reach: 0, precision: 0 });
export class GameSession {
    readonly grid: PavingGrid;
    money = 0;
    inventory = 16;
    unlockedTools = 0;
    selectedTool = 0;
    upgrades = zeroUpgrades();
    seconds = 0;
    combo = 0;
    noticeMask = 0;
    workProgress = 0;
    refillProgress = 0;
    refilling = false;
    private targetKey = '';
    private inputWasDown = false;
    constructor(readonly level: number, readonly progress: Progress = { unlocked: 0, completed: [], achievements: [], bestTimes: {}, totalStones: 0 }, override?: LevelSpec, readonly jobRevision: JobRevision = 1) { this.grid = new PavingGrid(override ?? jobSpec(level, jobRevision)); }
    static newJob(level: number, progress?: Progress): GameSession { return new GameSession(level, progress, undefined, 2); }
    get phase(): Phase { return this.grid.finished ? 'complete' : this.grid.count === this.grid.total ? 'finishing' : 'laying'; }
    get tool() { return TOOLS[this.selectedTool]!; }
    toolPrice(tier: number): number { return toolPrice(tier, this.grid.total * this.grid.spec.pay, this.grid.spec.pay, this.jobRevision); }
    upgradePrice(id: UpgradeId, tier = this.upgrades[id]): number | undefined { return upgradePrice(id, tier, this.grid.total * this.grid.spec.pay, this.grid.spec.pay, this.jobRevision); }
    get recordKey(): string { return this.jobRevision === 1 ? this.grid.spec.id : `${this.grid.spec.id}@2`; }
    /** UI acknowledgement only; never awards money or changes tool ownership. Saved per job. */
    claimEquipmentNotice(): number | null {
        const next = this.unlockedTools + 1;
        if (this.phase !== 'laying' || this.refilling || !TOOLS[next] || this.money < this.toolPrice(next) || (this.noticeMask & (1 << next))) return null;
        this.noticeMask |= 1 << next; return next;
    }
    get capacity(): number { return Math.round(TOOLS[this.unlockedTools]!.capacity * (1 + this.upgrades.capacity * 0.8)); }
    get dwell(): number { return this.phase === 'finishing' ? (this.jobRevision === 2 ? .18 : .26) : this.tool.dwell * Math.pow(0.85, this.upgrades.speed); }
    get reach(): number { return (this.phase === 'finishing' ? 6 : this.tool.reach) + this.upgrades.reach * 0.55; }
    get refillDuration(): number { return Math.max(0.45, 1.6 - this.upgrades.logistics * 0.26); }
    get shape(): {
        width: number;
        depth: number;
    } { const bonus = this.selectedTool >= 2 ? this.upgrades.precision : 0; return { width: this.tool.width + bonus * 2, depth: this.tool.depth + bonus }; }
    selectTool(tier: number): boolean { if (!Number.isInteger(tier) || tier < 0 || tier > this.unlockedTools)
        return false; this.selectedTool = tier; this.cancelWork(); return true; }
    buyTool(tier: number): boolean {
        const t = TOOLS[tier];
        if (this.phase !== 'laying' || !t || tier !== this.unlockedTools + 1 || this.money < this.toolPrice(tier))
            return false;
        this.money -= this.toolPrice(tier);
        this.unlockedTools = tier;
        this.selectedTool = tier;
        this.inventory = this.capacity;
        this.cancelWork();
        if (tier === 3)
            this.unlock('machine');
        return true;
    }
    buyUpgrade(id: UpgradeId): boolean {
        const entry = UPGRADES.find(u => u.id === id);
        if (!entry || this.phase !== 'laying' || (id === 'precision' && this.unlockedTools < 2))
            return false;
        const cost = this.upgradePrice(id);
        if (cost === undefined || this.money < cost)
            return false;
        this.money -= cost;
        this.upgrades[id]++;
        this.cancelWork();
        return true;
    }
    canRefill(nearSupply: boolean): boolean { return this.phase === 'laying' && !this.refilling && this.inventory < this.capacity && (nearSupply || this.upgrades.logistics > 0); }
    startRefill(nearSupply: boolean): boolean { if (!this.canRefill(nearSupply))
        return false; this.refilling = true; this.refillProgress = 0; this.cancelWork(); return true; }
    cancelWork(): void { this.targetKey = ''; this.workProgress = 0; this.inputWasDown = false; }
    target(index: number, rotated: boolean): Footprint { const s = this.shape; return this.grid.footprint(index, s.width, s.depth, rotated); }
    /** A fresh target starts a new dwell. Frame spikes cannot place multiple groups. */
    tick(dt: number, index: number, held: boolean, rotated: boolean, reachable: boolean): WorkResult {
        const out: WorkResult = { placed: [], earned: 0, compacted: -1 };
        if (!Number.isFinite(dt) || dt <= 0 || this.phase === 'complete')
            return out;
        dt = Math.min(dt, 0.05);
        this.seconds += dt;
        if (this.refilling) {
            this.refillProgress += dt;
            if (this.refillProgress >= this.refillDuration) {
                this.inventory = this.capacity;
                this.refilling = false;
                this.refillProgress = 0;
            }
            return out;
        }
        if (!held || !reachable || !Number.isInteger(index) || index < 0 || index >= this.grid.cells.length || !this.grid.valid[index]) {
            this.cancelWork();
            return out;
        }
        const finishing = this.phase === 'finishing';
        const footprint = this.target(index, rotated);
        const patch = finishing ? this.grid.patchAt(index) : -1;
        const key = finishing ? `patch:${patch}` : footprint.key;
        if ((!finishing && (!footprint.indices.length || !this.inventory)) || (finishing && (patch < 0 || this.grid.compacted[patch]))) {
            this.cancelWork();
            return out;
        }
        if (key !== this.targetKey || !this.inputWasDown) {
            this.targetKey = key;
            if (!(finishing && this.jobRevision === 2 && this.inputWasDown)) this.workProgress = 0;
            this.inputWasDown = true;
        }
        this.workProgress += dt;
        if (this.workProgress + 1e-8 < this.dwell)
            return out;
        this.workProgress = 0;
        this.targetKey = '';
        this.inputWasDown = false;
        if (finishing) {
            if (this.grid.compact(patch))
                out.compacted = patch;
        }
        else {
            out.placed = this.grid.place(footprint.indices.slice(0, this.inventory));
            this.inventory -= out.placed.length;
            out.earned = out.placed.length * this.grid.spec.pay;
            this.money += out.earned;
            this.progress.totalStones += out.placed.length;
            this.combo = out.placed.length === footprint.ideal ? this.combo + 1 : 0;
            if (out.placed.length)
                this.unlock('first');
            if (this.progress.totalStones >= 100)
                this.unlock('hundred');
            if (this.combo >= 50)
                this.unlock('tidy');
        }
        if (this.grid.finished)
            this.complete();
        return out;
    }
    private unlock(id: string): void { if (!this.progress.achievements.includes(id))
        this.progress.achievements.push(id); }
    complete(): boolean {
        if (!this.grid.finished)
            return false;
        const id = this.grid.spec.id;
        if (!this.progress.completed.includes(id))
            this.progress.completed.push(id);
        this.progress.unlocked = Math.min(LEVELS.length - 1, Math.max(this.progress.unlocked, this.level + 1));
        this.progress.bestTimes[this.recordKey] = Math.min(this.progress.bestTimes[this.recordKey] ?? Infinity, this.seconds);
        this.unlock('first-job');
        if (LEVELS.every(l => this.progress.completed.includes(l.id)))
            this.unlock('master');
        return true;
    }
    snapshot(): SessionSnapshot { return { level: this.level, jobRevision: this.jobRevision, money: this.money, inventory: this.inventory, unlockedTools: this.unlockedTools, selectedTool: this.selectedTool, upgrades: { ...this.upgrades }, seconds: this.seconds, cells: Array.from(this.grid.cells), patches: Array.from(this.grid.compacted), combo: this.combo, noticeMask: this.noticeMask }; }
    static restore(s: SessionSnapshot, progress: Progress): GameSession | null {
        if (!s || !Number.isInteger(s.level) || !LEVELS[s.level] || s.level > progress.unlocked)
            return null;
        if (![s.money, s.inventory, s.seconds, s.combo].every(x => Number.isFinite(x) && x >= 0) || !Number.isSafeInteger(s.money) || !Number.isSafeInteger(s.inventory) || !Number.isSafeInteger(s.combo) || s.seconds > 1e9)
            return null;
        if (!Number.isInteger(s.unlockedTools) || s.unlockedTools < 0 || s.unlockedTools >= TOOLS.length || !Number.isInteger(s.selectedTool) || s.selectedTool < 0 || s.selectedTool > s.unlockedTools)
            return null;
        if (!s.upgrades || UPGRADES.some(u => !Number.isInteger(s.upgrades[u.id]) || s.upgrades[u.id] < 0 || s.upgrades[u.id] > u.costs.length))
            return null;
        if (!Array.isArray(s.cells) || !Array.isArray(s.patches))
            return null;
        if (s.jobRevision !== undefined && s.jobRevision !== 1 && s.jobRevision !== 2) return null;
        const game = new GameSession(s.level, progress, undefined, s.jobRevision ?? 1);
        if (!game.grid.restore(s.cells, s.patches))
            return null;
        if (s.noticeMask !== undefined && (!Number.isInteger(s.noticeMask) || s.noticeMask < 0 || s.noticeMask > 14 || (s.noticeMask & 1))) return null;
        game.noticeMask = s.noticeMask ?? 0;
        game.money = s.money;
        game.unlockedTools = s.unlockedTools;
        game.selectedTool = s.selectedTool;
        game.upgrades = { ...s.upgrades };
        if (s.inventory > game.capacity || s.money > game.grid.total * game.grid.spec.pay)
            return null;
        game.inventory = s.inventory;
        game.seconds = s.seconds;
        game.combo = s.combo;
        return game;
    }
}
