interface ActiveDomDrag {
  readonly element: HTMLElement;
  readonly pointerId: number;
  readonly startClientX: number;
  readonly startClientY: number;
  readonly baseTranslateX: number;
  readonly baseTranslateY: number;
  readonly previousTransition: string;
  currentTranslateX: number;
  currentTranslateY: number;
}

const DRAG_SOURCE_SELECTOR = [
  ".checkout-product-card",
  "#patience-standard-item",
  "#cart-capacity-load [data-case-id]"
].join(", ");

const DROP_TOLERANCE_PX = 48;
let installed = false;
let activeDrag: ActiveDomDrag | undefined;

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

const applyMappedPointer = (
  state: ActiveDomDrag,
  clientX: number,
  clientY: number
): void => {
  // The software-landscape body is rotated +90deg. CSS translate operates in
  // the local landscape axes, while PointerEvent client coordinates remain in
  // the physical portrait viewport.
  state.currentTranslateX = state.baseTranslateX + (clientY - state.startClientY);
  state.currentTranslateY = state.baseTranslateY - (clientX - state.startClientX);
  state.element.style.transform = `translate3d(${state.currentTranslateX}px, ${state.currentTranslateY}px, 0)`;
};

const dropTargetsFor = (element: HTMLElement): readonly HTMLElement[] => {
  if (element.classList.contains("checkout-product-card")) {
    const target = document.getElementById("checkout-scan-zone");
    return target ? [target] : [];
  }
  if (element.id === "patience-standard-item") {
    const target = document.getElementById("patience-scan-zone");
    return target ? [target] : [];
  }
  if (element.closest("#cart-capacity-load")) {
    return [...document.querySelectorAll<HTMLElement>("#cart-capacity-load [data-capacity-lane-id]")];
  }
  return [];
};

const centre = (rect: DOMRect): { readonly x: number; readonly y: number } => ({
  x: rect.left + rect.width / 2,
  y: rect.top + rect.height / 2
});

const nearestTargetWithinTolerance = (
  element: HTMLElement
): HTMLElement | undefined => {
  const sourceCentre = centre(element.getBoundingClientRect());
  let best: { readonly element: HTMLElement; readonly distance: number } | undefined;

  dropTargetsFor(element).forEach((target) => {
    const rect = target.getBoundingClientRect();
    const insideExpanded = (
      sourceCentre.x >= rect.left - DROP_TOLERANCE_PX &&
      sourceCentre.x <= rect.right + DROP_TOLERANCE_PX &&
      sourceCentre.y >= rect.top - DROP_TOLERANCE_PX &&
      sourceCentre.y <= rect.bottom + DROP_TOLERANCE_PX
    );
    if (!insideExpanded) return;
    const targetCentre = centre(rect);
    const distance = Math.hypot(
      targetCentre.x - sourceCentre.x,
      targetCentre.y - sourceCentre.y
    );
    if (!best || distance < best.distance) best = { element: target, distance };
  });

  return best?.element;
};

const snapIntoTarget = (state: ActiveDomDrag, target: HTMLElement): void => {
  const sourceCentre = centre(state.element.getBoundingClientRect());
  const targetCentre = centre(target.getBoundingClientRect());
  const viewportDeltaX = targetCentre.x - sourceCentre.x;
  const viewportDeltaY = targetCentre.y - sourceCentre.y;

  // Convert the viewport correction back into local software-landscape axes.
  state.currentTranslateX += viewportDeltaY;
  state.currentTranslateY -= viewportDeltaX;
  state.element.style.transform = `translate3d(${state.currentTranslateX}px, ${state.currentTranslateY}px, 0)`;
};

const updateScanFeedback = (state: ActiveDomDrag): void => {
  const targets = dropTargetsFor(state.element);
  if (targets.length !== 1) return;
  const target = targets[0];
  if (!target || target.dataset.capacityLaneId) return;

  const sourceCentre = centre(state.element.getBoundingClientRect());
  const rect = target.getBoundingClientRect();
  const inside = (
    sourceCentre.x >= rect.left && sourceCentre.x <= rect.right &&
    sourceCentre.y >= rect.top && sourceCentre.y <= rect.bottom
  );
  target.style.transform = inside ? "scale(1.025)" : "scale(1)";
};

const finish = (state: ActiveDomDrag): void => {
  queueMicrotask(() => {
    state.element.style.transition = state.previousTransition;
  });
  activeDrag = undefined;
  document.body.dataset.mobileDomDrag = "ready";
};

/**
 * Corrects DOM drag interactions that live inside the +90deg portrait fallback.
 * Phaser input has its own inverse transform, but DOM cards do not. This keeps
 * checkout, cart-capacity and patience drags aligned with the player's finger
 * without changing desktop or true-landscape behavior.
 */
export function installMobileDomDragAdapter(): void {
  if (installed) return;
  installed = true;
  document.body.dataset.mobileDomDrag = "ready";

  document.addEventListener("pointerdown", (event) => {
    if (!softwareLandscapeActive()) return;
    const target = event.target as Element | null;
    const element = target?.closest?.(DRAG_SOURCE_SELECTOR) as HTMLElement | null;
    if (!element) return;

    const translate = readTranslate(element);
    activeDrag = {
      element,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      baseTranslateX: translate.x,
      baseTranslateY: translate.y,
      currentTranslateX: translate.x,
      currentTranslateY: translate.y,
      previousTransition: element.style.transition
    };
    element.style.transition = "none";
    document.body.dataset.mobileDomDrag = "dragging";
  }, true);

  document.addEventListener("pointermove", (event) => {
    const state = activeDrag;
    if (!state || state.pointerId !== event.pointerId || !softwareLandscapeActive()) return;
    const { clientX, clientY } = event;

    // Component handlers run later in this dispatch and still write their
    // desktop translation. Re-apply the correct local translation afterwards.
    queueMicrotask(() => {
      if (activeDrag !== state) return;
      applyMappedPointer(state, clientX, clientY);
      updateScanFeedback(state);
    });
  }, true);

  document.addEventListener("pointerup", (event) => {
    const state = activeDrag;
    if (!state || state.pointerId !== event.pointerId) return;

    if (softwareLandscapeActive()) {
      // Do this synchronously in capture phase. The component's pointerup
      // handler then sees the corrected element bounds when it validates drop.
      applyMappedPointer(state, event.clientX, event.clientY);
      const target = nearestTargetWithinTolerance(state.element);
      if (target) snapIntoTarget(state, target);
    }
    finish(state);
  }, true);

  document.addEventListener("pointercancel", (event) => {
    const state = activeDrag;
    if (!state || state.pointerId !== event.pointerId) return;
    finish(state);
  }, true);
}
