interface DragPoint {
  readonly x: number;
  readonly y: number;
}

interface ActiveCheckoutDrag {
  readonly pointerId: number;
  readonly card: HTMLElement;
  readonly scanner: HTMLElement;
  readonly start: DragPoint;
  translateX: number;
  translateY: number;
}

let installed = false;
let activeDrag: ActiveCheckoutDrag | undefined;

const softwareLandscapeActive = (): boolean => (
  document.body.dataset.softwareLandscape === "true"
);

const localPoint = (clientX: number, clientY: number): DragPoint => (
  softwareLandscapeActive()
    ? { x: clientY, y: window.innerWidth - clientX }
    : { x: clientX, y: clientY }
);

const pointerInside = (
  clientX: number,
  clientY: number,
  target: HTMLElement,
  tolerance = 22
): boolean => {
  const rect = target.getBoundingClientRect();
  return (
    clientX >= rect.left - tolerance &&
    clientX <= rect.right + tolerance &&
    clientY >= rect.top - tolerance &&
    clientY <= rect.bottom + tolerance
  );
};

const checkoutCardFromEvent = (event: PointerEvent): HTMLElement | undefined => {
  if (!(event.target instanceof Element)) return undefined;
  const card = event.target.closest(".checkout-product-card");
  return card instanceof HTMLElement ? card : undefined;
};

const resetCard = (drag: ActiveCheckoutDrag): void => {
  drag.card.style.transform = "translate(0,0)";
  drag.card.style.zIndex = "";
  drag.card.style.cursor = "grab";
  drag.card.style.borderColor = "rgba(255,255,255,0.16)";
  drag.scanner.style.transform = "scale(1)";
  document.body.dataset.checkoutMobileDrag = "ready";
  document.body.dataset.checkoutMobileDragTarget = "outside";
};

const finishDrag = (event: PointerEvent, cancelled: boolean): void => {
  const drag = activeDrag;
  if (!drag || drag.pointerId !== event.pointerId) return;

  event.preventDefault();
  event.stopPropagation();

  const accepted = !cancelled && pointerInside(event.clientX, event.clientY, drag.scanner);
  try {
    if (drag.card.hasPointerCapture(event.pointerId)) {
      drag.card.releasePointerCapture(event.pointerId);
    }
  } catch {
    // Window capture listeners do not depend on browser pointer capture.
  }

  activeDrag = undefined;
  if (accepted) {
    document.body.dataset.checkoutMobileDrag = "accepted";
    document.body.dataset.checkoutMobileDragTarget = "inside";
    drag.card.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Enter",
      code: "Enter",
      bubbles: true,
      cancelable: true
    }));
    return;
  }

  resetCard(drag);
};

const handlePointerDown = (event: PointerEvent): void => {
  if (!softwareLandscapeActive() || activeDrag) return;
  const card = checkoutCardFromEvent(event);
  if (!card || card.style.pointerEvents === "none") return;
  const scanner = document.querySelector<HTMLElement>("#checkout-scan-zone");
  const overlay = document.querySelector<HTMLElement>("#checkout-scan-overlay");
  if (!scanner || !overlay || overlay.style.display === "none") return;

  event.preventDefault();
  event.stopPropagation();

  const start = localPoint(event.clientX, event.clientY);
  activeDrag = {
    pointerId: event.pointerId,
    card,
    scanner,
    start,
    translateX: 0,
    translateY: 0
  };

  try { card.setPointerCapture(event.pointerId); } catch { /* window capture is enough */ }
  card.style.zIndex = "8";
  card.style.cursor = "grabbing";
  card.style.borderColor = "#ffd95e";
  document.body.dataset.checkoutMobileDrag = "dragging";
  document.body.dataset.checkoutMobileDragTarget = "outside";
};

const handlePointerMove = (event: PointerEvent): void => {
  const drag = activeDrag;
  if (!drag || drag.pointerId !== event.pointerId) return;

  event.preventDefault();
  event.stopPropagation();

  const point = localPoint(event.clientX, event.clientY);
  drag.translateX = point.x - drag.start.x;
  drag.translateY = point.y - drag.start.y;
  drag.card.style.transform = `translate3d(${drag.translateX}px, ${drag.translateY}px, 0)`;

  const inside = pointerInside(event.clientX, event.clientY, drag.scanner);
  drag.scanner.style.transform = inside ? "scale(1.035)" : "scale(1)";
  document.body.dataset.checkoutMobileDragTarget = inside ? "inside" : "outside";
};

const handlePointerUp = (event: PointerEvent): void => finishDrag(event, false);
const handlePointerCancel = (event: PointerEvent): void => finishDrag(event, true);

const installGestureOwnershipStyles = (): void => {
  const style = document.createElement("style");
  style.id = "checkout-software-landscape-drag-style";
  style.textContent = `
body[data-software-landscape="true"] #checkout-scan-overlay {
  visibility: visible !important;
  width: 100% !important;
  height: 100% !important;
  max-width: none !important;
  max-height: none !important;
  z-index: 24000 !important;
  pointer-events: auto !important;
  touch-action: none !important;
}
body[data-software-landscape="true"] #checkout-scan-overlay > div,
body[data-software-landscape="true"] #checkout-product-basket,
body[data-software-landscape="true"] #checkout-scan-zone,
body[data-software-landscape="true"] .checkout-product-card {
  touch-action: none !important;
  -webkit-user-select: none !important;
  user-select: none !important;
}
body[data-software-landscape="true"] .checkout-product-card {
  pointer-events: auto !important;
  -webkit-tap-highlight-color: transparent;
}
`;
  document.head.appendChild(style);
};

/**
 * CheckoutScanDom is axis-aligned on desktop. In the portrait fallback the
 * complete body is rotated 90 degrees, so DOM drag deltas need the same inverse
 * axis mapping as Phaser. This adapter owns only those rotated mobile drags and
 * leaves desktop / true-landscape checkout behaviour untouched.
 */
export function installCheckoutSoftwareLandscapeDrag(): void {
  if (installed) return;
  installed = true;
  installGestureOwnershipStyles();

  document.addEventListener("pointerdown", handlePointerDown, { capture: true, passive: false });
  window.addEventListener("pointermove", handlePointerMove, { capture: true, passive: false });
  window.addEventListener("pointerup", handlePointerUp, { capture: true, passive: false });
  window.addEventListener("pointercancel", handlePointerCancel, { capture: true, passive: false });

  document.body.dataset.checkoutMobileDrag = "ready";
  document.body.dataset.checkoutMobileDragTarget = "outside";
}
