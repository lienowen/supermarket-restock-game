import type Phaser from "phaser";
import type {
  CartCapacityExperienceSpec,
  CartCapacityLaneSpec,
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
}

const applyStyles = (element: HTMLElement, styles: Partial<CSSStyleDeclaration>): void => {
  Object.assign(element.style, styles);
};

const assetUrl = (path: string): string => `/${path.replace(/^\/+/, "")}`;

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
    padding: "18px",
    boxSizing: "border-box",
    background: "rgba(3, 9, 6, 0.38)",
    color: "#ffffff",
    fontFamily: "Arial, sans-serif",
    touchAction: "none",
    pointerEvents: "auto"
  });

  const panel = document.createElement("div");
  applyStyles(panel, {
    width: "min(940px, 100%)",
    boxSizing: "border-box",
    padding: "16px 18px 18px",
    border: "1px solid rgba(255, 217, 94, 0.58)",
    borderRadius: "20px",
    background: "rgba(9, 27, 18, 0.98)",
    boxShadow: "0 18px 54px rgba(0, 0, 0, 0.48)"
  });

  const eyebrow = document.createElement("div");
  eyebrow.textContent = config.spec.eyebrow;
  applyStyles(eyebrow, {
    color: "#ffd95e",
    fontSize: "10px",
    fontWeight: "900",
    letterSpacing: "1.5px"
  });

  const title = document.createElement("div");
  title.textContent = config.spec.title;
  applyStyles(title, {
    marginTop: "4px",
    fontSize: "20px",
    fontWeight: "900"
  });

  const instruction = document.createElement("p");
  instruction.textContent = config.spec.instruction;
  applyStyles(instruction, {
    margin: "6px 0 12px",
    color: "#d8e8dd",
    fontSize: "13px",
    lineHeight: "1.4"
  });

  const workArea = document.createElement("div");
  applyStyles(workArea, {
    display: "grid",
    gridTemplateColumns: "minmax(340px, 1.25fr) 42px minmax(300px, 1fr)",
    gap: "12px",
    alignItems: "stretch"
  });

  const choices = document.createElement("div");
  choices.id = "cart-capacity-options";
  applyStyles(choices, {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(96px, 1fr))",
    gap: "9px"
  });

  const arrow = document.createElement("div");
  arrow.textContent = "→";
  applyStyles(arrow, {
    display: "grid",
    placeItems: "center",
    color: "#ffd95e",
    fontSize: "30px",
    fontWeight: "900",
    pointerEvents: "none"
  });

  const target = document.createElement("div");
  target.id = "cart-capacity-target";
  target.tabIndex = 0;
  target.setAttribute("role", "button");
  target.setAttribute("aria-label", config.spec.targetLabel);
  applyStyles(target, {
    position: "relative",
    display: "grid",
    gridTemplateRows: "auto auto auto",
    alignItems: "center",
    minHeight: "214px",
    padding: "10px",
    boxSizing: "border-box",
    border: "2px dashed rgba(255, 217, 94, 0.65)",
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
    width: "188px",
    height: "108px",
    justifySelf: "center",
    objectFit: "contain",
    opacity: "0.96",
    pointerEvents: "none",
    filter: "drop-shadow(0 8px 12px rgba(0,0,0,0.3))"
  });

  const slots = document.createElement("div");
  slots.id = "cart-capacity-slots";
  applyStyles(slots, {
    display: "grid",
    gridTemplateColumns: `repeat(${config.spec.lanes.length}, minmax(82px, 1fr))`,
    gap: "7px",
    width: "100%"
  });

  const laneElements = new Map<string, HTMLElement>();

  const renderEmptyLane = (slot: HTMLElement, lane: CartCapacityLaneSpec): void => {
    slot.replaceChildren();
    const size = document.createElement("strong");
    size.textContent = lane.acceptsSize.toUpperCase();
    applyStyles(size, {
      fontSize: "11px",
      color: "#ffe993",
      letterSpacing: "0.8px"
    });
    const label = document.createElement("span");
    label.textContent = lane.label;
    applyStyles(label, {
      marginTop: "2px",
      fontSize: "8px",
      color: "#9bb7a4",
      letterSpacing: "0.6px"
    });
    slot.append(size, label);
    slot.style.borderColor = "rgba(255, 255, 255, 0.18)";
    slot.style.background = "rgba(0, 0, 0, 0.18)";
  };

  config.spec.lanes.forEach((lane) => {
    const slot = document.createElement("div");
    slot.dataset.capacityLaneId = lane.id;
    slot.dataset.capacitySize = lane.acceptsSize;
    applyStyles(slot, {
      display: "grid",
      placeItems: "center",
      alignContent: "center",
      minHeight: "64px",
      border: "1px solid rgba(255, 255, 255, 0.18)",
      borderRadius: "10px",
      color: "#9bb7a4",
      fontSize: "9px",
      fontWeight: "900",
      letterSpacing: "0.8px",
      background: "rgba(0, 0, 0, 0.18)",
      transition: "border-color 120ms ease, background 120ms ease, transform 120ms ease"
    });
    renderEmptyLane(slot, lane);
    laneElements.set(lane.id, slot);
    slots.appendChild(slot);
  });

  const targetLabel = document.createElement("div");
  targetLabel.textContent = config.spec.targetLabel;
  applyStyles(targetLabel, {
    marginTop: "6px",
    textAlign: "center",
    color: "#ffe993",
    fontSize: "10px",
    fontWeight: "900",
    letterSpacing: "1px"
  });
  target.append(cartImage, slots, targetLabel);

  const feedback = document.createElement("div");
  feedback.id = "cart-capacity-feedback";
  feedback.setAttribute("aria-live", "polite");
  applyStyles(feedback, {
    minHeight: "18px",
    marginTop: "10px",
    textAlign: "center",
    color: "#a9cfb7",
    fontSize: "12px",
    fontWeight: "800"
  });

  workArea.append(choices, arrow, target);
  panel.append(eyebrow, title, instruction, workArea, feedback);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  document.body.dataset.cartCapacityLoad = "waiting";
  document.body.dataset.cartCapacityLoaded = "0";
  document.body.dataset.cartCapacityRound = "1";

  const usedOptionIds = new Set<string>();
  const filledLaneIds = new Map<string, string>();
  const dragStates = new Map<string, DragState>();
  let currentRound = 1;
  let armed = false;
  let visible = false;
  let completed = false;
  let finishing = false;
  let selectedKeyboardOptionId: string | undefined;
  let readinessTimer: number | undefined;

  const updateRoundFeedback = (): void => {
    feedback.textContent = `LOAD ${currentRound}/${config.spec.roundsRequired} · Match small, medium and large boxes to their bays`;
    feedback.style.color = "#a9cfb7";
  };
  updateRoundFeedback();

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

  const clearLaneHighlights = (): void => {
    config.spec.lanes.forEach((lane) => {
      const slot = laneElements.get(lane.id);
      if (!slot || filledLaneIds.has(lane.id)) return;
      slot.style.borderColor = "rgba(255, 255, 255, 0.18)";
      slot.style.background = "rgba(0, 0, 0, 0.18)";
      slot.style.transform = "scale(1)";
    });
  };

  const resetCard = (state: DragState): void => {
    state.pointerId = undefined;
    state.startX = 0;
    state.startY = 0;
    state.translateX = 0;
    state.translateY = 0;
    state.dragging = false;
    state.card.style.transform = "translate(0, 0)";
    state.card.style.zIndex = "";
    state.card.style.cursor = usedOptionIds.has(state.option.spec.id) ? "default" : "grab";
    target.style.borderColor = "rgba(255, 217, 94, 0.65)";
    target.style.background = "rgba(90, 145, 79, 0.12)";
    target.style.transform = "scale(1)";
    clearLaneHighlights();
  };

  const hide = (): void => {
    visible = false;
    overlay.style.display = "none";
    setSceneInputEnabled(true);
    document.body.dataset.cartCapacityLoad = "complete";
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
    feedback.textContent = `LOAD ${config.spec.roundsRequired}/${config.spec.roundsRequired} · FULL · NO WASTE`;
    feedback.style.color = "#ffd95e";
    action.emit("pointerdown");
  };

  const show = (): void => {
    if (visible || completed || !armed || !isReady()) return;
    visible = true;
    overlay.style.display = "flex";
    setSceneInputEnabled(false);
    document.body.dataset.cartCapacityLoad = "active";
    requestAnimationFrame(() => choices.querySelector<HTMLElement>("[data-case-id]:not([aria-disabled='true'])")?.focus());
  };

  const beginReadinessWatch = (): void => {
    if (readinessTimer !== undefined) return;
    readinessTimer = window.setInterval(() => {
      if (!visible && !completed) show();
    }, 100);
  };

  const laneAtCardCentre = (card: HTMLElement): CartCapacityLaneSpec | undefined => {
    const sourceRect = card.getBoundingClientRect();
    const centreX = sourceRect.left + sourceRect.width / 2;
    const centreY = sourceRect.top + sourceRect.height / 2;
    return config.spec.lanes.find((lane) => {
      const slot = laneElements.get(lane.id);
      if (!slot) return false;
      const rect = slot.getBoundingClientRect();
      return centreX >= rect.left && centreX <= rect.right && centreY >= rect.top && centreY <= rect.bottom;
    });
  };

  const matchingOpenLane = (option: CartCapacityLoadOption): CartCapacityLaneSpec | undefined => (
    config.spec.lanes.find((lane) => (
      lane.acceptsSize === option.spec.size && !filledLaneIds.has(lane.id)
    ))
  );

  const renderLoadedLane = (
    lane: CartCapacityLaneSpec,
    option: CartCapacityLoadOption
  ): void => {
    const slot = laneElements.get(lane.id);
    if (!slot) return;
    slot.replaceChildren();
    const image = document.createElement("img");
    image.src = assetUrl(option.imagePath);
    image.alt = option.spec.label;
    image.draggable = false;
    applyStyles(image, {
      width: "66px",
      height: "44px",
      objectFit: "contain",
      pointerEvents: "none"
    });
    const label = document.createElement("span");
    label.textContent = lane.label;
    applyStyles(label, {
      fontSize: "8px",
      color: "#ffe993",
      fontWeight: "900",
      letterSpacing: "0.5px"
    });
    slot.append(image, label);
    slot.style.borderColor = "rgba(255, 217, 94, 0.82)";
    slot.style.background = "rgba(220, 181, 63, 0.16)";
  };

  const resetForNextRound = (): void => {
    filledLaneIds.clear();
    currentRound += 1;
    document.body.dataset.cartCapacityRound = String(currentRound);
    cartImage.src = assetUrl(config.targetImagePath);
    config.spec.lanes.forEach((lane) => {
      const slot = laneElements.get(lane.id);
      if (slot) renderEmptyLane(slot, lane);
    });
    updateRoundFeedback();
    requestAnimationFrame(() => choices.querySelector<HTMLElement>("[data-case-id]:not([aria-disabled='true'])")?.focus());
  };

  const completeRound = (): void => {
    cartImage.src = assetUrl(config.loadedTargetImagePath);
    target.style.borderColor = "#ffd95e";
    target.style.background = "rgba(220, 181, 63, 0.22)";
    feedback.textContent = `LOAD ${currentRound}/${config.spec.roundsRequired} · FULL · NO WASTE`;
    feedback.style.color = "#ffd95e";

    if (currentRound < config.spec.roundsRequired) {
      window.setTimeout(resetForNextRound, 700);
      return;
    }

    finishing = true;
    window.setTimeout(() => {
      if (finishing) confirmPrimaryAction();
    }, 320);
  };

  const rejectPlacement = (
    state: DragState,
    lane: CartCapacityLaneSpec,
    message: string
  ): void => {
    const slot = laneElements.get(lane.id);
    feedback.textContent = message;
    feedback.style.color = "#ff9e91";
    state.card.style.borderColor = "#ff786e";
    if (slot) {
      slot.style.borderColor = "#ff786e";
      slot.style.background = "rgba(214, 83, 74, 0.18)";
    }
    window.setTimeout(() => {
      state.card.style.borderColor = "rgba(255, 255, 255, 0.2)";
      resetCard(state);
    }, 280);
  };

  const tryLoad = (state: DragState, lane: CartCapacityLaneSpec): void => {
    const { option, card } = state;
    if (usedOptionIds.has(option.spec.id) || finishing) {
      resetCard(state);
      return;
    }
    if (filledLaneIds.has(lane.id)) {
      rejectPlacement(state, lane, `${lane.label} is already filled`);
      return;
    }
    if (option.spec.size !== lane.acceptsSize) {
      rejectPlacement(
        state,
        lane,
        `${option.spec.label} does not fit the ${lane.label.toLowerCase()}`
      );
      return;
    }

    usedOptionIds.add(option.spec.id);
    filledLaneIds.set(lane.id, option.spec.id);
    renderLoadedLane(lane, option);
    card.style.opacity = "0.28";
    card.style.borderColor = "rgba(255, 217, 94, 0.62)";
    card.setAttribute("aria-disabled", "true");
    card.tabIndex = -1;
    resetCard(state);
    document.body.dataset.cartCapacityLoaded = String(usedOptionIds.size);
    feedback.textContent = `LOAD ${currentRound}/${config.spec.roundsRequired} · ${filledLaneIds.size}/${config.spec.lanes.length} bays filled`;
    feedback.style.color = "#ffd95e";

    if (filledLaneIds.size === config.spec.lanes.length) completeRound();
  };

  config.options.forEach((option) => {
    const card = document.createElement("div");
    card.dataset.caseId = option.spec.id;
    card.dataset.caseSize = option.spec.size;
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `Load ${option.spec.label}`);
    applyStyles(card, {
      position: "relative",
      display: "grid",
      placeItems: "center",
      minHeight: "118px",
      border: "2px solid rgba(255, 255, 255, 0.2)",
      borderRadius: "14px",
      background: "rgba(255, 255, 255, 0.07)",
      cursor: "grab",
      userSelect: "none",
      touchAction: "none",
      transition: "border-color 120ms ease, opacity 120ms ease, transform 120ms ease"
    });

    const image = document.createElement("img");
    image.src = assetUrl(option.imagePath);
    image.alt = "";
    image.draggable = false;
    applyStyles(image, {
      width: option.spec.size === "large" ? "104px" : option.spec.size === "medium" ? "94px" : "82px",
      height: "72px",
      objectFit: "contain",
      pointerEvents: "none",
      filter: "drop-shadow(0 8px 10px rgba(0,0,0,0.3))"
    });

    const label = document.createElement("span");
    label.textContent = option.spec.label;
    applyStyles(label, {
      position: "absolute",
      left: "6px",
      right: "6px",
      bottom: "6px",
      textAlign: "center",
      color: "#ffffff",
      fontSize: "9px",
      fontWeight: "900",
      letterSpacing: "0.7px",
      pointerEvents: "none"
    });
    card.append(image, label);
    choices.appendChild(card);

    const state: DragState = {
      option,
      card,
      startX: 0,
      startY: 0,
      translateX: 0,
      translateY: 0,
      dragging: false
    };
    dragStates.set(option.spec.id, state);

    card.addEventListener("pointerdown", (event) => {
      if (!visible || completed || finishing || usedOptionIds.has(option.spec.id)) return;
      event.preventDefault();
      event.stopPropagation();
      state.dragging = true;
      state.pointerId = event.pointerId;
      state.startX = event.clientX;
      state.startY = event.clientY;
      card.setPointerCapture(event.pointerId);
      card.style.zIndex = "4";
      card.style.cursor = "grabbing";
      card.style.borderColor = "#ffd95e";
      feedback.textContent = `Drag ${option.spec.label} to the ${option.spec.size.toUpperCase()} bay`;
      feedback.style.color = "#d8e8dd";
    });

    card.addEventListener("pointermove", (event) => {
      if (!state.dragging || state.pointerId !== event.pointerId) return;
      event.preventDefault();
      event.stopPropagation();
      state.translateX = event.clientX - state.startX;
      state.translateY = event.clientY - state.startY;
      card.style.transform = `translate(${state.translateX}px, ${state.translateY}px)`;
      clearLaneHighlights();
      const lane = laneAtCardCentre(card);
      if (lane) {
        const slot = laneElements.get(lane.id);
        if (slot && !filledLaneIds.has(lane.id)) {
          const fits = lane.acceptsSize === option.spec.size;
          slot.style.transform = "scale(1.035)";
          slot.style.borderColor = fits ? "#72ef9e" : "#ff786e";
          slot.style.background = fits
            ? "rgba(57,132,84,0.3)"
            : "rgba(214,83,74,0.18)";
        }
      }
    });

    card.addEventListener("pointerup", (event) => {
      if (!state.dragging || state.pointerId !== event.pointerId) return;
      event.preventDefault();
      event.stopPropagation();
      const lane = laneAtCardCentre(card);
      if (card.hasPointerCapture(event.pointerId)) card.releasePointerCapture(event.pointerId);
      if (lane) tryLoad(state, lane);
      else {
        feedback.textContent = "Drop the whole box inside one of the cart bays";
        feedback.style.color = "#ffba9b";
        resetCard(state);
      }
    });

    card.addEventListener("pointercancel", () => resetCard(state));
    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (usedOptionIds.has(option.spec.id) || finishing) return;
      event.preventDefault();
      selectedKeyboardOptionId = option.spec.id;
      feedback.textContent = `${option.spec.label} selected. Focus the cart and press Enter.`;
      feedback.style.color = "#ffd95e";
      target.focus();
    });
  });

  target.addEventListener("keydown", (event) => {
    if ((event.key !== "Enter" && event.key !== " ") || !selectedKeyboardOptionId) return;
    event.preventDefault();
    const state = dragStates.get(selectedKeyboardOptionId);
    selectedKeyboardOptionId = undefined;
    if (!state) return;
    const lane = matchingOpenLane(state.option);
    if (lane) tryLoad(state, lane);
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

  return Object.freeze({
    destroy: () => {
      if (readinessTimer !== undefined) window.clearInterval(readinessTimer);
      disposers.forEach((dispose) => dispose());
      setSceneInputEnabled(true);
      overlay.remove();
      delete document.body.dataset.cartCapacityLoad;
      delete document.body.dataset.cartCapacityLoaded;
      delete document.body.dataset.cartCapacityRound;
    }
  });
}
