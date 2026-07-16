const VIEWPORT_META_ID = "supermarket-viewport-meta";
const ORIENTATION_HINT_ID = "mobile-orientation-hint";
const RESPONSIVE_LISTENER_FLAG = "supermarketResponsiveListeners";

export function installResponsiveShell(): void {
  ensureViewportMeta();
  ensureOrientationHint();
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
  hint.innerHTML = "<strong>TAP TO ENTER LANDSCAPE</strong><span>THE GAME WILL REQUEST FULLSCREEN LANDSCAPE. YOUR PHONE AUTO-ROTATE SETTING IS NOT REQUIRED.</span>";
  hint.setAttribute("role", "button");
  hint.setAttribute("aria-label", "Enter landscape fullscreen mode");
  hint.tabIndex = 0;
  document.body.appendChild(hint);
}

function installResponsiveListeners(): void {
  const root = document.documentElement as HTMLElement & { dataset: DOMStringMap };
  if (root.dataset[RESPONSIVE_LISTENER_FLAG] === "true") return;
  root.dataset[RESPONSIVE_LISTENER_FLAG] = "true";

  window.addEventListener("resize", syncViewportMode, { passive: true });
  window.addEventListener("orientationchange", syncViewportMode, { passive: true });
}

function syncViewportMode(): void {
  const viewport = window.visualViewport;
  const width = Math.max(1, Math.round(viewport?.width ?? window.innerWidth));
  const height = Math.max(1, Math.round(viewport?.height ?? window.innerHeight));
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
}
