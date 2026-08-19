interface DragPoint {
  readonly x: number;
  readonly y: number;
}

interface CheckoutDragSurface {
  readonly card: HTMLElement;
  readonly scanner: HTMLElement;
  readonly overlay: HTMLElement;
  readonly restingBorderColor: string;
}

interface ActiveCheckoutDrag extends CheckoutDragSurface {
  readonly pointerId: number;
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

const checkoutSurfaceFromEvent = (event: PointerEvent): CheckoutDragSurface | undefined => {
  if (!(event.target instanceof Element)) return undefined;

  const patienceCard = event.target.closest("#patience-standard-item");
  if (patienceCard instanceof HTMLElement) {
    const scanner = document.querySelector<HTMLElement>("#patience-scan-zone");
    const overlay = document.querySelector<HTMLElement>("#checkout-patience-overlay");
    if (!scanner || !overlay || overlay.style.display === "none") return undefined;
    return {
      card: patienceCard,
      scanner,
      overlay,
      restingBorderColor: "rgba(255,255,255,0.2)"
    };
  }

  const scanCard = event.target.closest(".checkout-product-card");
  if (!(scanCard instanceof HTMLElement)) return undefined;
  const scanner = document.querySelector<HTMLElement>("#checkout-scan-zone");
  const overlay = document.querySelector<HTMLElement>("#checkout-scan-overlay");
  if (!scanner || !overlay || overlay.style.display === "none") return undefined;
  return {
    card: scanCard,
    scanner,
    overlay,
    restingBorderColor: "rgba(255,255,255,0.16)"
  };
};

const resetCard = (drag: ActiveCheckoutDrag): void => {
  drag.card.style.transform = "translate(0,0)";
  drag.card.style.zIndex = "";
  drag.card.style.cursor = "grab";
  drag.card.style.borderColor = drag.restingBorderColor;
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
    // Both checkout overlays expose their scan state through keyboard activation.
    // Dispatching the same semantic action keeps rotated touch input independent
    // from each overlay's axis-aligned desktop pointer calculations.
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
  const surface = checkoutSurfaceFromEvent(event);
  if (!surface || surface.card.style.pointerEvents === "none") return;

  event.preventDefault();
  event.stopPropagation();

  const start = localPoint(event.clientX, event.clientY);
  activeDrag = {
    ...surface,
    pointerId: event.pointerId,
    start,
    translateX: 0,
    translateY: 0
  };

  try { surface.card.setPointerCapture(event.pointerId); } catch { /* window capture is enough */ }
  surface.card.style.zIndex = "8";
  surface.card.style.cursor = "grabbing";
  surface.card.style.borderColor = "#ffd95e";
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
  const existing = document.getElementById("checkout-software-landscape-drag-style");
  if (existing) return;

  const style = document.createElement("style");
  style.id = "checkout-software-landscape-drag-style";
  style.textContent = `
body[data-software-landscape="true"] #checkout-scan-overlay,
body[data-software-landscape="true"] #checkout-patience-overlay {
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
body[data-software-landscape="true"] .checkout-product-card,
body[data-software-landscape="true"] #checkout-patience-overlay > div,
body[data-software-landscape="true"] #patience-standard-item,
body[data-software-landscape="true"] #patience-scan-zone {
  touch-action: none !important;
  -webkit-user-select: none !important;
  user-select: none !important;
}
body[data-software-landscape="true"] .checkout-product-card,
body[data-software-landscape="true"] #patience-standard-item {
  pointer-events: auto !important;
  -webkit-tap-highlight-color: transparent;
}

/* L7 is a four-station checkout puzzle. In a portrait browser the rotated body
   has only 390-430 logical pixels of height, so compact the vertical chrome
   while preserving generous touch targets and the full four-column workflow. */
body[data-software-landscape="true"] #checkout-patience-overlay {
  padding: 4px 6px !important;
  align-items: center !important;
}
body[data-software-landscape="true"] #checkout-patience-overlay > div {
  width: min(940px, 100%) !important;
  max-height: calc(100% - 4px) !important;
  padding: 8px 10px 8px !important;
  border-radius: 15px !important;
  overflow: hidden !important;
}
body[data-software-landscape="true"] #checkout-patience-overlay > div > div:first-child {
  grid-template-columns: 66px minmax(130px, 0.9fr) minmax(210px, 1.45fr) !important;
  gap: 8px !important;
  margin-bottom: 5px !important;
}
body[data-software-landscape="true"] #checkout-patience-overlay > div > div:first-child > div:first-child {
  height: 70px !important;
}
body[data-software-landscape="true"] #checkout-patience-customer-mood {
  width: 56px !important;
  height: 88px !important;
}
body[data-software-landscape="true"] #checkout-patience-overlay > div > div:nth-child(2) {
  margin-bottom: 5px !important;
  font-size: 10px !important;
  line-height: 1.18 !important;
}
body[data-software-landscape="true"] #checkout-patience-overlay > div > div:nth-child(3) {
  grid-template-columns: minmax(105px, 0.72fr) minmax(105px, 0.72fr) minmax(220px, 1.42fr) minmax(105px, 0.72fr) !important;
  gap: 7px !important;
}
body[data-software-landscape="true"] #patience-standard-item,
body[data-software-landscape="true"] #patience-scan-zone,
body[data-software-landscape="true"] #produce-scale-panel,
body[data-software-landscape="true"] #patience-payment-button {
  min-height: 132px !important;
  border-radius: 12px !important;
}
body[data-software-landscape="true"] #patience-standard-item > img {
  width: 68px !important;
  height: 78px !important;
}
body[data-software-landscape="true"] #produce-scale-panel {
  padding: 6px !important;
}
body[data-software-landscape="true"] #produce-scale-visual {
  min-height: 64px !important;
}
body[data-software-landscape="true"] #produce-scale-visual > img:first-child {
  width: 104px !important;
  height: 68px !important;
}
body[data-software-landscape="true"] #produce-scale-visual > img:nth-child(2) {
  width: 34px !important;
  height: 34px !important;
}
body[data-software-landscape="true"] #produce-target-weight {
  padding: 6px 7px !important;
  font-size: 10px !important;
}
body[data-software-landscape="true"] #produce-weight-choices {
  gap: 4px !important;
}
body[data-software-landscape="true"] #produce-weight-choices button {
  min-height: 44px !important;
  padding: 0 5px !important;
}
body[data-software-landscape="true"] #checkout-patience-feedback {
  min-height: 14px !important;
  margin-top: 4px !important;
  font-size: 10px !important;
}

@media (max-height: 520px) and (pointer: coarse) {
  #checkout-patience-overlay {
    padding: 4px 6px !important;
    align-items: center !important;
  }
  #checkout-patience-overlay > div {
    width: min(940px, 100%) !important;
    max-height: calc(100% - 4px) !important;
    padding: 8px 10px 8px !important;
    border-radius: 15px !important;
    overflow: hidden !important;
  }
  #checkout-patience-overlay > div > div:first-child {
    grid-template-columns: 66px minmax(130px, 0.9fr) minmax(210px, 1.45fr) !important;
    gap: 8px !important;
    margin-bottom: 5px !important;
  }
  #checkout-patience-overlay > div > div:first-child > div:first-child {
    height: 70px !important;
  }
  #checkout-patience-customer-mood {
    width: 56px !important;
    height: 88px !important;
  }
  #checkout-patience-overlay > div > div:nth-child(2) {
    margin-bottom: 5px !important;
    font-size: 10px !important;
    line-height: 1.18 !important;
  }
  #checkout-patience-overlay > div > div:nth-child(3) {
    grid-template-columns: minmax(105px, 0.72fr) minmax(105px, 0.72fr) minmax(220px, 1.42fr) minmax(105px, 0.72fr) !important;
    gap: 7px !important;
  }
  #patience-standard-item,
  #patience-scan-zone,
  #produce-scale-panel,
  #patience-payment-button {
    min-height: 132px !important;
    border-radius: 12px !important;
  }
  #patience-standard-item > img {
    width: 68px !important;
    height: 78px !important;
  }
  #produce-scale-panel {
    padding: 6px !important;
  }
  #produce-scale-visual {
    min-height: 64px !important;
  }
  #produce-scale-visual > img:first-child {
    width: 104px !important;
    height: 68px !important;
  }
  #produce-scale-visual > img:nth-child(2) {
    width: 34px !important;
    height: 34px !important;
  }
  #produce-target-weight {
    padding: 6px 7px !important;
    font-size: 10px !important;
  }
  #produce-weight-choices {
    gap: 4px !important;
  }
  #produce-weight-choices button {
    min-height: 44px !important;
    padding: 0 5px !important;
  }
  #checkout-patience-feedback {
    min-height: 14px !important;
    margin-top: 4px !important;
    font-size: 10px !important;
  }
}
`;
  document.head.appendChild(style);
};

/**
 * Checkout DOM is axis-aligned on desktop. In the portrait fallback the complete
 * body is rotated 90 degrees, so DOM drag deltas need the same inverse-axis
 * mapping as Phaser. This adapter owns only rotated mobile drags and leaves
 * desktop / true-landscape checkout behaviour untouched.
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
