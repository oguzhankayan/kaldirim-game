import './ui/style.css';
import * as T from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { LEVELS, UPGRADES, type UpgradeId } from './game/content';
import { MotifTracker } from './game/motifs';
import { PlaytestLog } from './game/playtest';
import { compactorTarget } from './game/compactor';
import { CompletionView } from './render/completion-view';
import { GameSession } from './game/session';
import { DEFAULT_SETTINGS, SaveStore, decodeSave, encodeSave, validateSettings, type Settings, type SavedGame, type StorageLike } from './game/save';
import { Materials } from './render/materials';
import { WorldView } from './render/world';
import { Player, initPhysics } from './render/player';
import { ViewModel } from './render/viewmodel';
import { Input } from './render/input';
import { GameUI, type Panel } from './ui/ui';
import { BirdokuPromo } from './ui/birdoku-promo';
import { GameAudio } from './audio/audio';
import { Portal } from './platform/portal';
import { track } from './platform/events';
import { FrameMeter, drawingRatio, type FrameSummary } from './render/performance';
interface Diagnostics {
    stones: number;
    total: number;
    money: number;
    inventory: number;
    capacity: number;
    tool: number;
    phase: string;
    unlocked: number;
    level: number;
    active: boolean;
    target: number;
    progress: number;
    position: { x: number; z: number };
    fps: number;
    frames: FrameSummary;
    renderScale: number;
    antialias: boolean;
    renderer: string;
    drawCalls: number;
    triangles: number;
    geometries: number;
}
declare global {
    interface Window {
        __KALDIRIM_QA__?: {
            read: () => Diagnostics;
            aim: (index: number) => void;
            nearby: () => number[];
            save: () => void;
            seedFinish: () => void;
            showcase: () => void;
        };
    }
}
class KaldirimGame {
    private renderer: T.WebGLRenderer;
    private scene = new T.Scene();
    private camera = new T.PerspectiveCamera(72, 1, .1, 240);
    private viewScene = new T.Scene();
    private viewCamera = new T.PerspectiveCamera(55, 1, .03, 8);
    private materials = new Materials();
    private world!: WorldView;
    private motifs!: MotifTracker;
    private playtest = new PlaytestLog();
    private completion = new CompletionView();
    private touring = false;
    private cleanupShown = false;
    private motifSoundAt = -10;
    private player!: Player;
    private viewModel: ViewModel;
    private sun = new T.DirectionalLight('#fff0d5', 3.0);
    private session: GameSession;
    private input: Input;
    private ui: GameUI;
    private settings: Settings;
    private store: SaveStore;
    private audio = new GameAudio();
    private active = false;
    private started = false;
    /** False while another tab owns the save; this tab may look but not play or write. */
    private ownsSave = true;
    private rotated = false;
    private target = -1;
    private reachable = false;
    private raycaster = new T.Raycaster();
    private plane = new T.Plane(new T.Vector3(0, 1, 0), -.085);
    private hit = new T.Vector3();
    private aimCenter = new T.Vector2();
    private time = 0;
    private lastTime = performance.now();
    private accumulator = 0;
    private saveTimer = 0;
    private fps = 0;
    private meter = new FrameMeter();
    private frameStats = this.meter.summary();
    private statsAt = 0;
    private pendingSave: number | null = null;
    private lastSaveWarning: string | null = null;
    private graphicsLost = false;
    private rendererName = 'Unknown';
    private showStats = false;
    private dead = false;
    private sky: T.Mesh;
    private frameId = 0;
    private environment: T.Texture;
    private environmentTarget: T.WebGLRenderTarget;
    constructor(private root: HTMLElement, private portal: Portal) {
        let storage: StorageLike | null = portal.storage;
        if (!storage) {
            try { storage = window.localStorage; }
            catch { /* Export remains usable in private/restricted browsers. */ }
        }
        this.store = new SaveStore(storage);
        const saved = this.store.load();
        track('first-open');
        const defaultSettings = { ...DEFAULT_SETTINGS, reducedMotion: matchMedia('(prefers-reduced-motion:reduce)').matches };
        if (import.meta.env.VITE_PLATFORM === 'crazygames') defaultSettings.language = 'en';
        this.settings = this.store.loadSettings() ?? saved?.settings ?? defaultSettings;
        if (matchMedia('(pointer:coarse)').matches && !saved) this.settings.quality = 'medium';
        this.session = saved ? GameSession.restore(saved.session, saved.progress) ?? GameSession.newJob(0) : GameSession.newJob(0);
        this.started = Boolean(saved);
        this.renderer = new T.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
        this.renderer.domElement.id = 'game';
        this.renderer.domElement.tabIndex = 0;
        root.prepend(this.renderer.domElement);
        this.renderer.outputColorSpace = T.SRGBColorSpace;
        this.renderer.toneMapping = T.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.12;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = T.PCFSoftShadowMap;
        this.renderer.shadowMap.autoUpdate = false;
        this.renderer.shadowMap.needsUpdate = true;
        this.materials.setAnisotropy(this.renderer.capabilities.getMaxAnisotropy());
        const gl = this.renderer.getContext(), info = gl.getExtension('WEBGL_debug_renderer_info');
        this.rendererName = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
        this.renderer.autoClear = false;
        this.renderer.info.autoReset = false;
        this.scene.add(new T.HemisphereLight('#e5eee2', '#69735a', 1.8));
        this.scene.add(this.sun);
        this.scene.add(this.sun.target);
        this.sun.castShadow = true;
        this.sun.shadow.bias = -.00035;
        this.sun.shadow.normalBias = .025;
        const room = new RoomEnvironment(), pmrem = new T.PMREMGenerator(this.renderer);
        this.environmentTarget = pmrem.fromScene(room, .02);
        this.environment = this.environmentTarget.texture;
        room.dispose(); pmrem.dispose();
        this.scene.environment = this.environment;
        this.scene.environmentIntensity = .25;
        const skyMaterial = new T.ShaderMaterial({ side: T.BackSide, depthWrite: false, uniforms: { top: { value: new T.Color('#86b9d0') }, bottom: { value: new T.Color('#e8e0c9') } }, vertexShader: 'varying vec3 vPos; void main(){vPos=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}', fragmentShader: 'uniform vec3 top;uniform vec3 bottom;varying vec3 vPos;void main(){float h=clamp(normalize(vPos).y,0.,1.);gl_FragColor=vec4(mix(bottom,top,pow(h,.55)),1.);#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}' });
        skyMaterial.fragmentShader = skyMaterial.fragmentShader.replace(';#include', ';\n#include');
        this.sky = new T.Mesh(new T.SphereGeometry(200, 24, 12), skyMaterial);
        this.scene.add(this.sky);
        this.viewScene.add(new T.HemisphereLight('#fff4db', '#6d7661', 2.7));
        const viewLight = new T.DirectionalLight('#ffe8c1', 2.2);
        viewLight.position.set(-2, 4, 1);
        this.viewScene.add(viewLight);
        this.viewScene.environment = this.environment;
        this.viewScene.environmentIntensity = .3;
        this.viewModel = new ViewModel(this.materials);
        this.viewScene.add(this.viewModel.group);
        this.input = new Input(this.renderer.domElement);
        this.input.onLook = (dx, dy) => { if (this.active) this.player.look(dx, dy, this.settings); };
        this.input.onUnlock = () => { if (this.active) this.pause(); };
        this.input.onLockFailure = () => { this.pause(); this.ui.toast(this.ui.t('Fare kontrolü açılamadı. Oyuna devam düğmesini yeniden kullan.', 'Pointer lock was blocked. Use Continue again.')); };
        this.input.onKey = code => this.key(code);
        this.ui = new GameUI(root, { play: () => this.play(), fresh: () => this.started ? this.fresh() : this.play(), pause: () => this.pause(), panel: p => this.openPanel(p), buyTool: i => this.buyTool(i), buyUpgrade: id => this.buyUpgrade(id), selectTool: i => { this.session.selectTool(i); this.ui.show('shop'); this.persist(); }, level: i => this.changeLevel(i), settings: s => this.setSettings(s), refill: () => this.refill(), rotate: () => { this.rotated = !this.rotated; this.session.cancelWork(); }, hint: () => this.hint(), reveal: () => this.reveal(), results: () => this.results(), tour: () => this.tour(), exportSave: () => this.exportSave(), importSave: s => this.importSave(s), screenshot: () => this.screenshot() }, this.settings);
        this.input.bindTouch(this.ui.touchRoot);
        this.ui.hasSave = this.started;
        this.makeWorld(saved?.pose);
        this.ui.show('home');
        if (import.meta.env.PROD && import.meta.env.VITE_PLATFORM !== 'crazygames') new BirdokuPromo(root, storage).showFirstOpen(this.settings.language);
        this.applyQuality();
        window.addEventListener('resize', () => this.resize());
        window.addEventListener('pagehide', () => this.persist());
        document.addEventListener('visibilitychange', () => { if (document.hidden) this.persist(); });
        this.renderer.domElement.addEventListener('webglcontextlost', e => {
            e.preventDefault(); this.graphicsLost = true; this.pause();
            this.ui.toast(this.ui.t('Grafik bağlantısı kesildi. Oyun duraklatıldı; kayıt durumunu kontrol et.', 'Graphics context lost. Game paused; check the save status.'));
        });
        this.renderer.domElement.addEventListener('webglcontextrestored', () => {
            this.graphicsLost = false; this.applyQuality(); this.lastTime = performance.now();
            this.ui.toast(this.ui.t('Grafikler geri geldi. Hazır olduğunda devam edebilirsin.', 'Graphics restored. Continue when you are ready.'));
        });
        if (import.meta.env.DEV && new URLSearchParams(location.search).get('qa') === '1') {
            void import('./dev/qa').then(({ installQA }) => installQA({ session: () => this.session, player: () => this.player, camera: () => this.camera, read: () => this.diagnostics(), save: () => this.persist(), rebuild: pose => this.makeWorld(pose), home: () => this.openPanel('home') }));
        }
        if (import.meta.env.DEV && new URLSearchParams(location.search).has('film')) this.startFilm();
        this.resize();
        this.frameId = requestAnimationFrame(t => this.frame(t));
        document.querySelector('#boot')?.remove();
        if (this.store.warning) this.ui.toast(this.ui.t('Kayıt uyarısı: yedekleme için Ayarlar’ı kontrol et.', 'Save warning: check Settings and export a backup.'));
        this.claimSave();
        this.portal.onMuteChange = () => this.audio.configure(this.volume(), this.settings.ambient);
        this.audio.configure(this.volume(), this.settings.ambient);
        this.portal.loaded();
    }
    /** Dev-only store-video mode: scripted, frame-stepped gameplay with no saves, audio or HUD. */
    private startFilm(): void {
        if (!import.meta.env.DEV) return;
        this.ownsSave = false; cancelAnimationFrame(this.frameId); this.dead = true;
        this.settings = { ...this.settings, language: 'en', quality: 'high', headBob: false, reducedMotion: false };
        this.applyQuality();
        void import('./dev/film').then(({ installFilm }) => installFilm({
            session: () => this.session, player: () => this.player, camera: () => this.camera,
            setup: (tool, place) => {
                const s = GameSession.newJob(0), g = s.grid;
                // Same lived-in start as the home screen: a finished western strip and southern band.
                g.place(Array.from(g.valid.keys()).filter(i => g.valid[i] && ((i % g.spec.cols) < 28 || Math.floor(i / g.spec.cols) > g.spec.rows - 22)));
                s.unlockedTools = tool; s.selectTool(tool); s.money = g.count * g.spec.pay; s.inventory = s.capacity;
                this.session = s; this.makeWorld(place(s)); this.ui.show(null); this.active = true; this.rotated = false; this.time = 0;
                this.player.render(1, this.settings); this.aim();
            },
            step: (dt, axes, held) => {
                this.time += dt;
                this.input.axes = () => axes; this.input.held = held;
                this.fixedUpdate(dt);
                this.player.render(1, this.settings); this.aim();
                this.world.setTarget(this.target, this.reachable, this.rotated);
                this.world.update(dt, this.time, this.player.position);
                this.viewModel.update(dt, this.time, this.session.selectedTool, this.session.phase, this.session.workProgress / this.session.dwell, this.player.speed > .1, this.session.inventory);
            },
            draw: () => { this.renderer.info.reset(); this.render(); },
        }));
    }
    private makeWorld(pose?: SavedGame['pose']): void {
        this.completion.cancel(); this.touring = false; this.cleanupShown = false;
        this.motifs = new MotifTracker(this.session.grid); this.playtest = new PlaytestLog(); this.playtest.record('job-open', this.session); track('job-start', this.session.level);
        this.player?.dispose(); this.world?.dispose();
        this.world = new WorldView(this.session, this.materials);
        this.scene.add(this.world.group);
        const grid = this.session.grid;
        const startPose = !pose && grid.spec.layout === 'courtyard' ? { x: -grid.width / 2 + 8, z: -grid.depth / 2 + 1.5, yaw: 0, pitch: -.9 } : pose;
        this.player = new Player(this.camera, this.world.solids, { width: grid.width, depth: grid.depth }, startPose);
        this.player.update(1 / 60, { x: 0, z: 0, sprint: false }, this.settings);
        this.scene.fog = new T.Fog(this.session.grid.spec.sky, 45, 155);
        const sm = this.sky.material as T.ShaderMaterial;
        sm.uniforms['top']!.value.set(this.session.grid.spec.sky);
        this.sun.position.set(-25, 35 * this.session.grid.spec.sun + 10, 18);
        this.sun.target.position.set(0, 0, 0);
        const shadowSize = Math.max(grid.width, grid.depth) / 2 + 18;
        this.sun.shadow.camera.left = -shadowSize; this.sun.shadow.camera.right = shadowSize;
        this.sun.shadow.camera.top = shadowSize; this.sun.shadow.camera.bottom = -shadowSize;
        this.sun.shadow.camera.near = 1; this.sun.shadow.camera.far = 180;
        this.sun.shadow.camera.updateProjectionMatrix();
        this.renderer.shadowMap.needsUpdate = true;
        this.world.reducedMotion = this.settings.reducedMotion;
        this.ui.attach(this.session);
        this.rotated = false; this.target = -1; this.reachable = false;
        this.accumulator = 0; this.saveTimer = 0;
    }
    private play(): void {
        if (this.graphicsLost) return;
        if (!this.ownsSave) {
            this.ui.toast(this.ui.t('Oyun başka bir sekmede açık. İlerlemeni korumak için orada devam et veya o sekmeyi kapatıp bunu yenile.', 'The game is open in another tab. Continue there, or close it and reload this one, so no progress is lost.'));
            return;
        }
        if (this.session.phase === 'complete' && !this.touring) { this.results(); return; }
        this.started = true; this.ui.hasSave = true; this.ui.show(null); this.active = true;
        this.meter.reset(); this.frameStats = this.meter.summary(); this.input.clear(); this.session.cancelWork();
        this.player.render(1, this.settings); this.aim(); this.updateHud();
        this.accumulator = 0; this.lastTime = performance.now();
        this.audio.configure(this.volume(), this.settings.ambient); void this.audio.start();
        this.portal.start(); void this.input.lock(); this.persist();
    }
    private pause(): void { if (this.active) this.openPanel(this.session.phase === 'complete' ? 'complete' : 'pause'); }
    private openPanel(panel: Panel): void {
        if (panel === null) { this.play(); return; }
        this.completion.cancel(); this.world.inspectionBefore(false);
        this.active = false; this.session.cancelWork(); this.input.unlock(); this.audio.pause(); this.portal.stop(); this.persist(); this.ui.show(panel);
    }
    private reveal(): void {
        if (this.session.phase !== 'complete' || this.graphicsLost) return;
        this.touring = false; this.openPanel('reveal');
        this.completion.begin(this.camera, this.session.grid.width, this.session.grid.depth, this.settings.reducedMotion);
    }
    private results(): void { this.completion.cancel(); this.world.inspectionBefore(false); this.touring = false; this.openPanel('complete'); }
    private tour(): void { if (this.session.phase !== 'complete') return; this.completion.cancel(); this.world.inspectionBefore(false); this.touring = true; this.play(); }
    private fresh(): void { this.active = false; this.input.unlock(); this.store.clear(); this.session = GameSession.newJob(0); this.makeWorld(); this.play(); }
    private changeLevel(level: number): void {
        if (!Number.isInteger(level) || !LEVELS[level] || level > this.session.progress.unlocked || this.session.phase !== 'complete') return;
        this.active = false; this.input.unlock(); this.session = GameSession.newJob(level, this.session.progress); this.makeWorld(); this.persist();
        // Moving between jobs is the game's natural break: the only place a portal ad may appear.
        // The portal itself enforces its minimum interval; standalone builds skip straight to play.
        if (!this.portal.available) { this.play(); return; }
        void this.portal.requestAd('midgame', () => this.audio.pause(), () => undefined).then(() => this.play());
    }
    /** One tab owns the save at a time (Web Locks); a second tab cannot silently lose its work. */
    private claimSave(): void {
        const locks = (navigator as Navigator & { locks?: LockManager }).locks;
        if (!locks?.request) return;
        void locks.request('kaldirim-save', { ifAvailable: true }, lock => {
            if (!lock) {
                this.ownsSave = false;
                this.ui.toast(this.ui.t('Oyun başka bir sekmede açık. Bu sekmede oynanamaz.', 'The game is already open in another tab. This tab is view-only.'));
                return undefined;
            }
            // Hold the lock for the life of the page.
            return new Promise<void>(() => undefined);
        }).catch(() => undefined);
    }
    private volume(): number { return this.portal.muted ? 0 : this.settings.volume; }
    private key(code: string): void {
        if (code === 'F3') { this.showStats = !this.showStats; return; }
        if (code === 'KeyP' && this.showStats) {
            this.download(new Blob([JSON.stringify({ ...this.diagnostics(), jobRevision: this.session.jobRevision, playtest: this.playtest.report(), viewport: { width: innerWidth, height: innerHeight, devicePixelRatio }, quality: this.settings.quality, note: 'Rolling active-play presentation timings. CPU submit time is not GPU time. Software rendering cannot certify target hardware.' }, null, 2)], { type: 'application/json' }), 'kaldirim-performance.json'); return;
        }
        if (!this.active) return;
        // P pauses too: on portals Escape also leaves fullscreen.
        if (code === 'Escape' || code === 'KeyP') { this.pause(); return; }
        if (code === 'KeyB') this.openPanel('shop');
        else if (code === 'Tab') this.openPanel('map');
        else if (code === 'KeyR' || code === 'KeyE') this.refill();
        else if (code === 'KeyQ') { this.rotated = !this.rotated; this.session.cancelWork(); }
        else if (code === 'KeyF') this.hint();
        else if (/^Digit[1-4]$/.test(code)) this.session.selectTool(Number(code.slice(-1)) - 1);
    }
    private refill(): void {
        if (!this.active) return;
        const near = this.world.nearSupply(this.player.position);
        if (this.session.startRefill(near)) this.audio.refill();
        else if (!near && !this.session.upgrades.logistics) this.ui.toast(this.ui.t('Palete yaklaş veya Mobil İkmal kirala.', 'Approach a pallet or lease Mobile Supplies.'));
    }
    private menuSound(kind: 'buy' | 'complete'): void {
        this.audio.configure(this.volume(), false);
        void this.audio.start().then(() => {
            if (kind === 'buy') this.audio.buy(); else this.audio.complete();
            window.setTimeout(() => { if (!this.active) this.audio.pause(); }, 1100);
        });
    }
    private buyTool(tier: number): void {
        if (this.session.buyTool(tier)) {
            this.playtest.record('tool-leased', this.session, String(tier)); track('tool-leased', this.session.level, `tier-${tier}`);
            this.renderer.shadowMap.needsUpdate = true; this.menuSound('buy');
            this.ui.toast(this.ui.t('Ekipman kiralandı. Bu iş artık daha hızlı.', 'Equipment leased. This job just got faster.')); this.persist();
        }
        this.ui.show('shop');
    }
    private buyUpgrade(id: string): void {
        if (UPGRADES.some(u => u.id === id) && this.session.buyUpgrade(id as UpgradeId)) { this.playtest.record('upgrade', this.session, id); this.menuSound('buy'); this.persist(); }
        this.ui.show('shop');
    }
    private hint(): void {
        const p = this.player.position, index = this.session.grid.nearestUnfinished(p.x, p.z, this.session.phase === 'finishing');
        this.world.showHint(index); if (index >= 0) this.ui.toast(this.ui.t('En yakın eksik alan işaretlendi.', 'Nearest unfinished area marked.'));
    }
    private setSettings(partial: Partial<Settings>): void {
        this.settings = validateSettings({ ...this.settings, ...partial }); this.store.saveSettings(this.settings);
        this.ui.setSettings(this.settings); this.audio.configure(this.volume(), this.settings.ambient);
        if (partial.quality) this.applyQuality(); this.persist();
    }
    private applyQuality(): void {
        const q = this.settings.quality;
        this.renderer.setPixelRatio(drawingRatio(devicePixelRatio, q));
        this.renderer.shadowMap.enabled = q !== 'low';
        const size = q === 'high' ? 2048 : 1024;
        this.sun.shadow.mapSize.set(size, size); this.sun.shadow.map?.dispose(); this.sun.shadow.map = null;
        this.renderer.shadowMap.needsUpdate = true;
        this.meter.reset(); this.frameStats = this.meter.summary(); this.resize();
    }
    private resize(): void {
        const w = Math.max(1, this.root.clientWidth), h = Math.max(1, this.root.clientHeight);
        this.renderer.setSize(w, h); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
        this.viewCamera.aspect = w / h; this.viewCamera.updateProjectionMatrix();
    }
    private aim(): void {
        if (this.session.phase === 'finishing' && this.session.jobRevision === 2) {
            this.target = compactorTarget(this.session.grid, this.player.position.x, this.player.position.z, this.player.yaw);
            this.reachable = this.target >= 0; return;
        }
        this.camera.updateMatrixWorld(); this.raycaster.setFromCamera(this.aimCenter, this.camera);
        const hit = this.raycaster.ray.intersectPlane(this.plane, this.hit);
        if (!hit) { this.target = -1; this.reachable = false; return; }
        this.target = this.session.grid.fromWorld(hit.x, hit.z);
        this.reachable = this.target >= 0 && this.session.grid.valid[this.target] === 1 && hit.distanceTo(this.camera.position) <= this.session.reach + .35;
    }
    private fixedUpdate(dt: number): void {
        this.player.update(dt, this.input.axes(), this.settings); this.aim();
        const before = this.session.phase;
        const result = this.session.tick(dt, this.target, this.input.held, this.rotated, this.reachable);
        if (result.placed.length) {
            this.world.placed(result.placed); this.audio.stone(result.placed.length, this.session.selectedTool); this.viewModel.impact();
            this.playtest.progress(this.session);
            const completed = this.motifs.placed(result.placed);
            if (completed.length) {
                this.ui.craftNotice('motif', this.ui.t('Desen panosu tamamlandı', 'Pattern panel complete'), `${this.motifs.completed} / ${this.motifs.total}`);
                if (this.time - this.motifSoundAt > 3) { this.audio.motif(); this.motifSoundAt = this.time; }
                this.playtest.record('motif', this.session, completed.join(','));
            }
            const remaining = this.session.grid.total - this.session.grid.count;
            if (!this.cleanupShown && remaining > 0 && remaining <= Math.max(24, Math.ceil(this.session.grid.total * .01))) {
                this.cleanupShown = true; this.hint();
                this.ui.craftNotice('cleanup', this.ui.t('Son boşluklar kaldı', 'Just the last gaps'), this.ui.t('İşaret eksik taşları takip eder · F: En yakını bul', 'Marker follows unfinished work · F: Find nearest'), 'cleanup');
            }
        }
        if (result.compacted >= 0) { this.world.updateFinish(result.compacted); this.audio.compact(); this.viewModel.impact(); }
        if (before !== this.session.phase) {
            this.persist();
            if (this.session.phase === 'finishing') {
                this.ui.toast(this.ui.t('Taşlar tamam. Kompaktör hazır; basılı tutarak son geçişi yap.', 'Paving complete. Compactor ready — hold to make the final pass.')); this.session.cancelWork();
            } else if (this.session.phase === 'complete') { this.playtest.record('complete', this.session); track('job-complete', this.session.level); this.portal.celebrate(); this.reveal(); this.menuSound('complete'); }
        }
        this.saveTimer += dt;
        if (this.saveTimer > 8) { this.scheduleSave(); this.saveTimer = 0; }
    }
    private frame(now: number): void {
        if (this.dead) return;
        const rawFrameMs = Math.max(0, now - this.lastTime), frameStart = performance.now();
        const dt = Math.min(.1, rawFrameMs / 1000);
        this.lastTime = now; this.time += dt;
        if (this.graphicsLost || document.hidden) { this.frameId = requestAnimationFrame(t => this.frame(t)); return; }
        const measureFrame = this.active;
        if (this.active) {
            this.accumulator += dt;
            let steps = 0;
            while (this.accumulator >= 1 / 60 && steps++ < 6 && this.active) { this.fixedUpdate(1 / 60); this.accumulator -= 1 / 60; }
            if (steps >= 6) this.accumulator = 0;
        }
        if (this.active) { this.player.render(this.accumulator * 60, this.settings); this.aim(); }
        if (this.ui.panel === 'home') {
            const g = this.session.grid, a = this.settings.reducedMotion ? 0 : this.time * .014;
            this.camera.position.set(g.width * .48 + Math.sin(a) * 3, 13, g.depth * .53 + 8);
            this.camera.lookAt(-g.width * .13, 0, -g.depth * .07);
        }
        if (this.completion.active && !this.graphicsLost) {
            const finished = this.completion.update(rawFrameMs / 1000, this.camera);
            this.world.inspectionBefore(this.completion.before); this.ui.revealLabel(this.completion.label);
            if (finished) this.results();
        }
        this.audio.work(this.session.selectedTool, this.active && this.input.held && this.session.workProgress > 0, this.session.phase === 'finishing');
        this.world.reducedMotion = this.settings.reducedMotion; this.viewModel.setReducedMotion(this.settings.reducedMotion);
        this.world.setTarget(this.target, this.active && this.reachable, this.rotated);
        this.world.update(this.active ? dt : 0, this.time, this.player.position);
        this.viewModel.update(this.active ? dt : 0, this.time, this.session.selectedTool, this.session.phase, this.session.workProgress / this.session.dwell, this.active && this.player.speed > .1, this.session.inventory);
        this.ui.updateNotices(dt, this.active);
        if (this.active) {
            const notice = this.session.claimEquipmentNotice();
            if (notice !== null) { this.ui.equipmentReady(notice); this.audio.ready(); this.playtest.record('tool-affordable', this.session, String(notice)); this.scheduleSave(); }
        }
        this.audio.update(this.active ? dt : 0, this.active && this.player.speed > .3, this.session.grid.cells[this.session.grid.fromWorld(this.player.position.x, this.player.position.z)] === 1);
        this.updateHud();
        this.renderer.info.reset(); this.render();
        if (measureFrame && this.active) this.meter.record(rawFrameMs, performance.now() - frameStart);
        if (this.time - this.statsAt >= .5) {
            this.statsAt = this.time; this.frameStats = this.meter.summary(); this.fps = this.frameStats.averageFps;
            const m = this.frameStats;
            this.ui.diagnostics(`${m.samples < 120 ? 'Measuring / Ölçülüyor' : this.fps.toFixed(1) + ' FPS'}\nP95 ${m.frameMsP95.toFixed(1)} ms · P99 ${m.frameMsP99.toFixed(1)} ms\nWorst ${m.worstFrameMs.toFixed(1)} ms · >33ms ${m.slowFrames}\nCPU submit P95 ${m.cpuMsP95.toFixed(1)} ms\n${this.renderer.info.render.calls} draws · ${this.renderer.info.render.triangles.toLocaleString()} triangles\n${this.settings.quality.toUpperCase()} · render scale ${this.renderer.getPixelRatio()}\nP · Export report`, this.showStats);
        }
        this.frameId = requestAnimationFrame(t => this.frame(t));
    }
    /** Paint critical state before submitting a potentially cold GPU frame. */
    private updateHud(): void {
        this.ui.update(this.time, { valid: this.reachable, count: this.target >= 0 ? (this.session.phase === 'finishing' ? Number(!this.session.grid.compacted[this.session.grid.patchAt(this.target)]) : this.session.target(this.target, this.rotated).indices.length) : 0 }, { x: this.player.position.x, z: this.player.position.z, yaw: this.player.yaw }, this.world.nearSupply(this.player.position));
    }
    private render(hideHands = false): void {
        this.renderer.clear(); this.renderer.render(this.scene, this.camera);
        if (!hideHands && this.viewModel.group.visible && this.ui.panel !== 'home' && this.session.phase !== 'complete') { this.renderer.clearDepth(); this.renderer.render(this.viewScene, this.viewCamera); }
    }
    private snapshot(): SavedGame { return { version: 1, session: this.session.snapshot(), progress: this.session.progress, settings: this.settings, pose: this.player.pose() }; }
    private scheduleSave(): void {
        if (this.pendingSave !== null) return;
        const task = () => { this.pendingSave = null; this.persist(); };
        this.pendingSave = typeof window.requestIdleCallback === 'function' ? window.requestIdleCallback(task, { timeout: 1500 }) : window.setTimeout(task, 50);
    }
    private persist(): void {
        if (!this.started || !this.ownsSave) return;
        if (this.pendingSave !== null) {
            if (typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(this.pendingSave); else window.clearTimeout(this.pendingSave);
            this.pendingSave = null;
        }
        const ok = this.store.save(this.snapshot()); this.ui.saved(ok);
        if (!ok && this.store.warning !== this.lastSaveWarning) {
            this.ui.toast(this.store.warning === 'save-conflict'
                ? this.ui.t('Başka bir sekme kaydı değiştirdi. Üzerine yazılmadı. Yedeğini dışa aktar ve diğer sekmeyi kontrol et.', 'Another tab changed this save. It was not overwritten. Export a backup and check the other tab.')
                : this.ui.t('Kayıt alınamadı. Ayarlar’dan yedeğini dışa aktar.', 'Unable to save. Export a backup in Settings.'));
        }
        this.lastSaveWarning = ok ? null : this.store.warning;
    }
    private exportSave(): void { this.download(new Blob([encodeSave(this.snapshot())], { type: 'application/json' }), 'kaldirim-save.json'); }
    private importSave(raw: string): boolean {
        const data = decodeSave(raw); if (!data) return false;
        const restored = GameSession.restore(data.session, data.progress); if (!restored || !this.store.save(data)) return false;
        this.active = false; this.input.unlock(); this.started = true; this.session = restored; this.settings = data.settings;
        this.store.saveSettings(this.settings); this.ui.setSettings(this.settings); this.makeWorld(data.pose); this.applyQuality();
        this.persist(); this.ui.hasSave = true; this.ui.show('pause'); this.ui.toast(this.ui.t('Kayıt yüklendi.', 'Save loaded.')); return true;
    }
    private screenshot(): void { this.render(true); this.renderer.domElement.toBlob(blob => { if (blob) this.download(blob, `kaldirim-${this.session.grid.spec.id}.png`); }, 'image/png'); }
    private download(blob: Blob, name: string): void { const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 5000); }
    private diagnostics(): Diagnostics {
        return { stones: this.session.grid.count, total: this.session.grid.total, money: this.session.money, inventory: this.session.inventory, capacity: this.session.capacity, tool: this.session.selectedTool, phase: this.session.phase, unlocked: this.session.progress.unlocked, level: this.session.level, active: this.active, target: this.target, progress: this.session.workProgress, position: { x: this.player.position.x, z: this.player.position.z }, fps: this.fps, frames: this.frameStats, renderScale: this.renderer.getPixelRatio(), antialias: this.renderer.getContext().getContextAttributes()?.antialias === true, renderer: this.rendererName, drawCalls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles, geometries: this.renderer.info.memory.geometries };
    }
    dispose(): void { this.dead = true; cancelAnimationFrame(this.frameId); this.persist(); this.input.dispose(); this.player.dispose(); this.world.dispose(); this.viewModel.dispose(); this.materials.dispose(); this.environmentTarget.dispose(); this.sky.geometry.dispose(); (this.sky.material as T.Material).dispose(); this.renderer.dispose(); this.audio.dispose(); }
}
async function boot(): Promise<void> {
    const root = document.querySelector<HTMLElement>('#app')!;
    try {
        const progress = root.querySelector('progress'); if (progress) progress.value = .2;
        // The SDK preloads the player's saves during init, so it must finish before the save is read.
        const portal = new Portal();
        await Promise.all([initPhysics(), portal.init(import.meta.env.VITE_PLATFORM === 'crazygames')]); if (progress) progress.value = .6;
        new KaldirimGame(root, portal);
    } catch (error) {
        console.error(error); root.querySelector('#boot')?.remove();
        const errorEl = document.createElement('div'); errorEl.id = 'error';
        const inner = document.createElement('div'), heading = document.createElement('h1'), description = document.createElement('p'), detail = document.createElement('pre'), button = document.createElement('button');
        heading.textContent = 'Şantiye açılamadı.';
        description.textContent = 'WebGL 2 destekleyen güncel bir tarayıcı ve etkin donanım hızlandırması gerekiyor. Kayıt dosyaların silinmedi.';
        detail.textContent = error instanceof Error ? error.message : String(error);
        button.className = 'primary'; button.textContent = 'Yeniden dene'; button.onclick = () => location.reload();
        inner.append(heading, description, detail, button); errorEl.append(inner); root.append(errorEl);
    }
}
void boot();
if (import.meta.env.PROD && 'serviceWorker' in navigator && location.protocol !== 'file:' && import.meta.env.VITE_PLATFORM !== 'crazygames') {
    window.addEventListener('load', () => { void navigator.serviceWorker.register('./sw.js').catch(() => {}); });
}
