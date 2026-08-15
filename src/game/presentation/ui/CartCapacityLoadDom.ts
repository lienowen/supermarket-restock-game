import type Phaser from "phaser";
import type {
  CartCapacityExperienceSpec,
  CartCaseSize,
  CartCaseOptionSpec
} from "../../content/experience/CartCapacityExperienceSpec";
import { gameDomainEvents } from "../../events/GameDomainEvents";

export interface CartCapacityLoadOption {
  readonly spec: CartCaseOptionSpec;
  readonly imagePath: string;
}

export interface CartCapacityLoadDomConfig {
  readonly game: Phaser.Game;
  readonly sceneKey: string;
  readonly levelId: string;
  readonly spec: CartCapacityExperienceSpec;
  readonly options: readonly CartCapacityLoadOption[];
  readonly targetImagePath: string;
  readonly loadedTargetImagePath: string;
}

export interface CartCapacityLoadDomHandle {
  readonly destroy: () => void;
}

interface PrimaryActionScenePort {
  readonly isInteractionReady?: () => boolean;
  readonly input?: { enabled: boolean };
  readonly children?: {
    readonly getByName?: (name: string) => Phaser.GameObjects.GameObject | null;
  };
}

interface DragState {
  readonly option: CartCapacityLoadOption;
  readonly card: HTMLElement;
  pointerId?: number;
  startX: number;
  startY: number;
  translateX: number;
  translateY: number;
  dragging: boolean;
  moved: boolean;
}

const CART_CAPACITY = 6;
const DRAG_THRESHOLD = 8;
const UNIT_BY_SIZE: Readonly<Record<CartCaseSize, number>> = Object.freeze({
  small: 1,
  medium: 2,
  large: 3
});

const applyStyles = (element: HTMLElement, styles: Partial<CSSStyleDeclaration>): void => {
  Object.assign(element.style, styles);
};

const assetUrl = (path: string): string => `/${path.replace(/^\/+/, "")}`;
const unitsFor = (option: CartCapacityLoadOption): number => UNIT_BY_SIZE[option.spec.size];
const plural = (units: number): string => `${units} SPACE${units === 1 ? "" : "S"}`;

export function mountCartCapacityLoadDom(
  config: CartCapacityLoadDomConfig
): CartCapacityLoadDomHandle {
  const overlay = document.createElement("section");
  overlay.id = "cart-capacity-load";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", config.spec.title);
  applyStyles(overlay, {
    position: "fixed",
    inset: "0",
    zIndex: "9520",
    display: "none",
    alignItems: "flex-end",
    justifyContent: "center",
    padding: "clamp(8px, 2vh, 18px)",
    boxSizing: "border-box",
    background: "linear-gradient(180deg, rgba(3,9,6,0.06) 0%, rgba(3,9,6,0.48) 100%)",
    color: "#ffffff",
    fontFamily: "Arial, sans-serif",
    touchAction: "none",
    pointerEvents: "auto"
  });

  const panel = document.createElement("div");
  panel.id = "cart-capacity-panel";
  applyStyles(panel, {
    width: "min(920px, 100%)",
    maxHeight: "min(510px, calc(100% - 10px))",
    overflow: "hidden",
    boxSizing: "border-box",
    padding: "12px 14px 14px",
    border: "1px solid rgba(255, 217, 94, 0.58)",
    borderRadius: "18px",
    background: "rgba(9, 27, 18, 0.965)",
    boxShadow: "0 16px 48px rgba(0, 0, 0, 0.48)"
  });

  const heading = document.createElement("div");
  applyStyles(heading, {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "12px"
  });

  const headingCopy = document.createElement("div");
  const eyebrow = document.createElement("div");
  eyebrow.textContent = config.spec.eyebrow;
  applyStyles(eyebrow, {
    color: "#ffd95e",
    fontSize: "10px",
    fontWeight: "900",
    letterSpacing: "1.4px"
  });

  const title = document.createElement("div");
  title.textContent = config.spec.title;
  applyStyles(title, {
    marginTop: "2px",
    fontSize: "clamp(16px, 2.6vh, 20px)",
    fontWeight: "900"
  });
  headingCopy.append(eyebrow, title);

  const tripBadge = document.createElement("div");
  tripBadge.id = "cart-capacity-trip";
  applyStyles(tripBadge, {
    flex: "0 0 auto",
    padding: "7px 11px",
    borderRadius: "999px",
    background: "#ffd95e",
    color: "#183322",
    fontSize: "11px",
    fontWeight: "900",
    letterSpacing: "0.6px"
  });
  heading.append(headingCopy, tripBadge);

  const instruction = document.createElement("p");
  instruction.textContent = config.spec.instruction;
  applyStyles(instruction, {
    margin: "5px 0 9px",
    color: "#d8e8dd",
    fontSize: "12px",
    lineHeight: "1.32"
  });

  const workArea = document.createElement("div");
  applyStyles(workArea, {
    display: "grid",
    gridTemplateColumns: "minmax(360px, 1.22fr) minmax(290px, 0.9fr)",
    gap: "12px",
    alignItems: "stretch"
  });

  const choices = document.createElement("div");
  choices.id = "cart-capacity-options";
  applyStyles(choices, {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(92px, 1fr))",
    gap: "8px"
  });

  const target = document.createElement("div");
  target.id = "cart-capacity-target";
  target.setAttribute("aria-label", config.spec.targetLabel);
  applyStyles(target, {
    position: "relative",
    display: "grid",
    gridTemplateRows: "auto auto auto auto",
    alignContent: "center",
    gap: "6px",
    minHeight: "236px",
    padding: "9px 10px",
    boxSizing: "border-box",
    border: "2px dashed rgba(255, 217, 94, 0.68)",
    borderRadius: "16px",
    background: "rgba(90, 145, 79, 0.12)",
    transition: "border-color 120ms ease, background 120ms ease, transform 120ms ease"
  });

  const cartImage = document.createElement("img");
  cartImage.id = "cart-capacity-cart-image";
  cartImage.src = assetUrl(config.targetImagePath);
  cartImage.alt = "";
  cartImage.draggable = false;
  applyStyles(cartImage, {
    width: "172px",
    height: "92px",
    justifySelf: "center",
    objectFit: "contain",
    opacity: "0.98",
    pointerEvents: "none",
    filter: "drop-shadow(0 7px 11px rgba(0,0,0,0.3))"
  });

  const capacityHeader = document.createElement("div");
  applyStyles(capacityHeader, {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    color: "#e8f3eb",
    fontSize: "10px",
    fontWeight: "900",
    letterSpacing: "0.7px"
  });
  const capacityTitle = document.createElement("span");
  capacityTitle.textContent = "CART SPACE";
  const capacityCount = document.createElement("strong");
  capacityCount.id = "cart-capacity-count";
  capacityCount.textContent = `0/${CART_CAPACITY}`;
  capacityCount.style.color = "#ffd95e";
  capacityHeader.append(capacityTitle, capacityCount);

  const capacityBar = document.createElement("div");
  capacityBar.id = "cart-capacity-bar";
  capacityBar.setAttribute("aria-label", `${CART_CAPACITY} cart spaces`);
  applyStyles(capacityBar, {
    display: "grid",
    gridTemplateColumns: `repeat(${CART_CAPACITY}, 1fr)`,
    gap: "4px",
    width: "100%"
  });
  const capacitySegments: HTMLElement[] = [];
  for (let index = 0; index < CART_CAPACITY; index += 1) {
    const segment = document.createElement("span");
    segment.dataset.capacitySegment = String(index + 1);
    applyStyles(segment, {
      height: "18px",
      borderRadius: "5px",
      border: "1px solid rgba(255,255,255,0.18)",
      background: "rgba(255,255,255,0.07)",
      transition: "background 130ms ease, border-color 130ms ease, transform 130ms ease"
    });
    capacitySegments.push(segment);
    capacityBar.appendChild(segment);
  }

  const loadedPreview = document.createElement("div");
  loadedPreview.id = "cart-capacity-current-load";
  applyStyles(loadedPreview, {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "34px",
    gap: "5px",
    overflow: "hidden"
  });

  const targetLabel = document.createElement("div");
  targetLabel.textContent = "TAP A BOX · OR DRAG IT INTO THE CART";
  applyStyles(targetLabel, {
    textAlign: "center",
    color: "#ffe993",
    fontSize: "9px",
    fontWeight: "900",
    letterSpacing: "0.7px"
  });
  target.append(cartImage, capacityHeader, capacityBar, loadedPreview, targetLabel);

  const footer = document.createElement("div");
  applyStyles(footer, {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    alignItems: "center",
    gap: "10px",
    marginTop: "9px"
  });

  const feedback = document.createElement("div");
  feedback.id = "cart-capacity-feedback";
  feedback.setAttribute("aria-live", "polite");
  applyStyles(feedback, {
    minHeight: "18px",
    color: "#a9cfb7",
    fontSize: "11px",
    fontWeight: "800"
  });

  const undoButton = document.createElement("button");
  undoButton.id = "cart-capacity-undo";
  undoButton.type = "button";
  undoButton.textContent = "UNDO LAST";
  applyStyles(undoButton, {
    minWidth: "112px",
    minHeight: "36px",
    border: "1px solid rgba(255,255,255,0.2)",
    borderRadius: "10px",
    background: "rgba(255,255,255,0.08)",
    color: "#ffffff",
    fontSize: "10px",
    fontWeight: "900",
    letterSpacing: "0.7px",
    cursor: "pointer",
    touchAction: "manipulation"
  });
  footer.append(feedback, undoButton);

  workArea.append(choices, target);
  panel.append(heading, instruction, workArea, footer);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  document.body.dataset.cartCapacityLoad = "waiting";
  document.body.dataset.cartCapacityState = "hidden";
  document.body.dataset.cartCapacityMode = "six-unit-combination-v1";
  document.body.dataset.cartCapacityLoaded = "0";
  document.body.dataset.cartCapacityUnits = "0";
  document.body.dataset.cartCapacityRound = "1";
  document.body.dataset.cartCapacityWrongRejected = "false";
  document.body.dataset.cartCapacityUndoUsed = "false";
  document.body.dataset.cartCapacityFullObserved = "false";

  const committedOptionIds = new Set<string>();
  const currentTripOptionIds: string[] = [];
  const dragStates = new Map<string, DragState>();
  let currentRound = 1;
  let currentUnits = 0;
  let armed = false;
  let visible = false;
  let completed = false;
  let finishing = false;
  let roundTransitioning = false;
  let readinessTimer: number | undefined;
  let roundTimer: number | undefined;

  const scenePort = (): PrimaryActionScenePort | undefined => {
    try {
      return config.game.scene.getScene(config.sceneKey) as unknown as PrimaryActionScenePort;
    } catch {
      return undefined;
    }
  };

  const setSceneInputEnabled = (enabled: boolean): void => {
    const input = scenePort()?.input;
    if (input) input.enabled = enabled;
  };

  const isReady = (): boolean => Boolean(scenePort()?.isInteractionReady?.());
  const isOptionUsed = (id: string): boolean => (
    committedOptionIds.has(id) || currentTripOptionIds.includes(id)
  );

  const updateDatasets = (): void => {
    document.body.dataset.cartCapacityLoaded = String(committedOptionIds.size + currentTripOptionIds.length);
    document.body.dataset.cartCapacityUnits = String(currentUnits);
    document.body.dataset.cartCapacityRound = String(currentRound);
  };

  const renderCapacity = (): void => {
    capacityCount.textContent = `${currentUnits}/${CART_CAPACITY}`;
    capacitySegments.forEach((segment, index) => {
      const filled = index < currentUnits;
      segment.style.background = filled ? "#ffd95e" : "rgba(255,255,255,0.07)";
      segment.style.borderColor = filled ? "#ffe993" : "rgba(255,255,255,0.18)";
      segment.style.transform = filled ? "scaleY(1.06)" : "scale(1)";
    });
  };

  const renderCurrentLoad = (): void => {
    loadedPreview.replaceChildren();
    if (currentTripOptionIds.length === 0) {
      const empty = document.createElement("span");
      empty.textContent = "EMPTY CART";
      applyStyles(empty, {
        color: "#73927d",
        fontSize: "9px",
        fontWeight: "900",
        letterSpacing: "1px"
      });
      loadedPreview.appendChild(empty);
      return;
    }

    currentTripOptionIds.forEach((id) => {
      const option = config.options.find((entry) => entry.spec.id === id);
      if (!option) return;
      const chip = document.createElement("div");
      chip.dataset.loadedCaseId = id;
      applyStyles(chip, {
        display: "flex",
        alignItems: "center",
        gap: "3px",
        padding: "2px 5px",
        border: "1px solid rgba(255,217,94,0.42)",
        borderRadius: "7px",
        background: "rgba(255,217,94,0.09)"
      });
      const image = document.createElement("img");
      image.src = assetUrl(option.imagePath);
      image.alt = "";
      image.draggable = false;
      applyStyles(image, {
        width: "34px",
        height: "24px",
        objectFit: "contain",
        pointerEvents: "none"
      });
      const unit = document.createElement("span");
      unit.textContent = String(unitsFor(option));
      applyStyles(unit, {
        color: "#ffe993",
        fontSize: "9px",
        fontWeight: "900"
      });
      chip.append(image, unit);
      loadedPreview.appendChild(chip);
    });
  };

  const syncCard = (state: DragState): void => {
    const used = isOptionUsed(state.option.spec.id);
    state.card.style.opacity = used ? "0.3" : "1";
    state.card.style.cursor = used ? "default" : "grab";
    state.card.style.borderColor = used
      ? "rgba(255,217,94,0.38)"
      : "rgba(255,255,255,0.2)";
    state.card.setAttribute("aria-disabled", used ? "true" : "false");
    state.card.tabIndex = used ? -1 : 0;
  };

  const syncAllCards = (): void => dragStates.forEach(syncCard);

  const resetTargetStyle = (): void => {
    target.style.borderColor = "rgba(255, 217, 94, 0.68)";
    target.style.background = "rgba(90, 145, 79, 0.12)";
    target.style.transform = "scale(1)";
  };

  const resetCardPosition = (state: DragState): void => {
    state.pointerId = undefined;
    state.startX = 0;
    state.startY = 0;
    state.translateX = 0;
    state.translateY = 0;
    state.dragging = false;
    state.moved = false;
    state.card.style.transform = "translate(0, 0)";
    state.card.style.zIndex = "";
    syncCard(state);
    resetTargetStyle();
  };

  const updateRoundCopy = (): void => {
    tripBadge.textContent = `TRIP ${currentRound} / ${config.spec.roundsRequired}`;
    if (currentUnits === 0) {
      feedback.textContent = `Choose any combination that fills exactly ${CART_CAPACITY} spaces.`;
      feedback.style.color = "#a9cfb7";
    }
  };

  const updateAllVisuals = (): void => {
    updateDatasets();
    renderCapacity();
    renderCurrentLoad();
    syncAllCards();
    undoButton.disabled = currentTripOptionIds.length === 0 || finishing || roundTransitioning;
    undoButton.style.opacity = undoButton.disabled ? "0.38" : "1";
    undoButton.style.cursor = undoButton.disabled ? "default" : "pointer";
    updateRoundCopy();
  };

  const hide = (): void => {
    visible = false;
    overlay.style.display = "none";
    setSceneInputEnabled(true);
    document.body.dataset.cartCapacityLoad = "complete";
    document.body.dataset.cartCapacityState = "hidden";
  };

  const confirmPrimaryAction = (): void => {
    if (completed || !isReady()) return;
    const action = scenePort()?.children?.getByName?.("shift-hud-action") as Phaser.GameObjects.GameObject | null;
    if (!action) {
      feedback.textContent = "The cart action is not available yet";
      feedback.style.color = "#ffba9b";
      finishing = false;
      return;
    }
    feedback.textContent = `TRIP ${config.spec.roundsRequired}/${config.spec.roundsRequired} · PERFECT LOAD`;
    feedback.style.color = "#ffd95e";
    action.emit("pointerdown");
  };

  const show = (): void => {
    if (visible || completed || !armed || !isReady()) return;
    visible = true;
    overlay.style.display = "flex";
    setSceneInputEnabled(false);
    document.body.dataset.cartCapacityLoad = "active";
    document.body.dataset.cartCapacityState = "ready";
    updateAllVisuals();
    requestAnimationFrame(() => choices.querySelector<HTMLElement>("[data-case-id]:not([aria-disabled='true'])")?.focus());
  };

  const beginReadinessWatch = (): void => {
    if (readinessTimer !== undefined) return;
    readinessTimer = window.setInterval(() => {
      if (!visible && !completed) show();
    }, 100);
  };

  const targetContainsCardCentre = (card: HTMLElement): boolean => {
    const sourceRect = card.getBoundingClientRect();
    const centreX = sourceRect.left + sourceRect.width / 2;
    const centreY = sourceRect.top + sourceRect.height / 2;
    const rect = target.getBoundingClientRect();
    return centreX >= rect.left && centreX <= rect.right && centreY >= rect.top && centreY <= rect.bottom;
  };

  const hasRemainingFit = (): boolean => config.options.some((option) => (
    !isOptionUsed(option.spec.id) && unitsFor(option) <= CART_CAPACITY - currentUnits
  ));

  const completeRound = (): void => {
    roundTransitioning = true;
    document.body.dataset.cartCapacityState = "full";
    document.body.dataset.cartCapacityFullObserved = "true";
    cartImage.src = assetUrl(config.loadedTargetImagePath);
    target.style.borderColor = "#ffd95e";
    target.style.background = "rgba(220, 181, 63, 0.24)";
    target.style.transform = "scale(1.018)";
    feedback.textContent = `PERFECT LOAD · ${CART_CAPACITY}/${CART_CAPACITY} · TRIP ${currentRound} READY`;
    feedback.style.color = "#ffd95e";
    undoButton.disabled = true;
    undoButton.style.opacity = "0.38";

    currentTripOptionIds.forEach((id) => committedOptionIds.add(id));
    currentTripOptionIds.splice(0);
    updateDatasets();

    if (currentRound >= config.spec.roundsRequired) {
      finishing = true;
      roundTimer = window.setTimeout(() => {
        if (finishing) confirmPrimaryAction();
      }, 650);
      return;
    }

    roundTimer = window.setTimeout(() => {
      currentRound += 1;
      currentUnits = 0;
      roundTransitioning = false;
      cartImage.src = assetUrl(config.targetImagePath);
      resetTargetStyle();
      document.body.dataset.cartCapacityState = "ready";
      updateAllVisuals();
      requestAnimationFrame(() => choices.querySelector<HTMLElement>("[data-case-id]:not([aria-disabled='true'])")?.focus());
    }, 850);
  };

  const rejectLoad = (state: DragState, message: string): void => {
    document.body.dataset.cartCapacityWrongRejected = "true";
    feedback.textContent = message;
    feedback.style.color = "#ff9e91";
    state.card.style.borderColor = "#ff786e";
    target.style.borderColor = "#ff786e";
    target.style.background = "rgba(214,83,74,0.18)";
    window.setTimeout(() => {
      resetCardPosition(state);
      if (!hasRemainingFit() && currentUnits < CART_CAPACITY) {
        feedback.textContent = "No remaining case fits. Use UNDO LAST and try a different combination.";
        feedback.style.color = "#ffba9b";
      }
    }, 260);
  };

  const tryLoad = (state: DragState): void => {
    const { option } = state;
    if (
      !visible || completed || finishing || roundTransitioning ||
      isOptionUsed(option.spec.id)
    ) {
      resetCardPosition(state);
      return;
    }

    const units = unitsFor(option);
    const nextUnits = currentUnits + units;
    if (nextUnits > CART_CAPACITY) {
      rejectLoad(
        state,
        `TOO FULL · ${currentUnits}/${CART_CAPACITY} + ${units} won't fit. Choose a smaller case or undo.`
      );
      return;
    }

    currentTripOptionIds.push(option.spec.id);
    currentUnits = nextUnits;
    resetCardPosition(state);
    updateAllVisuals();
    feedback.textContent = `${option.spec.label} loaded · ${currentUnits}/${CART_CAPACITY} spaces used`;
    feedback.style.color = "#ffd95e";

    if (currentUnits === CART_CAPACITY) {
      completeRound();
      return;
    }
    if (!hasRemainingFit()) {
      feedback.textContent = "No remaining case fits. Use UNDO LAST and try a different combination.";
      feedback.style.color = "#ffba9b";
    }
  };

  const undoLast = (): void => {
    if (!visible || finishing || roundTransitioning || currentTripOptionIds.length === 0) return;
    const removedId = currentTripOptionIds.pop();
    if (!removedId) return;
    const option = config.options.find((entry) => entry.spec.id === removedId);
    if (option) currentUnits = Math.max(0, currentUnits - unitsFor(option));
    document.body.dataset.cartCapacityUndoUsed = "true";
    cartImage.src = assetUrl(config.targetImagePath);
    resetTargetStyle();
    updateAllVisuals();
    feedback.textContent = `Last case removed · ${currentUnits}/${CART_CAPACITY} spaces used`;
    feedback.style.color = "#a9cfb7";
  };
  undoButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    undoLast();
  });

  config.options.forEach((option, index) => {
    const units = unitsFor(option);
    const card = document.createElement("div");
    card.dataset.caseId = option.spec.id;
    card.dataset.caseSize = option.spec.size;
    card.dataset.capacityUnits = String(units);
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `Load ${option.spec.label}, ${plural(units)}`);
    applyStyles(card, {
      position: "relative",
      display: "grid",
      placeItems: "center",
      minHeight: "92px",
      border: "2px solid rgba(255, 255, 255, 0.2)",
      borderRadius: "13px",
      background: "rgba(255, 255, 255, 0.065)",
      cursor: "grab",
      userSelect: "none",
      WebkitUserSelect: "none",
      touchAction: "none",
      transition: "border-color 120ms ease, opacity 120ms ease, transform 120ms ease"
    });

    const unitBadge = document.createElement("strong");
    unitBadge.textContent = plural(units);
    applyStyles(unitBadge, {
      position: "absolute",
      top: "5px",
      right: "5px",
      zIndex: "2",
      padding: "3px 5px",
      borderRadius: "999px",
      background: units === 3 ? "#d59a36" : units === 2 ? "#6fb56b" : "#5489b7",
      color: "#ffffff",
      fontSize: "8px",
      fontWeight: "900",
      letterSpacing: "0.4px",
      pointerEvents: "none"
    });

    const image = document.createElement("img");
    image.src = assetUrl(option.imagePath);
    image.alt = "";
    image.draggable = false;
    applyStyles(image, {
      width: units === 3 ? "100px" : units === 2 ? "90px" : "78px",
      height: "62px",
      objectFit: "contain",
      pointerEvents: "none",
      filter: "drop-shadow(0 7px 9px rgba(0,0,0,0.28))"
    });

    const label = document.createElement("span");
    label.textContent = `CASE ${String.fromCharCode(65 + index)}`;
    applyStyles(label, {
      position: "absolute",
      left: "5px",
      bottom: "5px",
      color: "#dce9df",
      fontSize: "8px",
      fontWeight: "900",
      letterSpacing: "0.6px",
      pointerEvents: "none"
    });

    card.append(unitBadge, image, label);
    choices.appendChild(card);

    const state: DragState = {
      option,
      card,
      startX: 0,
      startY: 0,
      translateX: 0,
      translateY: 0,
      dragging: false,
      moved: false
    };
    dragStates.set(option.spec.id, state);

    card.addEventListener("pointerdown", (event) => {
      if (!visible || completed || finishing || roundTransitioning || isOptionUsed(option.spec.id)) return;
      event.preventDefault();
      event.stopPropagation();
      state.dragging = true;
      state.moved = false;
      state.pointerId = event.pointerId;
      state.startX = event.clientX;
      state.startY = event.clientY;
      if (card.setPointerCapture) card.setPointerCapture(event.pointerId);
      card.style.zIndex = "6";
      card.style.cursor = "grabbing";
      card.style.borderColor = "#ffd95e";
      feedback.textContent = `${plural(units)} · tap to load or drag into the cart`;
      feedback.style.color = "#d8e8dd";
    });

    card.addEventListener("pointermove", (event) => {
      if (!state.dragging || state.pointerId !== event.pointerId) return;
      event.preventDefault();
      event.stopPropagation();
      state.translateX = event.clientX - state.startX;
      state.translateY = event.clientY - state.startY;
      if (Math.hypot(state.translateX, state.translateY) >= DRAG_THRESHOLD) state.moved = true;
      if (!state.moved) return;
      card.style.transform = `translate(${state.translateX}px, ${state.translateY}px)`;
      const overTarget = targetContainsCardCentre(card);
      target.style.transform = overTarget ? "scale(1.018)" : "scale(1)";
      target.style.borderColor = overTarget ? "#72ef9e" : "rgba(255, 217, 94, 0.68)";
      target.style.background = overTarget ? "rgba(57,132,84,0.26)" : "rgba(90, 145, 79, 0.12)";
    });

    card.addEventListener("pointerup", (event) => {
      if (!state.dragging || state.pointerId !== event.pointerId) return;
      event.preventDefault();
      event.stopPropagation();
      const moved = state.moved;
      const droppedOnTarget = moved && targetContainsCardCentre(card);
      if (card.hasPointerCapture?.(event.pointerId)) card.releasePointerCapture(event.pointerId);
      if (!moved || droppedOnTarget) tryLoad(state);
      else {
        feedback.textContent = "Drop the case inside the cart, or simply tap the case to load it.";
        feedback.style.color = "#ffba9b";
        resetCardPosition(state);
      }
    });

    card.addEventListener("pointercancel", () => resetCardPosition(state));
    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (isOptionUsed(option.spec.id) || finishing || roundTransitioning) return;
      event.preventDefault();
      tryLoad(state);
    });
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
      if (event.payload.action === config.spec.unlockAfterAction) {
        armed = true;
        document.body.dataset.cartCapacityLoad = "armed";
        beginReadinessWatch();
        show();
      }
      if (event.payload.action === config.spec.confirmAction) {
        completed = true;
        finishing = false;
        hide();
      }
    }),
    gameDomainEvents.subscribe("task.completed", (event) => {
      if (event.payload.levelId !== config.levelId) return;
      completed = true;
      finishing = false;
      hide();
    })
  ];

  updateAllVisuals();

  return Object.freeze({
    destroy: () => {
      if (readinessTimer !== undefined) window.clearInterval(readinessTimer);
      if (roundTimer !== undefined) window.clearTimeout(roundTimer);
      disposers.forEach((dispose) => dispose());
      setSceneInputEnabled(true);
      overlay.remove();
      delete document.body.dataset.cartCapacityLoad;
      delete document.body.dataset.cartCapacityState;
      delete document.body.dataset.cartCapacityMode;
      delete document.body.dataset.cartCapacityLoaded;
      delete document.body.dataset.cartCapacityUnits;
      delete document.body.dataset.cartCapacityRound;
      delete document.body.dataset.cartCapacityWrongRejected;
      delete document.body.dataset.cartCapacityUndoUsed;
      delete document.body.dataset.cartCapacityFullObserved;
    }
  });
}
