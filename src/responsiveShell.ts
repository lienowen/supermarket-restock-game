const VIEWPORT_META_ID = "supermarket-viewport-meta";
const ORIENTATION_HINT_ID = "mobile-orientation-hint";
const RESPONSIVE_LISTENER_FLAG = "supermarketResponsiveListeners";

export function installResponsiveShell(): void {
  ensureViewportMeta();
  removeOrientationHint();
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

function removeOrientationHint(): void {
  document.getElementById(ORIENTATION_HINT_ID)?.remove();
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

  removeOrientationHint();
  document.body.dataset.viewportMode = mode;
  document.documentElement.style.setProperty("--app-vw", `${width}px`);
  document.documentElement.style.setProperty("--app-vh", `${height}px`);
}
