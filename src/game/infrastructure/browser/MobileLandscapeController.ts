interface LockableScreenOrientation {
  readonly type?: string;
  readonly angle?: number;
  lock?: (orientation: string) => Promise<void>;
  unlock?: () => void;
}

export interface MobileLandscapeRequestResult {
  readonly mobileLike: boolean;
  readonly orientationLocked: boolean;
}

const RETRY_DELAYS_MS = [0, 120, 420, 1200] as const;
let retryTimer: number | undefined;
let installing = false;
let attemptSerial = 0;

const isMobileLike = (): boolean => {
  const coarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
  const compactViewport = Math.min(window.innerWidth, window.innerHeight) <= 900;
  return navigator.maxTouchPoints > 0 || coarsePointer || compactViewport;
};

const isPortrait = (): boolean => {
  const mediaPortrait = window.matchMedia?.("(orientation: portrait)")?.matches;
  return mediaPortrait ?? (window.innerHeight > window.innerWidth);
};

const lockableOrientation = (): LockableScreenOrientation | undefined => (
  screen.orientation as unknown as LockableScreenOrientation | undefined
);

const updateOrientationDatasets = (orientationLocked?: boolean): void => {
  const mobileLike = isMobileLike();
  const portrait = isPortrait();
  const softwareLandscape = mobileLike && portrait;

  document.body.dataset.mobileLandscape = mobileLike ? "required" : "not-required";
  document.body.dataset.screenOrientation = portrait ? "portrait" : "landscape";
  document.body.dataset.softwareLandscape = softwareLandscape ? "true" : "false";
  document.body.dataset.orientationLock = orientationLocked
    ? "locked"
    : softwareLandscape
      ? "software-fallback"
      : "not-needed";
};

/**
 * Best-effort physical landscape request with no dedicated user gate.
 * When the browser refuses to rotate the physical viewport, CSS switches the
 * complete game stage into a software-landscape presentation automatically.
 */
export async function requestMobileLandscapeMode(): Promise<MobileLandscapeRequestResult> {
  const mobileLike = isMobileLike();
  if (!mobileLike || !isPortrait()) {
    const result = Object.freeze({ mobileLike, orientationLocked: false });
    updateOrientationDatasets(false);
    return result;
  }

  let orientationLocked = false;
  const orientation = lockableOrientation();
  if (typeof orientation?.lock === "function") {
    try {
      await orientation.lock("landscape");
      orientationLocked = true;
    } catch {
      orientationLocked = false;
    }
  }

  updateOrientationDatasets(orientationLocked);
  return Object.freeze({ mobileLike: true, orientationLocked });
}

const scheduleAutomaticAttempts = (): void => {
  attemptSerial += 1;
  const serial = attemptSerial;
  if (retryTimer !== undefined) window.clearTimeout(retryTimer);

  const attempt = (index: number): void => {
    if (serial !== attemptSerial || !isMobileLike() || !isPortrait()) {
      updateOrientationDatasets(false);
      return;
    }

    void requestMobileLandscapeMode().finally(() => {
      if (serial !== attemptSerial || !isPortrait()) return;
      const nextIndex = index + 1;
      const delay = RETRY_DELAYS_MS[nextIndex];
      if (delay === undefined) return;
      retryTimer = window.setTimeout(() => attempt(nextIndex), delay);
    });
  };

  attempt(0);
};

export function installMobileLandscapeController(): void {
  if (installing) return;
  installing = true;

  const resync = (): void => {
    updateOrientationDatasets(false);
    if (isMobileLike() && isPortrait()) scheduleAutomaticAttempts();
  };

  window.addEventListener("resize", resync, { passive: true });
  window.addEventListener("orientationchange", resync, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") resync();
  });
  screen.orientation?.addEventListener?.("change", resync);

  resync();
}
