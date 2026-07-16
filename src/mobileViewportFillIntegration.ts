import Phaser from "phaser";
import "./mobileViewportFill.css";

const BACKDROP_ID = "mobile-game-backdrop";
const FRAME_INTERVAL_MS = 84;
const MAX_DEVICE_PIXEL_RATIO = 2;

type InputManagerPrototype = {
  transformPointer: (
    this: Phaser.Input.InputManager,
    pointer: Phaser.Input.Pointer,
    pageX: number,
    pageY: number,
    wasMove: boolean
  ) => void;
};

let lastFrameAt = 0;
let backdrop: HTMLCanvasElement | undefined;
let backdropContext: CanvasRenderingContext2D | null = null;

installForcedLandscapeInputMapping();
installMobileViewportFill();

function installMobileViewportFill(): void {
  ensureBackdrop();
  syncVisualViewportSize();

  window.addEventListener("resize", syncVisualViewportSize, { passive: true });
  window.addEventListener("orientationchange", () => {
    window.setTimeout(syncVisualViewportSize, 100);
  }, { passive: true });
  window.visualViewport?.addEventListener("resize", syncVisualViewportSize, { passive: true });
  window.visualViewport?.addEventListener("scroll", syncVisualViewportSize, { passive: true });
  document.addEventListener("fullscreenchange", syncVisualViewportSize);
  document.addEventListener("webkitfullscreenchange", syncVisualViewportSize);

  requestAnimationFrame(copyGameFrame);
}

function installForcedLandscapeInputMapping(): void {
  const prototype = Phaser.Input.InputManager.prototype as unknown as InputManagerPrototype;
  const originalTransformPointer = prototype.transformPointer;

  prototype.transformPointer = function transformForcedLandscapePointer(
    pointer: Phaser.Input.Pointer,
    pageX: number,
    pageY: number,
    wasMove: boolean
  ): void {
    if (!isForcedLandscapePortrait()) {
      originalTransformPointer.call(this, pointer, pageX, pageY, wasMove);
      return;
    }

    const canvas = this.canvas;
    if (!canvas || canvas.width <= 0 || canvas.height <= 0) {
      originalTransformPointer.call(this, pointer, pageX, pageY, wasMove);
      return;
    }

    const viewport = window.visualViewport;
    const viewportWidth = Math.max(1, viewport?.width ?? window.innerWidth);
    const viewportHeight = Math.max(1, viewport?.height ?? window.innerHeight);
    const viewportPageLeft = window.scrollX + (viewport?.offsetLeft ?? 0);
    const viewportPageTop = window.scrollY + (viewport?.offsetTop ?? 0);

    // The portrait viewport contains a clockwise-rotated landscape app shell.
    // Convert the physical page point back into that unrotated shell first.
    const shellX = pageY - viewportPageTop;
    const shellY = viewportWidth - (pageX - viewportPageLeft);

    const transformedBounds = canvas.getBoundingClientRect();
    const displayedCanvasWidth = Math.max(1, transformedBounds.height);
    const displayedCanvasHeight = Math.max(1, transformedBounds.width);
    const canvasLeft = (viewportHeight - displayedCanvasWidth) / 2;
    const canvasTop = (viewportWidth - displayedCanvasHeight) / 2;

    const x = (shellX - canvasLeft) * (canvas.width / displayedCanvasWidth);
    const y = (shellY - canvasTop) * (canvas.height / displayedCanvasHeight);
    const current = pointer.position;
    const previous = pointer.prevPosition;

    previous.x = current.x;
    previous.y = current.y;

    const smoothing = pointer.smoothFactor;
    if (!wasMove || smoothing === 0) {
      current.x = x;
      current.y = y;
    } else {
      current.x = x * smoothing + previous.x * (1 - smoothing);
      current.y = y * smoothing + previous.y * (1 - smoothing);
    }
  };
}

function ensureBackdrop(): void {
  const existing = document.getElementById(BACKDROP_ID);
  if (existing instanceof HTMLCanvasElement) {
    backdrop = existing;
    backdropContext = existing.getContext("2d", { alpha: false });
    return;
  }

  const app = document.getElementById("app");
  if (!app) {
    window.setTimeout(ensureBackdrop, 30);
    return;
  }

  const canvas = document.createElement("canvas");
  canvas.id = BACKDROP_ID;
  canvas.setAttribute("aria-hidden", "true");
  canvas.tabIndex = -1;
  app.prepend(canvas);
  backdrop = canvas;
  backdropContext = canvas.getContext("2d", { alpha: false });
}

function syncVisualViewportSize(): void {
  const viewport = window.visualViewport;
  const width = Math.max(1, Math.round(viewport?.width ?? window.innerWidth));
  const height = Math.max(1, Math.round(viewport?.height ?? window.innerHeight));
  const root = document.documentElement;
  const forcedLandscape = shouldForceLandscape(width, height);

  root.style.setProperty("--visual-vw", `${width}px`);
  root.style.setProperty("--visual-vh", `${height}px`);
  root.style.setProperty("--visual-vw-half", `${width / 2}px`);
  root.style.setProperty("--visual-vh-half", `${height / 2}px`);
  document.body.dataset.forcedLandscape = forcedLandscape ? "true" : "false";

  resizeBackdrop(forcedLandscape ? height : width, forcedLandscape ? width : height);
}

function resizeBackdrop(cssWidth: number, cssHeight: number): void {
  if (!backdrop) return;
  const pixelRatio = Math.min(MAX_DEVICE_PIXEL_RATIO, Math.max(1, window.devicePixelRatio || 1));
  const width = Math.max(1, Math.round(cssWidth * pixelRatio));
  const height = Math.max(1, Math.round(cssHeight * pixelRatio));

  if (backdrop.width !== width) backdrop.width = width;
  if (backdrop.height !== height) backdrop.height = height;
}

function copyGameFrame(timestamp: number): void {
  requestAnimationFrame(copyGameFrame);
  if (timestamp - lastFrameAt < FRAME_INTERVAL_MS) return;
  lastFrameAt = timestamp;

  if (document.visibilityState === "hidden") return;
  if (!shouldRenderMobileBackdrop()) return;

  ensureBackdrop();
  const source = findPhaserCanvas();
  if (!source || !backdrop || !backdropContext) return;
  if (source.width <= 0 || source.height <= 0 || backdrop.width <= 0 || backdrop.height <= 0) return;

  const scale = Math.max(backdrop.width / source.width, backdrop.height / source.height);
  const drawWidth = source.width * scale;
  const drawHeight = source.height * scale;
  const drawX = (backdrop.width - drawWidth) / 2;
  const drawY = (backdrop.height - drawHeight) / 2;

  try {
    backdropContext.save();
    backdropContext.imageSmoothingEnabled = true;
    backdropContext.imageSmoothingQuality = "low";
    backdropContext.fillStyle = "#102022";
    backdropContext.fillRect(0, 0, backdrop.width, backdrop.height);
    backdropContext.drawImage(source, drawX, drawY, drawWidth, drawHeight);
    backdropContext.restore();
  } catch {
    // A frame can be temporarily unavailable while Phaser recreates its canvas.
  }
}

function shouldRenderMobileBackdrop(): boolean {
  return document.body.dataset.viewportMode === "mobile-landscape" || isForcedLandscapePortrait();
}

function isForcedLandscapePortrait(): boolean {
  return document.body.dataset.forcedLandscape === "true";
}

function shouldForceLandscape(width: number, height: number): boolean {
  const touchDevice = navigator.maxTouchPoints > 0 || "ontouchstart" in window;
  return touchDevice && height > width;
}

function findPhaserCanvas(): HTMLCanvasElement | undefined {
  const app = document.getElementById("app");
  if (!app) return undefined;

  return Array.from(app.querySelectorAll("canvas")).find(
    (canvas): canvas is HTMLCanvasElement => canvas instanceof HTMLCanvasElement && canvas.id !== BACKDROP_ID
  );
}
