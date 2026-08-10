interface ActiveDragState {
  readonly source: HTMLElement;
  readonly pointerId: number;
  readonly startClientX: number;
  readonly startClientY: number;
  readonly startTranslateX: number;
  readonly startTranslateY: number;
  readonly previousTransition: string;
  currentTranslateX: number;
  currentTranslateY: number;
}

const SOURCE_ID = "guided-drag-source";
const TARGET_ID = "guided-drag-target";
const DROP_SNAP_TOLERANCE_PX = 34;
let installed = false;
let activeDrag: ActiveDragState | undefined;

const softwareLandscapeActive = (): boolean => (
  document.body.dataset.softwareLandscape === "true"
);

const readTranslate = (element: HTMLElement): { readonly x: number; readonly y: number } => {
  const transform = window.getComputedStyle(element).transform;
  if (!transform || transform === "none") return { x: 0, y: 0 };
  try {
    const matrix = new DOMMatrixReadOnly(transform);
    return { x: matrix.m41, y: matrix.m42 };
  } catch {
    return { x: 0, y: 0 };
  }
};

const applyLandscapePointer = (
  state: ActiveDragState,
  clientX: number,
  clientY: number
): void => {
  // The body is rotated +90deg. Convert viewport finger movement back into
  // the local landscape axes used by CSS translate().
  state.currentTranslateX = state.startTranslateX + (clientY - state.startClientY);
  state.currentTranslateY = state.startTranslateY - (clientX - state.startClientX);
  state.source.style.transform = `translate(${state.currentTranslateX}px, ${state.currentTranslateY}px)`;
};

const sourceNearTarget = (source: HTMLElement, target: HTMLElement): boolean => {
  const sourceRect = source.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const x = sourceRect.left + sourceRect.width / 2;
  const y = sourceRect.top + sourceRect.height / 2;
  return (
    x >= targetRect.left - DROP_SNAP_TOLERANCE_PX &&
    x <= targetRect.right + DROP_SNAP_TOLERANCE_PX &&
    y >= targetRect.top - DROP_SNAP_TOLERANCE_PX &&
    y <= targetRect.bottom + DROP_SNAP_TOLERANCE_PX
  );
};

const snapSourceIntoTarget = (state: ActiveDragState, target: HTMLElement): void => {
  const sourceRect = state.source.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const sourceX = sourceRect.left + sourceRect.width / 2;
  const sourceY = sourceRect.top + sourceRect.height / 2;
  const targetX = targetRect.left + targetRect.width / 2;
  const targetY = targetRect.top + targetRect.height / 2;

  const viewportDeltaX = targetX - sourceX;
  const viewportDeltaY = targetY - sourceY;
  state.currentTranslateX += viewportDeltaY;
  state.currentTranslateY -= viewportDeltaX;
  state.source.style.transform = `translate(${state.currentTranslateX}px, ${state.currentTranslateY}px)`;
};

const updateTargetFeedback = (state: ActiveDragState): void => {
  const target = document.getElementById(TARGET_ID) as HTMLElement | null;
  if (!target) return;
  const near = sourceNearTarget(state.source, target);
  target.style.transform = near ? "scale(1.035)" : "scale(1)";
  target.style.background = near
    ? "rgba(90, 145, 79, 0.34)"
    : "rgba(90, 145, 79, 0.12)";
};

const finishDrag = (state: ActiveDragState): void => {
  queueMicrotask(() => {
    state.source.style.transition = state.previousTransition;
  });
  activeDrag = undefined;
  document.body.dataset.mobileGuidedDrag = "ready";
};

/**
 * GuidedDragActionDom uses DOM PointerEvents. When the portrait fallback rotates
 * the whole page, clientX/clientY remain in viewport coordinates while CSS
 * translate() operates in landscape-local coordinates. This adapter corrects
 * only the mobile software-landscape drag without changing desktop behavior.
 */
export function installMobileGuidedDragFix(): void {
  if (installed) return;
  installed = true;
  document.body.dataset.mobileGuidedDrag = "ready";

  document.addEventListener("pointerdown", (event) => {
    if (!softwareLandscapeActive()) return;
    const source = (event.target as Element | null)?.closest?.(`#${SOURCE_ID}`) as HTMLElement | null;
    if (!source) return;

    const translate = readTranslate(source);
    activeDrag = {
      source,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startTranslateX: translate.x,
      startTranslateY: translate.y,
      currentTranslateX: translate.x,
      currentTranslateY: translate.y,
      previousTransition: source.style.transition
    };

    // A transform transition makes the box visibly trail behind the finger.
    source.style.transition = "border-color 120ms ease, background 120ms ease";
    document.body.dataset.mobileGuidedDrag = "dragging";
  }, true);

  document.addEventListener("pointermove", (event) => {
    const state = activeDrag;
    if (!state || event.pointerId !== state.pointerId || !softwareLandscapeActive()) return;
    const x = event.clientX;
    const y = event.clientY;

    // GuidedDragActionDom runs later in the same event and writes its unrotated
    // translation. Re-apply the corrected value immediately after dispatch.
    queueMicrotask(() => {
      if (activeDrag !== state) return;
      applyLandscapePointer(state, x, y);
      updateTargetFeedback(state);
    });
  }, true);

  document.addEventListener("pointerup", (event) => {
    const state = activeDrag;
    if (!state || event.pointerId !== state.pointerId) return;

    if (softwareLandscapeActive()) {
      // Correct synchronously before GuidedDragActionDom evaluates the drop.
      applyLandscapePointer(state, event.clientX, event.clientY);
      const target = document.getElementById(TARGET_ID) as HTMLElement | null;
      if (target && sourceNearTarget(state.source, target)) {
        snapSourceIntoTarget(state, target);
      }
    }

    finishDrag(state);
  }, true);

  document.addEventListener("pointercancel", (event) => {
    const state = activeDrag;
    if (!state || event.pointerId !== state.pointerId) return;
    finishDrag(state);
  }, true);
}
