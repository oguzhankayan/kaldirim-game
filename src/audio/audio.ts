import { seeded } from '../game/content';
/** Entire sound palette is synthesized; no samples or third-party music. */
export class GameAudio {
    private ctx: AudioContext | null = null;
    private master: GainNode | null = null;
    private ambientGain: GainNode | null = null;
    private noise: AudioBuffer | null = null;
    private volume = .65;
    private enabled = true;
    private footTime = 0;
    private birdTime = 4;
    private rand = seeded(8257);
    private workGain: GainNode | null = null;
    private workOsc: OscillatorNode | null = null;
    private workMode = -1;
    async start(): Promise<void> {
        if (!this.ctx) {
            const C = window.AudioContext;
            if (!C)
                return;
            this.ctx = new C();
            this.master = this.ctx.createGain();
            this.master.gain.value = this.volume;
            this.master.connect(this.ctx.destination);
            this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
            const data = this.noise.getChannelData(0);
            let last = 0;
            for (let i = 0; i < data.length; i++) {
                last = (last + .02 * (this.rand() * 2 - 1)) / 1.02;
                data[i] = last * 3.5;
            }
            this.ambientGain = this.ctx.createGain();
            this.ambientGain.gain.value = this.enabled ? .08 : 0;
            const source = this.ctx.createBufferSource();
            source.buffer = this.noise;
            source.loop = true;
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 650;
            source.connect(filter);
            filter.connect(this.ambientGain);
            this.ambientGain.connect(this.master);
            source.start();
            this.workGain = this.ctx.createGain(); this.workGain.gain.value = 0;
            this.workOsc = this.ctx.createOscillator(); this.workOsc.type = 'triangle'; this.workOsc.frequency.value = 65;
            this.workOsc.connect(this.workGain); this.workGain.connect(this.master); this.workOsc.start();
        }
        await this.ctx.resume().catch(() => { });
    }
    configure(volume: number, ambient: boolean): void { this.volume = volume; this.enabled = ambient; if (this.master)
        this.master.gain.value = volume; if (this.ambientGain)
        this.ambientGain.gain.value = ambient ? .08 : 0; }
    pause(): void { this.workMode = -1; if (this.ctx && this.workGain) this.workGain.gain.setTargetAtTime(0, this.ctx.currentTime, .02); void this.ctx?.suspend(); }
    private tone(frequency: number, duration: number, gain: number, type: OscillatorType = 'sine', end?: number, delay = 0): void { if (!this.ctx || !this.master || this.ctx.state !== 'running')
        return; const c = this.ctx, t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(frequency, t); if (end)
        o.frequency.exponentialRampToValueAtTime(end, t + duration); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(.0002, gain), t + .005); g.gain.exponentialRampToValueAtTime(.0001, t + duration); o.connect(g); g.connect(this.master); o.start(t); o.stop(t + duration + .02); o.onended = () => { o.disconnect(); g.disconnect(); }; }
    private burst(gain: number, duration: number, frequency: number, delay = 0): void { if (!this.ctx || !this.master || !this.noise || this.ctx.state !== 'running')
        return; const c = this.ctx, t = c.currentTime + delay, s = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter(); s.buffer = this.noise; f.type = 'highpass'; f.frequency.value = frequency; g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(.0001, t + duration); s.connect(f); f.connect(g); g.connect(this.master); s.start(t, this.rand()); s.stop(t + duration); s.onended = () => { s.disconnect(); f.disconnect(); g.disconnect(); }; }
    work(tier: number, running: boolean, finishing: boolean): void {
        const mode = running ? finishing ? 4 : tier : -1;
        if (!this.ctx || !this.workGain || !this.workOsc || this.workMode === mode) return;
        this.workMode = mode; const t = this.ctx.currentTime;
        this.workGain.gain.cancelScheduledValues(t);
        this.workGain.gain.setTargetAtTime(mode < 1 ? 0 : mode === 4 ? .018 : .008 + mode * .004, t, .035);
        this.workOsc.frequency.setTargetAtTime(mode === 4 ? 58 : 85 - Math.max(0, mode) * 12, t, .05);
    }
    ready(): void { this.tone(660, .15, .045); this.tone(880, .24, .038, 'sine', undefined, .12); }
    motif(): void { this.tone(392, .14, .04); this.tone(587, .21, .03, 'sine', undefined, .09); }
    stone(count = 1, tier = count > 1 ? 1 : 0): void {
        if (tier === 0) { this.tone(195 + this.rand() * 25, .1, .13, 'triangle', 90); this.burst(.32, .12, 1300); return; }
        // Bounded layers, not an AudioNode for each of 126 stones.
        this.tone(tier === 3 ? 78 : 115, .2, .13, 'triangle', 48);
        this.burst(.34, .14, tier === 3 ? 500 : 950);
        if (tier === 1) this.tone(780, .08, .025, 'sine', 420, .09);
        else if (tier === 2) { this.burst(.2, .09, 1100, .05); this.burst(.16, .08, 1200, .10); }
        else { this.burst(.22, .19, 350, .04); this.tone(135, .12, .07, 'triangle', 62, .07); }
    }
    compact(): void { this.burst(.65, .25, 180); this.tone(55, .25, .09, 'sawtooth', 45); }
    refill(): void { this.burst(.4, .22, 800); this.tone(430, .09, .07, 'triangle'); }
    buy(): void { [392, 494, 587].forEach((n, i) => this.tone(n, .2, .065, 'sine', undefined, i * .07)); }
    complete(): void { [330, 392, 494, 659].forEach((n, i) => this.tone(n, .5, .09, 'sine', undefined, i * .14)); }
    click(): void { this.tone(500, .04, .035, 'triangle', 350); }
    update(dt: number, moving: boolean, onStone: boolean): void { this.footTime -= dt; this.birdTime -= dt; if (moving && this.footTime <= 0) {
        this.burst(onStone ? .22 : .11, .1, onStone ? 550 : 1300);
        this.tone(onStone ? 100 : 85, .07, .06, 'sine', 55);
        this.footTime = .43;
    } if (this.enabled && this.birdTime <= 0) {
        this.tone(2100, .13, .018, 'sine', 3100);
        this.tone(2500, .1, .012, 'sine', 1900, .16);
        this.birdTime = 5 + this.rand() * 7;
    } }
    dispose(): void { this.workOsc?.stop(); this.workOsc?.disconnect(); this.workGain?.disconnect(); void this.ctx?.close(); this.ctx = null; this.workGain = null; this.workOsc = null; }
}
