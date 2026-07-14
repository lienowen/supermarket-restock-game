type CrazyGamesSettings = {
  muteAudio?: boolean;
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

class CrazyGamesPlatform {
  private initialization?: Promise<boolean>;
  private sdk?: CrazyGamesSdk;
  private game?: PhaserGameLike;
  private gameplayActive = false;
  private loadingActive = false;
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

  isReady(): boolean {
    return Boolean(this.sdk);
  }

  private async initializeInternal(): Promise<boolean> {
    try {
      if (window.__crazyGamesSdkScriptReady) {
        await withTimeout(window.__crazyGamesSdkScriptReady, SDK_TIMEOUT_MS, false);
      }

      const sdk = window.CrazyGames?.SDK;
      if (!sdk) {
        document.body.dataset.crazyGamesSdk = "unavailable";
        return false;
      }

      await withTimeout(sdk.init(), SDK_TIMEOUT_MS);
      this.sdk = sdk;
      document.body.dataset.crazyGamesSdk = "ready";
      this.installSettingsListener();
      return true;
    } catch (error) {
      document.body.dataset.crazyGamesSdk = "error";
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
