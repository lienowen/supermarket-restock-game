const LANDSCAPE_BUTTON_ID = "mobile-landscape-lock";
const LANDSCAPE_STYLE_ID = "mobile-landscape-lock-style";

type LockableOrientation = ScreenOrientation & {
  lock?: (orientation: "landscape") => Promise<void>;
};

type VendorFullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
};

type VendorFullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => void | Promise<void>;
};

let lockRequest: Promise<boolean> | undefined;
let hasAttemptedFromGesture = false;

installLandscapeOrientation();

function installLandscapeOrientation(): void {
  ensureLandscapeStyle();
  ensureLandscapeButton();
  syncLandscapeButton();

  window.addEventListener("resize", syncLandscapeButton, { passive: true });
  window.addEventListener("orientationchange", () => {
    window.setTimeout(syncLandscapeButton, 120);
  }, { passive: true });

  document.addEventListener("fullscreenchange", () => {
    syncLandscapeButton();
    if (isPortraitMobile() && getFullscreenElement()) {
      void lockOrientationOnly();
    }
  });

  document.addEventListener("webkitfullscreenchange", () => {
    syncLandscapeButton();
    if (isPortraitMobile() && getFullscreenElement()) {
      void lockOrientationOnly();
    }
  });

  // Browsers require a real user gesture before fullscreen/orientation lock.
  // Capture the first in-page tap so Android browsers rotate without requiring
  // a separate second action. START DAY clicks are also covered by this path.
  document.addEventListener("pointerup", handleFirstUserGesture, { capture: true, passive: true });
}

function ensureLandscapeStyle(): void {
  if (document.getElementById(LANDSCAPE_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = LANDSCAPE_STYLE_ID;
  style.textContent = `
    #${LANDSCAPE_BUTTON_ID} {
      position: fixed;
      z-index: 10060;
      top: max(10px, env(safe-area-inset-top));
      left: 50%;
      display: none;
      min-width: 168px;
      min-height: 48px;
      padding: 10px 18px;
      transform: translateX(-50%);
      border: 3px solid #f6d66f;
      border-radius: 14px;
      background: linear-gradient(180deg, #275f59, #123b3c);
      box-shadow: 0 9px 25px rgb(0 0 0 / 42%);
      color: #fff8d6;
      font: 900 14px/1 Arial, sans-serif;
      letter-spacing: 1px;
      touch-action: manipulation;
    }

    #${LANDSCAPE_BUTTON_ID}[data-visible="true"] {
      display: block;
    }

    #${LANDSCAPE_BUTTON_ID}[data-state="failed"] {
      min-width: 220px;
      border-color: #ffb18f;
      background: linear-gradient(180deg, #7b493d, #4b2c2a);
    }

    #${LANDSCAPE_BUTTON_ID}:disabled {
      opacity: 0.72;
    }
  `;
  document.head.appendChild(style);
}

function ensureLandscapeButton(): void {
  if (document.getElementById(LANDSCAPE_BUTTON_ID)) return;
  const button = document.createElement("button");
  button.id = LANDSCAPE_BUTTON_ID;
  button.type = "button";
  button.textContent = "LANDSCAPE FULLSCREEN";
  button.dataset.state = "ready";
  button.addEventListener("click", () => {
    void requestLandscapeMode(true);
  });
  document.body.appendChild(button);
}

function handleFirstUserGesture(): void {
  if (hasAttemptedFromGesture || !isPortraitMobile()) return;
  hasAttemptedFromGesture = true;
  void requestLandscapeMode(false);
}

async function requestLandscapeMode(explicitButton: boolean): Promise<boolean> {
  if (!isMobileViewport()) return true;
  if (!isPortraitViewport()) {
    markLandscapeState("locked");
    return true;
  }
  if (lockRequest) return lockRequest;

  lockRequest = performLandscapeRequest(explicitButton).finally(() => {
    lockRequest = undefined;
  });
  return lockRequest;
}

async function performLandscapeRequest(explicitButton: boolean): Promise<boolean> {
  const button = document.getElementById(LANDSCAPE_BUTTON_ID) as HTMLButtonElement | null;
  if (button) {
    button.disabled = true;
    button.textContent = "ENTERING LANDSCAPE…";
    button.dataset.state = "requesting";
  }
  document.body.dataset.orientationLock = "requesting";

  let fullscreenAvailable = Boolean(getFullscreenElement());
  if (!fullscreenAvailable) {
    fullscreenAvailable = await requestDocumentFullscreen();
  }

  const orientationLocked = await lockOrientationOnly();
  await wait(220);

  const success = isLandscapeViewport() || orientationLocked;
  if (success) {
    markLandscapeState("locked");
    return true;
  }

  document.body.dataset.orientationLock = "failed";
  if (button) {
    button.disabled = false;
    button.dataset.state = "failed";
    button.textContent = fullscreenAvailable
      ? "ROTATE PHONE TO LANDSCAPE ↻"
      : "TAP, THEN ROTATE PHONE ↻";
  }

  // An explicit retry remains available for browsers that require the user to
  // rotate after entering fullscreen, especially Safari/WebKit variants.
  if (!explicitButton) window.setTimeout(syncLandscapeButton, 250);
  return false;
}

async function requestDocumentFullscreen(): Promise<boolean> {
  const root = document.documentElement as VendorFullscreenElement;
  try {
    if (typeof root.requestFullscreen === "function") {
      await root.requestFullscreen({ navigationUI: "hide" });
      return true;
    }
    if (typeof root.webkitRequestFullscreen === "function") {
      await Promise.resolve(root.webkitRequestFullscreen());
      return true;
    }
  } catch {
    return false;
  }
  return false;
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

function getFullscreenElement(): Element | null {
  const vendorDocument = document as VendorFullscreenDocument;
  return document.fullscreenElement ?? vendorDocument.webkitFullscreenElement ?? null;
}

function markLandscapeState(state: "locked" | "ready"): void {
  document.body.dataset.orientationLock = state;
  const button = document.getElementById(LANDSCAPE_BUTTON_ID) as HTMLButtonElement | null;
  if (!button) return;
  button.disabled = false;
  button.dataset.state = state;
  button.textContent = "LANDSCAPE FULLSCREEN";
  syncLandscapeButton();
}

function syncLandscapeButton(): void {
  const button = document.getElementById(LANDSCAPE_BUTTON_ID) as HTMLButtonElement | null;
  if (!button) return;
  const visible = isPortraitMobile();
  button.dataset.visible = visible ? "true" : "false";
  if (!visible) markLandscapeState("locked");
}

function isPortraitMobile(): boolean {
  return isMobileViewport() && isPortraitViewport();
}

function isMobileViewport(): boolean {
  return Math.min(window.innerWidth, window.innerHeight) <= 900 || navigator.maxTouchPoints > 0;
}

function isPortraitViewport(): boolean {
  return window.innerHeight > window.innerWidth;
}

function isLandscapeViewport(): boolean {
  return window.innerWidth > window.innerHeight;
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}
