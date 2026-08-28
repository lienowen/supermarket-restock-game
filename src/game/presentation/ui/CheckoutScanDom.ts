import type Phaser from "phaser";
import type { AssetDescriptor } from "../../assets/AssetDescriptor";
import type { CheckoutScanExperienceSpec } from "../../content/experience/LevelExperienceSpec";
import { gameDomainEvents } from "../../events/GameDomainEvents";

export interface CheckoutScanDomConfig {
  readonly game: Phaser.Game;
  readonly sceneKey: string;
  readonly levelId: string;
  readonly totalCustomers: number;
  readonly spec: CheckoutScanExperienceSpec;
  readonly productAssets: readonly AssetDescriptor[];
  readonly scannerAsset?: AssetDescriptor;
  readonly posAsset?: AssetDescriptor;
}

export interface CheckoutScanDomHandle {
  readonly destroy: () => void;
}

interface CheckoutScenePort {
  readonly input?: { enabled: boolean };
  readonly controller?: {
    readonly snapshot?: () => {
      readonly step: string;
      readonly customersServed: number;
      readonly totalCustomers: number;
    };
  };
  readonly isInteractionReady?: () => boolean;
  readonly children?: {
    readonly getByName?: (name: string) => Phaser.GameObjects.GameObject | null;
  };
}

interface ProductCardState {
  readonly element: HTMLElement;
  readonly asset: AssetDescriptor;
  scanned: boolean;
}

const applyStyles = (element: HTMLElement, styles: Partial<CSSStyleDeclaration>): void => {
  Object.assign(element.style, styles);
};

const assetUrl = (path: string): string => `/${path.replace(/^\/+/, "")}`;

interface CheckoutProductDisplaySize {
  readonly width: number;
  readonly height: number;
}

const checkoutProductDisplaySize = (assetKey: string): CheckoutProductDisplaySize => {
  if (assetKey === "product-apple") return { width: 58, height: 58 };
  if (assetKey === "product-oats-canister") return { width: 60, height: 64 };
  if (assetKey === "product-chips-bag") return { width: 62, height: 68 };
  return { width: 60, height: 72 };
};

const trimmedCheckoutProductSources = new Map<string, string>();

/**
 * Checkout products come from several art batches. Some fill their PNG canvas,
 * while older assets keep large transparent margins. Crop the alpha bounds at
 * runtime so the visible product, rather than its source canvas, owns sizing.
 */
const trimTransparentProduct = (image: HTMLImageElement, sourcePath: string): void => {
  const sourceWidth = image.naturalWidth;
  const sourceHeight = image.naturalHeight;
  if (sourceWidth < 1 || sourceHeight < 1) return;

  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = sourceWidth;
  sourceCanvas.height = sourceHeight;
  const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
  if (!sourceContext) return;
  sourceContext.drawImage(image, 0, 0);

  const pixels = sourceContext.getImageData(0, 0, sourceWidth, sourceHeight).data;
  let left = sourceWidth;
  let top = sourceHeight;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < sourceHeight; y += 1) {
    for (let x = 0; x < sourceWidth; x += 1) {
      if ((pixels[(y * sourceWidth + x) * 4 + 3] ?? 0) < 8) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < left || bottom < top) return;

  const cropWidth = right - left + 1;
  const cropHeight = bottom - top + 1;
  const outputScale = Math.min(1, 256 / Math.max(cropWidth, cropHeight));
  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = Math.max(1, Math.round(cropWidth * outputScale));
  outputCanvas.height = Math.max(1, Math.round(cropHeight * outputScale));
  const outputContext = outputCanvas.getContext("2d");
  if (!outputContext) return;
  outputContext.drawImage(
    sourceCanvas,
    left,
    top,
    cropWidth,
    cropHeight,
    0,
    0,
    outputCanvas.width,
    outputCanvas.height
  );
  const trimmedSource = outputCanvas.toDataURL("image/png");
  trimmedCheckoutProductSources.set(sourcePath, trimmedSource);
  image.src = trimmedSource;
  image.dataset.alphaTrimmed = "true";
};

export function mountCheckoutScanDom(config: CheckoutScanDomConfig): CheckoutScanDomHandle {
  if (config.productAssets.length < 3) {
    throw new Error("Checkout scan interaction requires at least three product assets");
  }

  const overlay = document.createElement("section");
  overlay.id = "checkout-scan-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Checkout item scanning");
  applyStyles(overlay, {
    position: "fixed",
    inset: "0",
    zIndex: "9500",
    display: "none",
    alignItems: "flex-end",
    justifyContent: "center",
    padding: "14px",
    boxSizing: "border-box",
    background: "rgba(3, 9, 6, 0.22)",
    fontFamily: "Arial, sans-serif",
    color: "#ffffff",
    touchAction: "none",
    pointerEvents: "auto"
  });

  const panel = document.createElement("div");
  applyStyles(panel, {
    width: "min(860px, 100%)",
    padding: "16px",
    boxSizing: "border-box",
    border: "1px solid rgba(255, 217, 94, 0.52)",
    borderRadius: "20px",
    background: "rgba(9, 27, 18, 0.97)",
    boxShadow: "0 18px 55px rgba(0, 0, 0, 0.46)"
  });

  const header = document.createElement("div");
  applyStyles(header, {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: "8px",
    marginBottom: "10px"
  });
  const title = document.createElement("div");
  title.textContent = "Scan the basket";
  applyStyles(title, { fontSize: "20px", fontWeight: "900" });
  const customerLabel = document.createElement("div");
  applyStyles(customerLabel, {
    color: "#ffd95e",
    fontSize: "12px",
    fontWeight: "900",
    letterSpacing: "1px"
  });
  header.append(title, customerLabel);

  const instruction = document.createElement("div");
  instruction.textContent = "Drag every item through the scanner. Payment unlocks only when the basket is empty.";
  applyStyles(instruction, {
    marginBottom: "12px",
    color: "#cfe1d4",
    fontSize: "13px",
    lineHeight: "1.4"
  });

  const workArea = document.createElement("div");
  applyStyles(workArea, {
    display: "grid",
    gridTemplateColumns: "minmax(250px, 1.5fr) minmax(150px, 0.8fr) minmax(150px, 0.8fr)",
    gap: "12px",
    alignItems: "stretch"
  });

  const basket = document.createElement("div");
  basket.id = "checkout-product-basket";
  applyStyles(basket, {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(72px, 1fr))",
    gap: "9px",
    minHeight: "142px",
    padding: "10px",
    boxSizing: "border-box",
    border: "2px solid rgba(255,255,255,0.14)",
    borderRadius: "15px",
    background: "rgba(255,255,255,0.055)"
  });

  const scanner = document.createElement("div");
  scanner.id = "checkout-scan-zone";
  scanner.setAttribute("aria-label", config.spec.scannerLabel);
  applyStyles(scanner, {
    position: "relative",
    display: "grid",
    placeItems: "center",
    minHeight: "142px",
    border: "2px dashed rgba(103, 216, 145, 0.68)",
    borderRadius: "15px",
    background: "rgba(57, 132, 84, 0.12)",
    overflow: "hidden",
    transition: "background 120ms ease, transform 120ms ease"
  });
  if (config.scannerAsset) {
    const scannerImage = document.createElement("img");
    scannerImage.src = assetUrl(config.scannerAsset.path);
    scannerImage.alt = "";
    scannerImage.draggable = false;
    applyStyles(scannerImage, {
      width: "94px",
      height: "78px",
      objectFit: "contain",
      opacity: "0.9",
      pointerEvents: "none"
    });
    scanner.appendChild(scannerImage);
  }
  const beam = document.createElement("div");
  applyStyles(beam, {
    position: "absolute",
    left: "12%",
    right: "12%",
    top: "50%",
    height: "5px",
    borderRadius: "999px",
    background: "#72ef9e",
    boxShadow: "0 0 15px rgba(114, 239, 158, 0.9)",
    pointerEvents: "none"
  });
  const scannerLabel = document.createElement("span");
  scannerLabel.textContent = config.spec.scannerLabel;
  applyStyles(scannerLabel, {
    position: "absolute",
    left: "8px",
    right: "8px",
    bottom: "8px",
    textAlign: "center",
    color: "#aef3c4",
    fontSize: "10px",
    fontWeight: "900",
    letterSpacing: "1px",
    pointerEvents: "none"
  });
  scanner.append(beam, scannerLabel);

  const payment = document.createElement("button");
  payment.id = "checkout-payment-button";
  payment.type = "button";
  payment.disabled = true;
  payment.textContent = config.spec.paymentLabel;
  applyStyles(payment, {
    minHeight: "142px",
    border: "0",
    borderRadius: "15px",
    background: "rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.42)",
    fontSize: "13px",
    fontWeight: "900",
    letterSpacing: "0.8px",
    cursor: "not-allowed"
  });
  if (config.posAsset) {
    const posImage = document.createElement("img");
    posImage.src = assetUrl(config.posAsset.path);
    posImage.alt = "";
    posImage.draggable = false;
    applyStyles(posImage, {
      display: "block",
      width: "78px",
      height: "62px",
      margin: "0 auto 8px",
      objectFit: "contain",
      pointerEvents: "none",
      opacity: "0.82"
    });
    payment.prepend(posImage);
  }

  const feedback = document.createElement("div");
  feedback.id = "checkout-scan-feedback";
  feedback.setAttribute("aria-live", "polite");
  applyStyles(feedback, {
    minHeight: "18px",
    marginTop: "10px",
    textAlign: "center",
    color: "#a9cfb7",
    fontSize: "12px",
    fontWeight: "700"
  });

  workArea.append(basket, scanner, payment);
  panel.append(header, instruction, workArea, feedback);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  document.body.dataset.checkoutScan = "waiting";
  document.body.dataset.checkoutScanCustomer = "0";
  document.body.dataset.checkoutScanScanned = "0";
  document.body.dataset.checkoutScanItems = "0";

  let activeCustomer = -1;
  let cards: ProductCardState[] = [];
  let pollId = 0;
  let destroyed = false;

  const scenePort = (): CheckoutScenePort | undefined => {
    try {
      return config.game.scene.getScene(config.sceneKey) as unknown as CheckoutScenePort;
    } catch {
      return undefined;
    }
  };

  const snapshot = () => scenePort()?.controller?.snapshot?.();
  const isReady = () => Boolean(scenePort()?.isInteractionReady?.());
  const setSceneInputEnabled = (enabled: boolean): void => {
    const input = scenePort()?.input;
    if (input) input.enabled = enabled;
  };

  const setPaymentEnabled = (enabled: boolean): void => {
    payment.disabled = !enabled;
    payment.style.cursor = enabled ? "pointer" : "not-allowed";
    payment.style.background = enabled
      ? "linear-gradient(180deg, #f3ce59, #d7aa31)"
      : "rgba(255,255,255,0.08)";
    payment.style.color = enabled ? "#172117" : "rgba(255,255,255,0.42)";
  };

  const scannedCount = (): number => cards.filter((card) => card.scanned).length;

  const updateFeedback = (): void => {
    const count = scannedCount();
    document.body.dataset.checkoutScanScanned = String(count);
    feedback.textContent = count === cards.length
      ? "Basket complete. Confirm payment."
      : `Scanned ${count}/${cards.length}`;
    feedback.style.color = count === cards.length ? "#ffd95e" : "#a9cfb7";
    setPaymentEnabled(count === cards.length);
  };

  const scanCard = (card: ProductCardState): void => {
    if (card.scanned) return;
    card.scanned = true;
    card.element.style.opacity = "0";
    card.element.style.transform = "scale(0.78) translateY(-8px)";
    card.element.style.pointerEvents = "none";
    scanner.style.background = "rgba(57, 132, 84, 0.34)";
    scanner.style.transform = "scale(1.025)";
    window.setTimeout(() => {
      scanner.style.background = "rgba(57, 132, 84, 0.12)";
      scanner.style.transform = "scale(1)";
    }, 150);
    updateFeedback();
  };

  const createProductCard = (asset: AssetDescriptor, itemIndex: number): ProductCardState => {
    const card = document.createElement("div");
    card.className = "checkout-product-card";
    card.dataset.itemIndex = String(itemIndex);
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `Scan item ${itemIndex + 1}`);
    applyStyles(card, {
      position: "relative",
      display: "grid",
      placeItems: "center",
      minHeight: "104px",
      border: "1px solid rgba(255,255,255,0.16)",
      borderRadius: "12px",
      background: "rgba(255,255,255,0.08)",
      cursor: "grab",
      userSelect: "none",
      touchAction: "none",
      transition: "opacity 160ms ease, transform 160ms ease, border-color 120ms ease"
    });
    const image = document.createElement("img");
    image.alt = "";
    image.draggable = false;
    const displaySize = checkoutProductDisplaySize(asset.key);
    applyStyles(image, {
      width: `${displaySize.width}px`,
      height: `${displaySize.height}px`,
      objectFit: "contain",
      objectPosition: "center bottom",
      pointerEvents: "none",
      filter: "drop-shadow(0 6px 8px rgba(0,0,0,0.28))"
    });
    const cachedTrimmedSource = trimmedCheckoutProductSources.get(asset.path);
    if (cachedTrimmedSource) {
      image.src = cachedTrimmedSource;
      image.dataset.alphaTrimmed = "true";
    } else {
      image.addEventListener("load", () => trimTransparentProduct(image, asset.path), { once: true });
      image.src = assetUrl(asset.path);
    }
    card.appendChild(image);

    const state: ProductCardState = { element: card, asset, scanned: false };
    let pointerId: number | undefined;
    let startX = 0;
    let startY = 0;
    let translateX = 0;
    let translateY = 0;

    const reset = (): void => {
      pointerId = undefined;
      translateX = 0;
      translateY = 0;
      card.style.transform = "translate(0,0)";
      card.style.zIndex = "";
      card.style.cursor = "grab";
      card.style.borderColor = "rgba(255,255,255,0.16)";
    };

    const centreInScanner = (): boolean => {
      const cardRect = card.getBoundingClientRect();
      const scanRect = scanner.getBoundingClientRect();
      const x = cardRect.left + cardRect.width / 2;
      const y = cardRect.top + cardRect.height / 2;
      return x >= scanRect.left && x <= scanRect.right && y >= scanRect.top && y <= scanRect.bottom;
    };

    card.addEventListener("pointerdown", (event) => {
      if (state.scanned) return;
      event.preventDefault();
      event.stopPropagation();
      pointerId = event.pointerId;
      startX = event.clientX - translateX;
      startY = event.clientY - translateY;
      card.setPointerCapture(event.pointerId);
      card.style.zIndex = "4";
      card.style.cursor = "grabbing";
      card.style.borderColor = "#ffd95e";
    });
    card.addEventListener("pointermove", (event) => {
      if (pointerId !== event.pointerId || state.scanned) return;
      event.preventDefault();
      event.stopPropagation();
      translateX = event.clientX - startX;
      translateY = event.clientY - startY;
      card.style.transform = `translate(${translateX}px, ${translateY}px)`;
      scanner.style.transform = centreInScanner() ? "scale(1.025)" : "scale(1)";
    });
    card.addEventListener("pointerup", (event) => {
      if (pointerId !== event.pointerId || state.scanned) return;
      event.preventDefault();
      event.stopPropagation();
      if (card.hasPointerCapture(event.pointerId)) card.releasePointerCapture(event.pointerId);
      if (centreInScanner()) scanCard(state);
      else {
        feedback.textContent = "Move the whole product through the scan zone";
        feedback.style.color = "#ffad98";
        reset();
      }
    });
    card.addEventListener("pointercancel", reset);
    card.addEventListener("keydown", (event) => {
      if ((event.key !== "Enter" && event.key !== " ") || state.scanned) return;
      event.preventDefault();
      scanCard(state);
    });
    return state;
  };

  const itemCountFor = (customerIndex: number): number => (
    config.spec.itemCountPattern[customerIndex % config.spec.itemCountPattern.length]
  );

  const showCustomer = (customerIndex: number): void => {
    if (destroyed || customerIndex === activeCustomer || !isReady()) return;
    activeCustomer = customerIndex;
    basket.replaceChildren();
    const itemCount = itemCountFor(customerIndex);
    cards = Array.from({ length: itemCount }, (_, itemIndex) => {
      const asset = config.productAssets[(customerIndex * 2 + itemIndex) % config.productAssets.length];
      const card = createProductCard(asset, itemIndex);
      basket.appendChild(card.element);
      return card;
    });
    customerLabel.textContent = `CUSTOMER ${customerIndex + 1}/${config.totalCustomers}`;
    overlay.style.display = "flex";
    setSceneInputEnabled(false);
    document.body.dataset.checkoutScan = "active";
    document.body.dataset.checkoutScanCustomer = String(customerIndex + 1);
    document.body.dataset.checkoutScanItems = String(itemCount);
    document.body.dataset.checkoutScanScanned = "0";
    updateFeedback();
    cards[0]?.element.focus();
  };

  const hide = (): void => {
    overlay.style.display = "none";
    setSceneInputEnabled(true);
    document.body.dataset.checkoutScan = "waiting";
    setPaymentEnabled(false);
  };

  const poll = (): void => {
    if (destroyed) return;
    const state = snapshot();
    if (state?.step === "serve" && state.customersServed < state.totalCustomers) {
      showCustomer(state.customersServed);
    } else if (state?.step === "complete") {
      hide();
      document.body.dataset.checkoutScan = "complete";
    }
  };

  payment.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (payment.disabled || scannedCount() !== cards.length || !isReady()) {
      feedback.textContent = "Scan every item before payment";
      feedback.style.color = "#ffad98";
      return;
    }
    const action = scenePort()?.children?.getByName?.("shift-hud-action");
    if (!action) {
      feedback.textContent = "The register action is not available";
      feedback.style.color = "#ffad98";
      return;
    }
    document.body.dataset.checkoutScan = "committing";
    action.emit("pointerdown");
  });

  const blockUnderlyingPointer = (event: Event): void => event.stopPropagation();
  overlay.addEventListener("pointerdown", blockUnderlyingPointer);
  overlay.addEventListener("pointermove", blockUnderlyingPointer);
  overlay.addEventListener("pointerup", blockUnderlyingPointer);
  overlay.addEventListener("click", blockUnderlyingPointer);
  overlay.addEventListener("dblclick", blockUnderlyingPointer);
  overlay.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });

  const disposers = [
    gameDomainEvents.subscribe("task.action-accepted", (event) => {
      if (event.payload.levelId !== config.levelId) return;
      if (event.payload.action === "OPEN_REGISTER") {
        activeCustomer = -1;
        window.setTimeout(poll, 0);
      }
      if (event.payload.action === "SCAN_CUSTOMER") {
        hide();
        activeCustomer = -1;
      }
    }),
    gameDomainEvents.subscribe("task.completed", (event) => {
      if (event.payload.levelId !== config.levelId) return;
      hide();
      document.body.dataset.checkoutScan = "complete";
    })
  ];
  pollId = window.setInterval(poll, 100);

  return Object.freeze({
    destroy: () => {
      destroyed = true;
      window.clearInterval(pollId);
      disposers.forEach((dispose) => dispose());
      setSceneInputEnabled(true);
      overlay.remove();
      delete document.body.dataset.checkoutScan;
      delete document.body.dataset.checkoutScanCustomer;
      delete document.body.dataset.checkoutScanScanned;
      delete document.body.dataset.checkoutScanItems;
    }
  });
}
