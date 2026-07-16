import Phaser from "phaser";
import { GameScene } from "./scenes/GameScene";
import { OpeningScene } from "./scenes/OpeningScene";
import { PromotionWingScene } from "./scenes/PromotionWingScene";
import { StorefrontScene } from "./scenes/StorefrontScene";

const HIDDEN_STYLE_ID = "mobile-landscape-hidden-controls";
const LEGACY_ELEMENT_IDS = [
  "mobile-orientation-hint",
  "mobile-landscape-lock",
  "mobile-fullscreen-button"
] as const;

type LockableOrientation = ScreenOrientation & {
  lock?: (orientation: "landscape") => Promise<void>;
};

type CreatePrototype = {
  create: (...args: unknown[]) => void;
};

let activeScene: Phaser.Scene | undefined;
let requestInFlight: Promise<boolean> | undefined;

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
    removeLegacyElements();

    if (isLandscapeViewport()) void lockOrientationOnly();

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (activeScene === scene) activeScene = undefined;
    });
  };
}

function installLandscapeOrientation(): void {
  ensureHiddenControlsStyle();
  removeLegacyElements();

  // No prompt or dedicated button. The first normal touch anywhere asks
  // Phaser to enter fullscreen, then locks the screen to landscape.
  document.addEventListener("pointerdown", handleUserGesture, { capture: true, passive: true });
  document.addEventListener("touchstart", handleUserGesture, { capture: true, passive: true });
  document.addEventListener("keydown", handleUserGesture, { capture: true });

  document.addEventListener("fullscreenchange", () => {
    removeLegacyElements();
    if (document.fullscreenElement) void lockOrientationOnly();
  });
  document.addEventListener("webkitfullscreenchange", () => {
    removeLegacyElements();
    void lockOrientationOnly();
  });

  window.addEventListener("resize", syncOrientationState, { passive: true });
  window.addEventListener("orientationchange", () => {
    window.setTimeout(syncOrientationState, 100);
  }, { passive: true });

  syncOrientationState();
}

function handleUserGesture(): void {
  removeLegacyElements();
  if (!isMobileViewport() || !isPortraitViewport()) return;
  void enterLandscapeFullscreen();
}

async function enterLandscapeFullscreen(): Promise<boolean> {
  if (!isMobileViewport()) return true;
  if (isLandscapeViewport()) {
    document.body.dataset.orientationLock = "locked";
    return true;
  }
  if (requestInFlight) return requestInFlight;

  requestInFlight = performLandscapeRequest().finally(() => {
    requestInFlight = undefined;
  });
  return requestInFlight;
}

async function performLandscapeRequest(): Promise<boolean> {
  document.body.dataset.orientationLock = "requesting";

  const fullscreenStarted = await requestPhaserFullscreen();
  const orientationLocked = await lockOrientationOnly();
  await wait(120);

  const success = isLandscapeViewport() || orientationLocked;
  document.body.dataset.orientationLock = success ? "locked" : fullscreenStarted ? "fullscreen" : "unavailable";
  return success;
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
    await wait(40);
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
  if (!isMobileViewport() || isLandscapeViewport()) {
    document.body.dataset.orientationLock = "locked";
  }
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
