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
  readonly bagAsset?: AssetDescriptor;
  readonly receiptAsset?: AssetDescriptor;
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
  instruction.textContent = "Drag every item through the scanner. Scanned products are packed into the bag before payment.";
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
  applyStyles(payment, {
    position: "relative",
    minHeight: "142px",
    padding: "6px 8px 10px",
    border: "0",
    borderRadius: "15px",
    background: "rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.42)",
    fontSize: "13px",
    fontWeight: "900",
    letterSpacing: "0.8px",
    cursor: "not-allowed",
    overflow: "hidden"
  });

  const bagStage = document.createElement("div");
  bagStage.id = "checkout-bag-stage";
  applyStyles(bagStage, {
    position: "relative",
    width: "104px",
    height: "82px",
    margin: "0 auto 2px",
    pointerEvents: "none"
  });
  if (config.bagAsset) {
    const bagImage = document.createElement("img");
    bagImage.src = assetUrl(config.bagAsset.path);
    bagImage.alt = "";
    bagImage.draggable = false;
    applyStyles(bagImage, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      objectFit: "contain",
      filter: "drop-shadow(0 5px 7px rgba(0,0,0,0.28))"
    });
    bagStage.appendChild(bagImage);
  }
  const bagFill = document.createElement("div");
  bagFill.id = "checkout-bag-fill";
  applyStyles(bagFill, {
    position: "absolute",
    left: "25%",
    right: "24%",
    top: "21%",
    bottom: "20%",
    overflow: "hidden"
  });
  bagStage.appendChild(bagFill);

  if (config.posAsset) {
    const posImage = document.createElement("img");
    posImage.src = assetUrl(config.posAsset.path);
    posImage.alt = "";
    posImage.draggable = false;
    applyStyles(posImage, {
      position: "absolute",
      width: "44px",
      height: "36px",
      right: "5px",
      top: "5px",
      objectFit: "contain",
      pointerEvents: "none",
      opacity: "0.74"
    });
    payment.appendChild(posImage);
  }

  const receiptImage = document.createElement("img");
  if (config.receiptAsset) receiptImage.src = assetUrl(config.receiptAsset.path);
  receiptImage.alt = "";
  receiptImage.draggable = false;
  applyStyles(receiptImage, {
    position: "absolute",
    width: "62px",
    height: "72px",
    right: "6px",
    top: "32px",
    objectFit: "contain",
    pointerEvents: "none",
    opacity: "0",
    transform: "translateY(-18px) rotate(4deg)",
    transition: "opacity 120ms ease, transform 220ms ease",
    filter: "drop-shadow(0 5px 7px rgba(0,0,0,0.3))"
  });
  if (config.receiptAsset) payment.appendChild(receiptImage);

  const paymentLabel = document.createElement("span");
  paymentLabel.textContent = config.spec.paymentLabel;
  applyStyles(paymentLabel, {
    position: "relative",
    zIndex: "2",
    display: "block"
  });
  payment.append(bagStage, paymentLabel);

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
      ? "Bag packed. Confirm payment."
      : `Scanned and packed ${count}/${cards.length}`;
    feedback.style.color = count === cards.length ? "#ffd95e" : "#a9cfb7";
    setPaymentEnabled(count === cards.length);
  };

  const addProductToBag = (asset: AssetDescriptor): void => {
    const packedProduct = document.createElement("img");
    packedProduct.src = assetUrl(asset.path);
    packedProduct.alt = "";
    packedProduct.draggable = false;
    const itemIndex = bagFill.childElementCount;
    applyStyles(packedProduct, {
      position: "absolute",
      width: "30px",
      height: "36px",
      left: `${Math.min(46, 4 + itemIndex * 15)}%`,
      bottom: `${Math.min(18, itemIndex * 3)}%`,
      objectFit: "contain",
      transform: `translateX(-50%) rotate(${itemIndex % 2 === 0 ? -5 : 5}deg)`,
      filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.3))"
    });
    bagFill.appendChild(packedProduct);
  };

  const scanCard = (card: ProductCardState): void => {
    if (card.scanned) return;
    card.scanned = true;
    addProductToBag(card.asset);
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
    image.src = assetUrl(asset.path);
    image.alt = "";
    image.draggable = false;
    applyStyles(image, {
      width: "70px",
      height: "76px",
      objectFit: "contain",
      pointerEvents: "none",
      filter: "drop-shadow(0 6px 8px rgba(0,0,0,0.28))"
    });
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
    bagFill.replaceChildren();
    receiptImage.style.opacity = "0";
    receiptImage.style.transform = "translateY(-18px) rotate(4deg)";
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
    setPaymentEnabled(false);
    feedback.textContent = "Payment accepted. Receipt printed.";
    feedback.style.color = "#ffd95e";
    if (config.receiptAsset) {
      receiptImage.style.opacity = "1";
      receiptImage.style.transform = "translateY(0) rotate(4deg)";
    }
    window.setTimeout(() => action.emit("pointerdown"), config.receiptAsset ? 240 : 0);
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
