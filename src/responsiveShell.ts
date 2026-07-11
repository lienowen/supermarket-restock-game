const VIEWPORT_META_ID = "supermarket-viewport-meta";
const ORIENTATION_HINT_ID = "mobile-orientation-hint";
const FULLSCREEN_BUTTON_ID = "mobile-fullscreen-button";
const RESPONSIVE_LISTENER_FLAG = "supermarketResponsiveListeners";

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

export function installResponsiveShell(): void {
  ensureViewportMeta();
  ensureOrientationHint();
  ensureFullscreenButton();
  installResponsiveListeners();
  syncViewportMode();
}

function ensureViewportMeta(): void {
  const existing = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  const meta = existing ?? document.createElement("meta");
  meta.id = VIEWPORT_META_ID;
  meta.name = "viewport";
  meta.content = "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover";
  if (!existing) document.head.appendChild(meta);
}

function ensureOrientationHint(): void {
  if (document.getElementById(ORIENTATION_HINT_ID)) return;
  const hint = document.createElement("div");
  hint.id = ORIENTATION_HINT_ID;
  hint.innerHTML = "<strong>ROTATE DEVICE</strong><span>请横屏游玩 · 横屏后可使用完整门店和更大的操作区域</span>";
  hint.setAttribute("role", "status");
  hint.setAttribute("aria-live", "polite");
  document.body.appendChild(hint);
}

function ensureFullscreenButton(): void {
  if (document.getElementById(FULLSCREEN_BUTTON_ID)) return;
  const button = document.createElement("button");
  button.id = FULLSCREEN_BUTTON_ID;
  button.type = "button";
  button.textContent = "FULL SCREEN";
  button.setAttribute("aria-label", "Enter full screen");
  button.addEventListener("click", () => void toggleFullscreen());
  document.body.appendChild(button);
}

function installResponsiveListeners(): void {
  const root = document.documentElement as HTMLElement & { dataset: DOMStringMap };
  if (root.dataset[RESPONSIVE_LISTENER_FLAG] === "true") return;
  root.dataset[RESPONSIVE_LISTENER_FLAG] = "true";

  window.addEventListener("resize", syncViewportMode, { passive: true });
  window.addEventListener("orientationchange", syncViewportMode, { passive: true });
  document.addEventListener("fullscreenchange", syncViewportMode);
  document.addEventListener("webkitfullscreenchange", syncViewportMode as EventListener);
}

function syncViewportMode(): void {
  const width = Math.max(1, window.innerWidth);
  const height = Math.max(1, window.innerHeight);
  const mobile = Math.min(width, height) <= 760;
  const portrait = height > width;
  const mode = mobile
    ? portrait
      ? "mobile-portrait"
      : "mobile-landscape"
    : width < 1100 || height < 820
      ? "compact"
      : "desktop";

  document.body.dataset.viewportMode = mode;
  document.documentElement.style.setProperty("--app-vw", `${width}px`);
  document.documentElement.style.setProperty("--app-vh", `${height}px`);

  const fullscreenDocument = document as FullscreenDocument;
  const fullscreen = Boolean(document.fullscreenElement ?? fullscreenDocument.webkitFullscreenElement);
  document.body.dataset.fullscreen = fullscreen ? "true" : "false";

  const button = document.getElementById(FULLSCREEN_BUTTON_ID) as HTMLButtonElement | null;
  if (button) button.textContent = fullscreen ? "EXIT FULL SCREEN" : "FULL SCREEN";
}

async function toggleFullscreen(): Promise<void> {
  const fullscreenDocument = document as FullscreenDocument;
  const fullscreenElement = document.fullscreenElement ?? fullscreenDocument.webkitFullscreenElement;
  try {
    if (fullscreenElement) {
      if (document.exitFullscreen) await document.exitFullscreen();
      else await fullscreenDocument.webkitExitFullscreen?.();
    } else {
      const root = document.documentElement as FullscreenElement;
      if (root.requestFullscreen) await root.requestFullscreen();
      else await root.webkitRequestFullscreen?.();
    }
  } catch {
    // Some mobile browsers only allow fullscreen from specific gestures or installed PWAs.
  } finally {
    syncViewportMode();
  }
}
