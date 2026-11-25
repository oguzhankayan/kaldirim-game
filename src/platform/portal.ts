export type AdResult = 'completed' | 'unavailable' | 'error';
interface SDK {
    init(): Promise<void>;
    environment: string;
    game: {
        loadingStart(): void;
        loadingStop(): void;
        gameplayStart(): void;
        gameplayStop(): void;
        happytime(): void;
        settings?: { muteAudio?: boolean };
        addSettingsChangeListener?(listener: (settings: { muteAudio?: boolean }) => void): void;
    };
    /** Same API as localStorage; synced to the player's CrazyGames account (guests: local). */
    data?: { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void };
    user?: { systemInfo?: { locale?: string; device?: { type?: string } } };
    ad: {
        requestAd(type: 'midgame' | 'rewarded', callbacks: {
            adStarted: () => void;
            adFinished: () => void;
            adError: () => void;
        }): void;
    };
}
declare global {
    interface Window {
        CrazyGames?: {
            SDK: SDK;
        };
    }
}
/** Optional adapter. Standalone builds never load remote SDKs or show fake ads. */
export class Portal {
    private sdk: SDK | null = null;
    private pending = false;
    private playing = false;
    async init(enabled: boolean): Promise<void> {
        if (!enabled)
            return;
        try {
            await Promise.race([new Promise<void>((resolve, reject) => { const script = document.createElement('script'); script.src = 'https://sdk.crazygames.com/crazygames-sdk-v3.js'; script.onload = () => resolve(); script.onerror = () => reject(new Error('SDK unavailable')); document.head.append(script); }), new Promise<never>((_, reject) => setTimeout(() => reject(new Error('SDK timeout')), 8000))]);
            const sdk = window.CrazyGames?.SDK;
            if (!sdk)
                return;
            await Promise.race([sdk.init(), new Promise<never>((_, reject) => setTimeout(() => reject(new Error('SDK init timeout')), 8000))]);
            if (sdk.environment === 'disabled')
                return;
            this.sdk = sdk;
            this.sdk.game.loadingStart();
            // CrazyGames' mute setting takes priority over the in-game volume.
            this.muted = sdk.game.settings?.muteAudio === true;
            sdk.game.addSettingsChangeListener?.(settings => { this.muted = settings.muteAudio === true; this.onMuteChange?.(); });
        }
        catch {
            this.sdk = null;
        }
    }
    loaded(): void { try {
        this.sdk?.game.loadingStop();
    }
    catch { /* An unavailable portal must not prevent play. */ } }
    start(): void { try {
        if(this.sdk && !this.playing){this.sdk.game.gameplayStart();this.playing=true;}
    }
    catch { /* Standalone fallback. */ } }
    stop(): void { try {
        if(this.sdk && this.playing){this.sdk.game.gameplayStop();this.playing=false;}
    }
    catch { /* Standalone fallback. */ } }
    celebrate(): void { try {
        this.sdk?.game.happytime();
    }
    catch { /* Cosmetic portal event. */ } }
    get available(): boolean { return this.sdk !== null; }
    /** On CrazyGames every save goes through the SDK data module; it must not fall back to local saves. */
    get storage(): NonNullable<SDK['data']> | null { return this.sdk?.data ?? null; }
    /** True while the portal asks every game to stay silent. */
    muted = false;
    onMuteChange: (() => void) | null = null;
    /** Portal locale such as "tr-TR", when the SDK provides one. */
    get locale(): string | undefined { try { return this.sdk?.user?.systemInfo?.locale; } catch { return undefined; } }
    /** "desktop", "tablet" or "mobile", when the SDK provides it. */
    get deviceType(): string | undefined { try { return this.sdk?.user?.systemInfo?.device?.type; } catch { return undefined; } }
    requestAd(type: 'midgame' | 'rewarded', pause: () => void, resume: () => void): Promise<AdResult> {
        if (!this.sdk || this.pending)
            return Promise.resolve('unavailable');
        this.pending = true;
        return new Promise(resolve => {
            let settled = false, paused = false;
            const finish = (result: AdResult) => { if (settled)
                return; settled = true; clearTimeout(timeout); this.pending = false; try {if(paused)resume();}finally{resolve(result);} };
            const timeout = setTimeout(() => finish('error'), 120000);
            try {
                this.sdk!.ad.requestAd(type, { adStarted: () => { if (settled || paused)
                        return; paused = true; pause(); }, adFinished: () => finish('completed'), adError: () => finish('error') });
            }
            catch {
                finish('error');
            }
        });
    }
}
