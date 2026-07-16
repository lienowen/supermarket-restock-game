import "./mobileViewportFill.css";

const BACKDROP_ID = "mobile-game-backdrop";
const FRAME_INTERVAL_MS = 84;
const MAX_DEVICE_PIXEL_RATIO = 2;

let lastFrameAt = 0;
let backdrop: HTMLCanvasElement | undefined;
let backdropContext: CanvasRenderingContext2D | null = null;

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

  root.style.setProperty("--visual-vw", `${width}px`);
  root.style.setProperty("--visual-vh", `${height}px`);
  root.style.setProperty("--visual-vw-half", `${width / 2}px`);
  root.style.setProperty("--visual-vh-half", `${height / 2}px`);

  // Older builds rotated the complete app in portrait and replaced Phaser's
  // pointer mapping. Always clear that legacy state so native input remains
  // aligned with the real canvas rectangle.
  delete document.body.dataset.forcedLandscape;
  resizeBackdrop(width, height);
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
  if (document.body.dataset.viewportMode !== "mobile-landscape") return;

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
    // Phaser can briefly replace its canvas while switching scenes.
  }
}

function findPhaserCanvas(): HTMLCanvasElement | undefined {
  const app = document.getElementById("app");
  if (!app) return undefined;

  return Array.from(app.querySelectorAll("canvas")).find(
    (canvas): canvas is HTMLCanvasElement => canvas instanceof HTMLCanvasElement && canvas.id !== BACKDROP_ID
  );
}
