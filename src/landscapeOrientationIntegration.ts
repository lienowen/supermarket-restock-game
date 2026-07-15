import Phaser from "phaser";
import { GameScene } from "./scenes/GameScene";
import { OpeningScene } from "./scenes/OpeningScene";
import { PromotionWingScene } from "./scenes/PromotionWingScene";
import { StorefrontScene } from "./scenes/StorefrontScene";

const LANDSCAPE_BUTTON_ID = "mobile-landscape-lock";
const LANDSCAPE_STYLE_ID = "mobile-landscape-lock-style";

type LockableOrientation = ScreenOrientation & {
  lock?: (orientation: "landscape") => Promise<void>;
};

type CreatePrototype = {
  create: (...args: unknown[]) => void;
};

let activeScene: Phaser.Scene | undefined;
let lockRequest: Promise<boolean> | undefined;
let hasAttemptedFromGesture = false;

wrapScene(StorefrontScene.prototype as unknown as CreatePrototype);
wrapScene(OpeningScene.prototype as unknown as CreatePrototype);
wrapScene(GameScene.prototype as unknown as CreatePrototype);
wrapScene(PromotionWingScene.prototype as unknown as CreatePrototype);
installLandscapeOrientation();

function wrapScene(prototype: CreatePrototype): void {
  const originalCreate = prototype.create;
  prototype.create = function createWithLandscapeSupport(...args: unknown[]): void {
    originalCreate.apply(this, args);
    const scene = this as unknown as Phaser.Scene;
    activeScene = scene;
    syncLandscapeButton();

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (activeScene === scene) activeScene = undefined;
    });
  };
}

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
    if (isPortraitMobile() && document.fullscreenElement) {
      void lockOrientationOnly();
    }
  });

  document.addEventListener("webkitfullscreenchange", () => {
    syncLandscapeButton();
    if (isPortraitMobile()) void lockOrientationOnly();
  });

  // Fullscreen and orientation locking require a real user gesture. Capturing
  // the first in-page tap means START DAY and normal menu taps can trigger the
  // landscape transition without an additional confirmation step.
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

  const fullscreenAvailable = await requestPhaserFullscreen();
  const orientationLocked = await lockOrientationOnly();
  await wait(240);

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

  // Safari/WebKit variants may enter a fullscreen-like mode without exposing
  // programmatic orientation locking. Keep a visible manual-rotation fallback.
  if (!explicitButton) window.setTimeout(syncLandscapeButton, 250);
  return false;
}

async function requestPhaserFullscreen(): Promise<boolean> {
  const scene = activeScene;
  if (!scene?.scene.isActive()) return false;

  try {
    if (!scene.scale.isFullscreen) scene.scale.startFullscreen();
  } catch {
    return false;
  }

  for (let attempt = 0; attempt < 12; attempt += 1) {
    if (scene.scale.isFullscreen || document.fullscreenElement || isLandscapeViewport()) return true;
    await wait(50);
  }
  return scene.scale.isFullscreen || Boolean(document.fullscreenElement);
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

function markLandscapeState(state: "locked" | "ready"): void {
  document.body.dataset.orientationLock = state;
  const button = document.getElementById(LANDSCAPE_BUTTON_ID) as HTMLButtonElement | null;
  if (!button) return;
  button.disabled = false;
  button.dataset.state = state;
  button.textContent = "LANDSCAPE FULLSCREEN";
  button.dataset.visible = isPortraitMobile() ? "true" : "false";
}

function syncLandscapeButton(): void {
  const button = document.getElementById(LANDSCAPE_BUTTON_ID) as HTMLButtonElement | null;
  if (!button) return;
  const visible = isPortraitMobile();
  button.dataset.visible = visible ? "true" : "false";
  if (!visible) {
    document.body.dataset.orientationLock = "locked";
    button.disabled = false;
    button.dataset.state = "locked";
    button.textContent = "LANDSCAPE FULLSCREEN";
  }
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
