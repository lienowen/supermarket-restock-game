import type Phaser from "phaser";
import type { AssetDescriptor } from "../../assets/AssetDescriptor";
import type { CheckoutPatienceExperienceSpec } from "../../content/experience/CheckoutPatienceExperienceSpec";
import { gameDomainEvents } from "../../events/GameDomainEvents";

export interface CheckoutPatienceDomConfig {
  readonly game: Phaser.Game;
  readonly sceneKey: string;
  readonly levelId: string;
  readonly spec: CheckoutPatienceExperienceSpec;
  readonly standardProductAssets: readonly AssetDescriptor[];
  readonly weighedProductAsset: AssetDescriptor;
  readonly scannerAsset?: AssetDescriptor;
  readonly posAsset?: AssetDescriptor;
}

export interface CheckoutPatienceDomHandle {
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

const applyStyles = (element: HTMLElement, styles: Partial<CSSStyleDeclaration>): void => {
  Object.assign(element.style, styles);
};

const assetUrl = (path: string): string => `/${path.replace(/^\/+/, "")}`;

export function mountCheckoutPatienceDom(
  config: CheckoutPatienceDomConfig
): CheckoutPatienceDomHandle {
  if (config.standardProductAssets.length < 3) {
    throw new Error("Checkout patience interaction requires at least three standard products");
  }

  const overlay = document.createElement("section");
  overlay.id = "checkout-patience-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Evening checkout service");
  applyStyles(overlay, {
    position: "fixed",
    inset: "0",
    zIndex: "9540",
    display: "none",
    alignItems: "flex-end",
    justifyContent: "center",
    padding: "14px",
    boxSizing: "border-box",
    background: "rgba(3, 9, 6, 0.34)",
    color: "#ffffff",
    fontFamily: "Arial, sans-serif",
    touchAction: "none",
    pointerEvents: "auto"
  });

  const panel = document.createElement("div");
  applyStyles(panel, {
    width: "min(920px, 100%)",
    padding: "15px 16px 16px",
    boxSizing: "border-box",
    border: "1px solid rgba(255, 217, 94, 0.58)",
    borderRadius: "20px",
    background: "rgba(9, 27, 18, 0.98)",
    boxShadow: "0 18px 55px rgba(0, 0, 0, 0.48)"
  });

  const header = document.createElement("div");
  applyStyles(header, {
    display: "grid",
    gridTemplateColumns: "minmax(160px, 1fr) minmax(240px, 1.5fr)",
    gap: "14px",
    alignItems: "end",
    marginBottom: "10px"
  });

  const headingWrap = document.createElement("div");
  const eyebrow = document.createElement("div");
  eyebrow.textContent = "PEAK SERVICE";
  applyStyles(eyebrow, {
    color: "#ffd95e",
    fontSize: "10px",
    fontWeight: "900",
    letterSpacing: "1.4px"
  });
  const title = document.createElement("div");
  title.textContent = "Evening checkout";
  applyStyles(title, {
    marginTop: "3px",
    fontSize: "20px",
    fontWeight: "900"
  });
  const customerLabel = document.createElement("div");
  applyStyles(customerLabel, {
    marginTop: "4px",
    color: "#cfe1d4",
    fontSize: "12px",
    fontWeight: "800"
  });
  headingWrap.append(eyebrow, title, customerLabel);

  const patienceWrap = document.createElement("div");
  const patienceHeader = document.createElement("div");
  applyStyles(patienceHeader, {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "5px",
    color: "#dcebe1",
    fontSize: "10px",
    fontWeight: "900",
    letterSpacing: "0.9px"
  });
  const patienceTitle = document.createElement("span");
  patienceTitle.textContent = "CUSTOMER PATIENCE";
  const patienceValue = document.createElement("span");
  patienceValue.textContent = "100%";
  patienceHeader.append(patienceTitle, patienceValue);
  const patienceTrack = document.createElement("div");
  applyStyles(patienceTrack, {
    height: "14px",
    borderRadius: "999px",
    overflow: "hidden",
    background: "rgba(0,0,0,0.36)",
    border: "1px solid rgba(255,255,255,0.12)"
  });
  const patienceFill = document.createElement("div");
  applyStyles(patienceFill, {
    width: "100%",
    height: "100%",
    borderRadius: "999px",
    background: "linear-gradient(90deg, #4bc477, #8eea9e)",
    transition: "width 90ms linear, background 120ms ease"
  });
  patienceTrack.appendChild(patienceFill);
  patienceWrap.append(patienceHeader, patienceTrack);
  header.append(headingWrap, patienceWrap);

  const instruction = document.createElement("div");
  instruction.textContent = "Scan the standard item, enter the apple weight shown on the produce label, then take payment before patience runs out.";
  applyStyles(instruction, {
    marginBottom: "11px",
    color: "#cfe1d4",
    fontSize: "13px",
    lineHeight: "1.4"
  });

  const workArea = document.createElement("div");
  applyStyles(workArea, {
    display: "grid",
    gridTemplateColumns: "minmax(150px, 0.85fr) minmax(150px, 0.8fr) minmax(230px, 1.25fr) minmax(150px, 0.8fr)",
    gap: "10px",
    alignItems: "stretch"
  });

  const standardCard = document.createElement("div");
  standardCard.id = "patience-standard-item";
  standardCard.tabIndex = 0;
  standardCard.setAttribute("role", "button");
  standardCard.setAttribute("aria-label", "Drag the standard item to the scanner");
  applyStyles(standardCard, {
    position: "relative",
    display: "grid",
    placeItems: "center",
    minHeight: "154px",
    border: "2px solid rgba(255,255,255,0.2)",
    borderRadius: "15px",
    background: "rgba(255,255,255,0.065)",
    cursor: "grab",
    userSelect: "none",
    touchAction: "none",
    transition: "border-color 120ms ease, opacity 120ms ease, transform 120ms ease"
  });
  const standardImage = document.createElement("img");
  standardImage.alt = "";
  standardImage.draggable = false;
  applyStyles(standardImage, {
    width: "90px",
    height: "100px",
    objectFit: "contain",
    pointerEvents: "none",
    filter: "drop-shadow(0 8px 10px rgba(0,0,0,0.3))"
  });
  const standardLabel = document.createElement("span");
  standardLabel.textContent = "STANDARD ITEM";
  applyStyles(standardLabel, {
    position: "absolute",
    left: "7px",
    right: "7px",
    bottom: "7px",
    textAlign: "center",
    fontSize: "9px",
    fontWeight: "900",
    letterSpacing: "0.8px",
    pointerEvents: "none"
  });
  standardCard.append(standardImage, standardLabel);

  const scanner = document.createElement("div");
  scanner.id = "patience-scan-zone";
  scanner.setAttribute("aria-label", config.spec.scannerLabel);
  applyStyles(scanner, {
    position: "relative",
    display: "grid",
    placeItems: "center",
    minHeight: "154px",
    border: "2px dashed rgba(103, 216, 145, 0.7)",
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
      width: "92px",
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
    left: "7px",
    right: "7px",
    bottom: "8px",
    textAlign: "center",
    color: "#aef3c4",
    fontSize: "9px",
    fontWeight: "900",
    letterSpacing: "0.8px",
    pointerEvents: "none"
  });
  scanner.append(beam, scannerLabel);

  const scalePanel = document.createElement("div");
  scalePanel.id = "produce-scale-panel";
  applyStyles(scalePanel, {
    display: "grid",
    gridTemplateRows: "auto auto 1fr",
    minHeight: "154px",
    padding: "10px",
    boxSizing: "border-box",
    border: "2px solid rgba(255,217,94,0.38)",
    borderRadius: "15px",
    background: "rgba(220,181,63,0.08)"
  });
  const produceRow = document.createElement("div");
  applyStyles(produceRow, {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px"
  });
  const appleImage = document.createElement("img");
  appleImage.src = assetUrl(config.weighedProductAsset.path);
  appleImage.alt = "Apple";
  appleImage.draggable = false;
  applyStyles(appleImage, {
    width: "54px",
    height: "54px",
    objectFit: "contain",
    pointerEvents: "none"
  });
  const weightTicket = document.createElement("div");
  weightTicket.id = "produce-target-weight";
  applyStyles(weightTicket, {
    padding: "8px 10px",
    borderRadius: "10px",
    background: "#f4ead0",
    color: "#26352d",
    fontSize: "13px",
    fontWeight: "900",
    whiteSpace: "nowrap"
  });
  produceRow.append(appleImage, weightTicket);
  const scaleInstruction = document.createElement("div");
  scaleInstruction.textContent = config.spec.scaleLabel;
  applyStyles(scaleInstruction, {
    margin: "7px 0",
    textAlign: "center",
    color: "#ffe993",
    fontSize: "9px",
    fontWeight: "900",
    letterSpacing: "0.8px"
  });
  const weightChoices = document.createElement("div");
  weightChoices.id = "produce-weight-choices";
  applyStyles(weightChoices, {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "6px",
    alignSelf: "end"
  });
  const weightButtons = config.spec.weightChoicesKg.map((weight) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.weightKg = String(weight);
    button.textContent = `${weight.toFixed(1)} kg`;
    applyStyles(button, {
      minHeight: "40px",
      border: "1px solid rgba(255,255,255,0.18)",
      borderRadius: "9px",
      background: "rgba(255,255,255,0.08)",
      color: "#ffffff",
      fontSize: "11px",
      fontWeight: "900",
      cursor: "pointer"
    });
    weightChoices.appendChild(button);
    return button;
  });
  scalePanel.append(produceRow, scaleInstruction, weightChoices);

  const payment = document.createElement("button");
  payment.id = "patience-payment-button";
  payment.type = "button";
  payment.disabled = true;
  applyStyles(payment, {
    minHeight: "154px",
    border: "0",
    borderRadius: "15px",
    background: "rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.42)",
    fontSize: "12px",
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
    payment.appendChild(posImage);
  }
  const paymentText = document.createElement("span");
  paymentText.textContent = config.spec.paymentLabel;
  payment.appendChild(paymentText);

  const feedback = document.createElement("div");
  feedback.id = "checkout-patience-feedback";
  feedback.setAttribute("aria-live", "polite");
  applyStyles(feedback, {
    minHeight: "18px",
    marginTop: "10px",
    textAlign: "center",
    color: "#a9cfb7",
    fontSize: "12px",
    fontWeight: "800"
  });

  workArea.append(standardCard, scanner, scalePanel, payment);
  panel.append(header, instruction, workArea, feedback);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  document.body.dataset.checkoutPatience = "waiting";
  document.body.dataset.checkoutPatienceMistakes = "0";
  document.body.dataset.checkoutPatienceAbandonments = "0";

  let activeCustomer = -1;
  let standardScanned = false;
  let weightCorrect = false;
  let remainingMs = config.spec.patienceDurationMs;
  let lastFrameMs = performance.now();
  let mistakes = 0;
  let abandonments = 0;
  let visible = false;
  let destroyed = false;
  let pollId = 0;
  let animationId = 0;
  let pointerId: number | undefined;
  let dragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let translateX = 0;
  let translateY = 0;

  const scenePort = (): CheckoutScenePort | undefined => {
    try {
      return config.game.scene.getScene(config.sceneKey) as unknown as CheckoutScenePort;
    } catch {
      return undefined;
    }
  };

  const snapshot = () => scenePort()?.controller?.snapshot?.();
  const setSceneInputEnabled = (enabled: boolean): void => {
    const input = scenePort()?.input;
    if (input) input.enabled = enabled;
  };
  const isReady = () => Boolean(scenePort()?.isInteractionReady?.());

  const setPaymentEnabled = (): void => {
    const enabled = standardScanned && weightCorrect && isReady();
    payment.disabled = !enabled;
    payment.style.cursor = enabled ? "pointer" : "not-allowed";
    payment.style.background = enabled
      ? "linear-gradient(180deg, #f3ce59, #d7aa31)"
      : "rgba(255,255,255,0.08)";
    payment.style.color = enabled ? "#26352d" : "rgba(255,255,255,0.42)";
  };

  const updatePatienceUi = (): void => {
    const ratio = Math.max(0, Math.min(1, remainingMs / config.spec.patienceDurationMs));
    const percent = Math.ceil(ratio * 100);
    patienceFill.style.width = `${percent}%`;
    patienceValue.textContent = `${percent}%`;
    patienceFill.style.background = ratio > 0.55
      ? "linear-gradient(90deg, #4bc477, #8eea9e)"
      : ratio > 0.25
        ? "linear-gradient(90deg, #d9ab35, #f1d267)"
        : "linear-gradient(90deg, #d6534a, #f18b78)";
    document.body.dataset.checkoutPatienceRemaining = String(Math.ceil(remainingMs));
  };

  const resetDrag = (): void => {
    dragging = false;
    pointerId = undefined;
    translateX = 0;
    translateY = 0;
    standardCard.style.transform = "translate(0,0)";
    standardCard.style.zIndex = "";
    standardCard.style.cursor = standardScanned ? "default" : "grab";
    scanner.style.transform = "scale(1)";
    scanner.style.background = "rgba(57, 132, 84, 0.12)";
  };

  const updateCompletionUi = (): void => {
    standardCard.style.opacity = standardScanned ? "0.34" : "1";
    standardCard.setAttribute("aria-disabled", standardScanned ? "true" : "false");
    weightButtons.forEach((button) => {
      button.disabled = weightCorrect;
      if (weightCorrect) {
        button.style.opacity = button.dataset.weightKg === String(config.spec.targetWeightsKg[activeCustomer])
          ? "1"
          : "0.42";
      } else {
        button.style.opacity = "1";
      }
    });
    setPaymentEnabled();
  };

  const prepareCustomer = (customerIndex: number): void => {
    activeCustomer = customerIndex;
    standardScanned = false;
    weightCorrect = false;
    remainingMs = config.spec.patienceDurationMs;
    lastFrameMs = performance.now();
    resetDrag();

    const standardAsset = config.standardProductAssets[
      customerIndex % config.standardProductAssets.length
    ];
    const targetWeight = config.spec.targetWeightsKg[customerIndex];
    if (!standardAsset || targetWeight === undefined) {
      throw new Error(`Missing evening checkout configuration for customer ${customerIndex + 1}`);
    }
    standardImage.src = assetUrl(standardAsset.path);
    standardLabel.textContent = `SCAN ${standardAsset.key.replace(/^product-/, "").replaceAll("-", " ").toUpperCase()}`;
    weightTicket.textContent = `APPLE LABEL  ${targetWeight.toFixed(1)} kg`;
    customerLabel.textContent = `CUSTOMER ${customerIndex + 1} / ${config.totalCustomers ?? config.spec.customerCount}`;
    feedback.textContent = "Scan the standard item and enter the apple weight.";
    feedback.style.color = "#a9cfb7";
    updatePatienceUi();
    updateCompletionUi();
    document.body.dataset.checkoutPatienceCustomer = String(customerIndex + 1);
  };

  const show = (): void => {
    if (visible || destroyed) return;
    visible = true;
    overlay.style.display = "flex";
    setSceneInputEnabled(false);
    document.body.dataset.checkoutPatience = "active";
    lastFrameMs = performance.now();
  };

  const hide = (state: "complete" | "closed"): void => {
    visible = false;
    overlay.style.display = "none";
    setSceneInputEnabled(true);
    document.body.dataset.checkoutPatience = state;
  };

  const scannerContainsCardCentre = (): boolean => {
    const cardRect = standardCard.getBoundingClientRect();
    const scannerRect = scanner.getBoundingClientRect();
    const centreX = cardRect.left + cardRect.width / 2;
    const centreY = cardRect.top + cardRect.height / 2;
    return (
      centreX >= scannerRect.left &&
      centreX <= scannerRect.right &&
      centreY >= scannerRect.top &&
      centreY <= scannerRect.bottom
    );
  };

  const markStandardScanned = (): void => {
    if (standardScanned) return;
    standardScanned = true;
    feedback.textContent = "Standard item scanned. Enter the apple weight.";
    feedback.style.color = "#72ef9e";
    resetDrag();
    updateCompletionUi();
    document.body.dataset.checkoutPatienceScanned = "true";
  };

  standardCard.addEventListener("pointerdown", (event) => {
    if (!visible || standardScanned) return;
    event.preventDefault();
    event.stopPropagation();
    dragging = true;
    pointerId = event.pointerId;
    dragStartX = event.clientX - translateX;
    dragStartY = event.clientY - translateY;
    standardCard.setPointerCapture(event.pointerId);
    standardCard.style.zIndex = "3";
    standardCard.style.cursor = "grabbing";
    standardCard.style.borderColor = "#ffd95e";
  });

  standardCard.addEventListener("pointermove", (event) => {
    if (!dragging || pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    translateX = event.clientX - dragStartX;
    translateY = event.clientY - dragStartY;
    standardCard.style.transform = `translate(${translateX}px, ${translateY}px)`;
    const overScanner = scannerContainsCardCentre();
    scanner.style.transform = overScanner ? "scale(1.025)" : "scale(1)";
    scanner.style.background = overScanner
      ? "rgba(57,132,84,0.3)"
      : "rgba(57,132,84,0.12)";
  });

  standardCard.addEventListener("pointerup", (event) => {
    if (!dragging || pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const accepted = scannerContainsCardCentre();
    if (standardCard.hasPointerCapture(event.pointerId)) standardCard.releasePointerCapture(event.pointerId);
    if (accepted) markStandardScanned();
    else {
      feedback.textContent = "Move the whole item through the scanner.";
      feedback.style.color = "#ffba9b";
      resetDrag();
    }
  });
  standardCard.addEventListener("pointercancel", resetDrag);
  standardCard.addEventListener("keydown", (event) => {
    if ((event.key !== "Enter" && event.key !== " ") || standardScanned) return;
    event.preventDefault();
    markStandardScanned();
  });

  weightButtons.forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!visible || weightCorrect) return;
      const selectedWeight = Number(button.dataset.weightKg);
      const targetWeight = config.spec.targetWeightsKg[activeCustomer];
      if (selectedWeight === targetWeight) {
        weightCorrect = true;
        feedback.textContent = `Apple weight accepted: ${selectedWeight.toFixed(1)} kg.`;
        feedback.style.color = "#72ef9e";
        document.body.dataset.checkoutPatienceWeightCorrect = "true";
      } else {
        mistakes += 1;
        remainingMs = Math.max(0, remainingMs - config.spec.wrongWeightPenaltyMs);
        feedback.textContent = `Wrong weight. Customer patience -${Math.round(config.spec.wrongWeightPenaltyMs / 1000)}s.`;
        feedback.style.color = "#ff9e91";
        document.body.dataset.checkoutPatienceMistakes = String(mistakes);
        updatePatienceUi();
      }
      updateCompletionUi();
    });
  });

  payment.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (payment.disabled || !standardScanned || !weightCorrect || !isReady()) return;
    const action = scenePort()?.children?.getByName?.("shift-hud-action") as Phaser.GameObjects.GameObject | null;
    if (!action) {
      feedback.textContent = "The register action is not available.";
      feedback.style.color = "#ffba9b";
      return;
    }
    payment.disabled = true;
    feedback.textContent = "Payment accepted. Advancing the queue.";
    feedback.style.color = "#ffd95e";
    action.emit("pointerdown");
  });

  const patienceLoop = (nowMs: number): void => {
    if (destroyed) return;
    const delta = Math.min(250, Math.max(0, nowMs - lastFrameMs));
    lastFrameMs = nowMs;
    if (visible && snapshot()?.step === "serve") {
      remainingMs = Math.max(0, remainingMs - delta);
      updatePatienceUi();
      if (remainingMs === 0) {
        abandonments += 1;
        document.body.dataset.checkoutPatienceAbandonments = String(abandonments);
        feedback.textContent = "Customer lost patience. The basket must be started again.";
        feedback.style.color = "#ff786e";
        prepareCustomer(activeCustomer);
      }
    }
    animationId = requestAnimationFrame(patienceLoop);
  };

  const poll = (): void => {
    if (destroyed) return;
    const current = snapshot();
    if (current?.step === "serve") {
      if (current.customersServed !== activeCustomer) prepareCustomer(current.customersServed);
      if (isReady()) show();
      setPaymentEnabled();
    } else if (current?.step === "complete") {
      hide("complete");
    }
    pollId = window.setTimeout(poll, 100);
  };

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
    gameDomainEvents.subscribe("task.completed", (event) => {
      if (event.payload.levelId !== config.levelId) return;
      hide("complete");
    })
  ];

  animationId = requestAnimationFrame(patienceLoop);
  poll();

  return Object.freeze({
    destroy: () => {
      destroyed = true;
      window.clearTimeout(pollId);
      cancelAnimationFrame(animationId);
      disposers.forEach((dispose) => dispose());
      setSceneInputEnabled(true);
      overlay.remove();
      delete document.body.dataset.checkoutPatience;
      delete document.body.dataset.checkoutPatienceRemaining;
      delete document.body.dataset.checkoutPatienceMistakes;
      delete document.body.dataset.checkoutPatienceAbandonments;
      delete document.body.dataset.checkoutPatienceCustomer;
      delete document.body.dataset.checkoutPatienceScanned;
      delete document.body.dataset.checkoutPatienceWeightCorrect;
    }
  });
}
