interface LockableScreenOrientation {
  readonly type?: string;
  readonly angle?: number;
  lock?: (orientation: string) => Promise<void>;
  unlock?: () => void;
}

export interface MobileLandscapeRequestResult {
  readonly mobileLike: boolean;
  readonly fullscreen: boolean;
  readonly orientationLocked: boolean;
}

const GATE_ID = "landscape-lock-gate";
const GATE_BUTTON_ID = "landscape-lock-action";
const GATE_MESSAGE_ID = "landscape-lock-message";

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

const updateOrientationDatasets = (result?: MobileLandscapeRequestResult): void => {
  document.body.dataset.mobileLandscape = isMobileLike() ? "required" : "not-required";
  document.body.dataset.screenOrientation = isPortrait() ? "portrait" : "landscape";
  if (!result) return;
  document.body.dataset.fullscreenRequest = result.fullscreen ? "active" : "unavailable";
  document.body.dataset.orientationLock = result.orientationLocked ? "locked" : "fallback";
};

/**
 * Must be called from a user gesture when possible. Browsers may require
 * fullscreen before Screen Orientation locking is accepted.
 */
export async function requestMobileLandscapeMode(): Promise<MobileLandscapeRequestResult> {
  if (!isMobileLike()) {
    const result = Object.freeze({
      mobileLike: false,
      fullscreen: Boolean(document.fullscreenElement),
      orientationLocked: false
    });
    updateOrientationDatasets(result);
    return result;
  }

  let fullscreen = Boolean(document.fullscreenElement);
  if (!fullscreen && document.documentElement.requestFullscreen) {
    try {
      await document.documentElement.requestFullscreen({ navigationUI: "hide" });
      fullscreen = Boolean(document.fullscreenElement);
    } catch {
      fullscreen = false;
    }
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

  const result = Object.freeze({
    mobileLike: true,
    fullscreen,
    orientationLocked
  });
  updateOrientationDatasets(result);
  return result;
}

export function installMobileLandscapeController(): void {
  if (document.getElementById(GATE_ID)) return;

  const gate = document.createElement("div");
  gate.id = GATE_ID;
  gate.dataset.visible = "false";
  gate.innerHTML = `
    <div class="landscape-lock-card" role="dialog" aria-modal="true" aria-label="Landscape mode required">
      <div class="landscape-lock-icon" aria-hidden="true">↻</div>
      <strong>LANDSCAPE MODE</strong>
      <p id="${GATE_MESSAGE_ID}">For smoother controls, this game plays in landscape.</p>
      <button id="${GATE_BUTTON_ID}" type="button">TAP TO ENTER LANDSCAPE</button>
      <span>If it does not rotate automatically, turn your phone sideways.</span>
    </div>
  `;
  document.body.appendChild(gate);

  const button = document.getElementById(GATE_BUTTON_ID) as HTMLButtonElement | null;
  const message = document.getElementById(GATE_MESSAGE_ID);

  const syncGate = (): void => {
    updateOrientationDatasets();
    const visible = isMobileLike() && isPortrait();
    gate.dataset.visible = visible ? "true" : "false";
    gate.setAttribute("aria-hidden", visible ? "false" : "true");
    if (!visible) {
      gate.dataset.state = "ready";
      if (button) button.textContent = "TAP TO ENTER LANDSCAPE";
      if (message) message.textContent = "For smoother controls, this game plays in landscape.";
    }
  };

  button?.addEventListener("click", () => {
    gate.dataset.state = "requesting";
    button.disabled = true;
    button.textContent = "ENTERING LANDSCAPE…";

    void requestMobileLandscapeMode().then((result) => {
      button.disabled = false;
      window.setTimeout(syncGate, 80);
      if (!isPortrait()) return;

      gate.dataset.state = "rotate";
      button.textContent = result.orientationLocked ? "LANDSCAPE LOCKED" : "TRY LANDSCAPE AGAIN";
      if (message) {
        message.textContent = "Automatic rotation is not available here. Rotate your phone to continue.";
      }
    });
  });

  window.addEventListener("resize", syncGate, { passive: true });
  window.addEventListener("orientationchange", syncGate, { passive: true });
  document.addEventListener("fullscreenchange", syncGate);
  screen.orientation?.addEventListener?.("change", syncGate);
  syncGate();
}
