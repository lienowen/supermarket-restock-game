const HIDDEN_STYLE_ID = "mobile-landscape-hidden-controls";
const LEGACY_ELEMENT_IDS = [
  "mobile-orientation-hint",
  "mobile-landscape-lock",
  "mobile-fullscreen-button"
] as const;

type LockableOrientation = ScreenOrientation & {
  lock?: (orientation: "landscape") => Promise<void>;
};

installLandscapeOrientation();

/**
 * Fullscreen belongs to the hosting portal or to an explicit user-facing control.
 * Do not consume the player's first gameplay pointer event to request fullscreen:
 * browsers can cancel or delay that same pointer sequence, which makes taps and
 * drags feel unreliable on mobile.
 */
function installLandscapeOrientation(): void {
  ensureHiddenControlsStyle();
  removeLegacyElements();

  document.addEventListener("fullscreenchange", handleFullscreenChange);
  document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
  window.addEventListener("resize", syncOrientationState, { passive: true });
  window.addEventListener("orientationchange", () => {
    window.setTimeout(syncOrientationState, 100);
  }, { passive: true });

  if (document.fullscreenElement) void lockOrientationOnly();
  syncOrientationState();
}

function handleFullscreenChange(): void {
  removeLegacyElements();
  if (document.fullscreenElement) void lockOrientationOnly();
  syncOrientationState();
}

async function lockOrientationOnly(): Promise<boolean> {
  const orientation = screen.orientation as LockableOrientation | undefined;
  if (!orientation || typeof orientation.lock !== "function") return false;

  try {
    await orientation.lock("landscape");
    return true;
  } catch {
    return false;
  }
}

function ensureHiddenControlsStyle(): void {
  if (document.getElementById(HIDDEN_STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = HIDDEN_STYLE_ID;
  style.textContent = `
    #mobile-orientation-hint,
    #mobile-landscape-lock,
    #mobile-fullscreen-button {
      display: none !important;
      visibility: hidden !important;
      pointer-events: none !important;
    }
  `;
  document.head.appendChild(style);
}

function removeLegacyElements(): void {
  LEGACY_ELEMENT_IDS.forEach((id) => document.getElementById(id)?.remove());
}

function syncOrientationState(): void {
  removeLegacyElements();

  if (!isMobileViewport()) {
    document.body.dataset.orientationLock = "desktop";
    return;
  }

  if (isPortraitViewport()) {
    document.body.dataset.orientationLock = "portrait";
    return;
  }

  document.body.dataset.orientationLock = document.fullscreenElement ? "locked" : "landscape";
}

function isMobileViewport(): boolean {
  return Math.min(window.innerWidth, window.innerHeight) <= 900 || navigator.maxTouchPoints > 0;
}

function isPortraitViewport(): boolean {
  return window.innerHeight > window.innerWidth;
}
