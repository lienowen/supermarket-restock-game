const VIEWPORT_META_ID = "supermarket-viewport-meta";
const ORIENTATION_HINT_ID = "mobile-orientation-hint";

export function installResponsiveShell(): void {
  ensureViewportMeta();
  ensureOrientationHint();
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
  hint.innerHTML = "<strong>ROTATE DEVICE</strong><span>请横屏游玩 · Larger controls and full store view</span>";
  hint.setAttribute("role", "status");
  hint.setAttribute("aria-live", "polite");
  document.body.appendChild(hint);
}
