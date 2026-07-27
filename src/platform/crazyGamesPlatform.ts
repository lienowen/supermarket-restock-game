type CrazyGamesSettings = {
  muteAudio?: boolean;
};

export interface PlatformKeyValueStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

export type PlatformAdType = "midgame" | "rewarded";
export type PlatformAdStatus = "finished" | "error" | "unavailable" | "busy";

export interface PlatformAdResult {
  readonly type: PlatformAdType;
  readonly status: PlatformAdStatus;
  readonly errorCode?: string;
  readonly message?: string;
}

type CrazyGamesAdCallbacks = {
  adStarted?: () => void;
  adFinished?: () => void;
  adError?: (error: unknown, errorData?: unknown) => void;
};

type CrazyGamesAdModule = {
  requestAd: (type: PlatformAdType, callbacks?: CrazyGamesAdCallbacks) => void;
};

type CrazyGamesGameModule = {
  settings?: CrazyGamesSettings;
  gameplayStart: () => void;
  gameplayStop: () => void;
  loadingStart: () => void;
  loadingStop: () => void;
  addSettingsChangeListener?: (listener: (settings: CrazyGamesSettings) => void) => void;
  removeSettingsChangeListener?: (listener: (settings: CrazyGamesSettings) => void) => void;
  setGameContext?: (context: Record<string, string>) => void;
  clearGameContext?: () => void;
  reportGameCompletedPercentage?: (percentage: number) => void;
};

type CrazyGamesSdk = {
  init: () => Promise<void>;
  game: CrazyGamesGameModule;
  data?: PlatformKeyValueStorage;
  ad?: CrazyGamesAdModule;
};

type SoundManagerLike = {
  mute: boolean;
};

type PhaserGameLike = {
  sound?: SoundManagerLike;
};

declare global {
  interface Window {
    CrazyGames?: {
      SDK?: CrazyGamesSdk;
    };
    __crazyGamesSdkScriptReady?: Promise<boolean>;
    __CRAZY_GAMES_TEST_EVENTS__?: string[];
  }
}

const SDK_TIMEOUT_MS = 8_000;
const AD_TIMEOUT_MS = 120_000;

class CrazyGamesPlatform {
  private initialization?: Promise<boolean>;
  private sdk?: CrazyGamesSdk;
  private game?: PhaserGameLike;
  private gameplayActive = false;
  private loadingActive = false;
  private adRequestActive = false;
  private settingsListener?: (settings: CrazyGamesSettings) => void;

  initialize(): Promise<boolean> {
    this.initialization ??= this.initializeInternal();
    return this.initialization;
  }

  bindGame(game: PhaserGameLike): void {
    this.game = game;
    this.applyAudioSettings(this.sdk?.game.settings);
  }

  loadingStart(): void {
    if (!this.sdk || this.loadingActive) return;
    this.sdk.game.loadingStart();
    this.loadingActive = true;
    document.body.dataset.crazyGamesLoading = "started";
  }

  loadingStop(): void {
    if (!this.sdk || !this.loadingActive) return;
    this.sdk.game.loadingStop();
    this.loadingActive = false;
    document.body.dataset.crazyGamesLoading = "stopped";
  }

  gameplayStart(): void {
    if (!this.sdk || this.gameplayActive) return;
    this.loadingStop();
    this.sdk.game.gameplayStart();
    this.gameplayActive = true;
    document.body.dataset.crazyGamesGameplay = "started";
  }

  gameplayStop(): void {
    if (!this.sdk || !this.gameplayActive) return;
    this.sdk.game.gameplayStop();
    this.gameplayActive = false;
    document.body.dataset.crazyGamesGameplay = "stopped";
  }

  setGameContext(context: Record<string, string>): void {
    this.sdk?.game.setGameContext?.(context);
  }

  clearGameContext(): void {
    this.sdk?.game.clearGameContext?.();
  }

  reportProgress(percentage: number): void {
    const value = Math.max(0, Math.min(100, Math.round(percentage)));
    this.sdk?.game.reportGameCompletedPercentage?.(value);
  }

  dataStorage(): PlatformKeyValueStorage | undefined {
    return this.sdk?.data;
  }

  isCloudDataAvailable(): boolean {
    return Boolean(this.sdk?.data);
  }

  adsAvailable(): boolean {
    return Boolean(this.sdk?.ad);
  }

  requestRewardedAd(): Promise<PlatformAdResult> {
    return this.requestVideoAd("rewarded");
  }

  requestMidgameAd(): Promise<PlatformAdResult> {
    return this.requestVideoAd("midgame");
  }

  isReady(): boolean {
    return Boolean(this.sdk);
  }

  private async requestVideoAd(type: PlatformAdType): Promise<PlatformAdResult> {
    const adModule = this.sdk?.ad;
    if (!adModule) {
      document.body.dataset.crazyGamesAd = "unavailable";
      return Object.freeze({ type, status: "unavailable" });
    }
    if (this.adRequestActive) {
      return Object.freeze({ type, status: "busy" });
    }

    this.adRequestActive = true;
    document.body.dataset.crazyGamesAd = "requesting";
    const previousMute = this.game?.sound?.mute ?? false;

    return new Promise<PlatformAdResult>((resolve) => {
      let settled = false;
      let adStarted = false;
      const timeoutId = setTimeout(() => {
        settle({
          type,
          status: "error",
          errorCode: "timeout",
          message: `Ad request timed out after ${AD_TIMEOUT_MS}ms`
        });
      }, AD_TIMEOUT_MS);

      const settle = (result: PlatformAdResult): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        this.adRequestActive = false;
        if (adStarted && this.game?.sound) {
          this.game.sound.mute = this.sdk?.game.settings?.muteAudio === true || previousMute;
        }
        document.body.dataset.crazyGamesAd = result.status;
        window.__CRAZY_GAMES_TEST_EVENTS__?.push(`ad:${type}:${result.status}`);
        resolve(Object.freeze(result));
      };

      try {
        adModule.requestAd(type, {
          adStarted: () => {
            adStarted = true;
            document.body.dataset.crazyGamesAd = "started";
            if (this.game?.sound) this.game.sound.mute = true;
            window.__CRAZY_GAMES_TEST_EVENTS__?.push(`ad:${type}:started`);
          },
          adFinished: () => settle({ type, status: "finished" }),
          adError: (error, errorData) => {
            const details = normalizeAdError(error, errorData);
            settle({
              type,
              status: "error",
              errorCode: details.code,
              message: details.message
            });
          }
        });
      } catch (error) {
        const details = normalizeAdError(error);
        settle({
          type,
          status: "error",
          errorCode: details.code,
          message: details.message
        });
      }
    });
  }

  private async initializeInternal(): Promise<boolean> {
    try {
      if (window.__crazyGamesSdkScriptReady) {
        await withTimeout(window.__crazyGamesSdkScriptReady, SDK_TIMEOUT_MS, false);
      }

      const sdk = window.CrazyGames?.SDK;
      if (!sdk) {
        document.body.dataset.crazyGamesSdk = "unavailable";
        document.body.dataset.crazyGamesData = "local-fallback";
        document.body.dataset.crazyGamesAds = "unavailable";
        return false;
      }

      await withTimeout(sdk.init(), SDK_TIMEOUT_MS);
      this.sdk = sdk;
      document.body.dataset.crazyGamesSdk = "ready";
      document.body.dataset.crazyGamesData = sdk.data ? "account-storage" : "local-fallback";
      document.body.dataset.crazyGamesAds = sdk.ad ? "available" : "unavailable";
      this.installSettingsListener();
      return true;
    } catch (error) {
      document.body.dataset.crazyGamesSdk = "error";
      document.body.dataset.crazyGamesData = "local-fallback";
      document.body.dataset.crazyGamesAds = "unavailable";
      console.warn("CrazyGames SDK unavailable; continuing in local platform mode.", error);
      return false;
    }
  }

  private installSettingsListener(): void {
    const gameModule = this.sdk?.game;
    if (!gameModule) return;

    this.applyAudioSettings(gameModule.settings);
    if (!gameModule.addSettingsChangeListener) return;

    this.settingsListener = (settings) => this.applyAudioSettings(settings);
    gameModule.addSettingsChangeListener(this.settingsListener);
  }

  private applyAudioSettings(settings?: CrazyGamesSettings): void {
    if (!this.game?.sound || !settings) return;
    if (settings.muteAudio === true) this.game.sound.mute = true;
  }
}

function normalizeAdError(error: unknown, errorData?: unknown): { code?: string; message?: string } {
  const candidates = [errorData, error];
  for (const candidate of candidates) {
    if (typeof candidate === "object" && candidate !== null) {
      const record = candidate as Record<string, unknown>;
      const code = typeof record.code === "string"
        ? record.code
        : typeof record.reason === "string" ? record.reason : undefined;
      const message = typeof record.message === "string" ? record.message : undefined;
      if (code || message) return { code, message };
    }
    if (typeof candidate === "string" && candidate.trim()) return { message: candidate };
    if (candidate instanceof Error) return { message: candidate.message };
  }
  return { code: "other", message: "Unknown advertisement error" };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback?: T): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve, reject) => {
    timeoutId = setTimeout(() => {
      if (arguments.length >= 3) {
        resolve(fallback as T);
      } else {
        reject(new Error(`Timed out after ${timeoutMs}ms`));
      }
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export const crazyGamesPlatform = new CrazyGamesPlatform();
