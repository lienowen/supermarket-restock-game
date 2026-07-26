import type Phaser from "phaser";
import type {
  CartCapacityExperienceSpec,
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
    width: "min(820px, 100%)",
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
    gridTemplateColumns: "minmax(300px, 1.2fr) 52px minmax(260px, 1fr)",
    gap: "14px",
    alignItems: "stretch"
  });

  const choices = document.createElement("div");
  choices.id = "cart-capacity-options";
  applyStyles(choices, {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(86px, 1fr))",
    gap: "10px"
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
    gridTemplateRows: "1fr auto auto",
    alignItems: "center",
    minHeight: "154px",
    padding: "10px",
    boxSizing: "border-box",
    border: "2px dashed rgba(255, 217, 94, 0.65)",
    borderRadius: "16px",
    background: "rgba(90, 145, 79, 0.12)",
    transition: "border-color 120ms ease, background 120ms ease, transform 120ms ease"
  });

  const cartImage = document.createElement("img");
  cartImage.src = assetUrl(config.targetImagePath);
  cartImage.alt = "";
  cartImage.draggable = false;
  applyStyles(cartImage, {
    width: "148px",
    height: "80px",
    justifySelf: "center",
    objectFit: "contain",
    opacity: "0.92",
    pointerEvents: "none"
  });

  const slots = document.createElement("div");
  slots.id = "cart-capacity-slots";
  applyStyles(slots, {
    display: "grid",
    gridTemplateColumns: `repeat(${config.spec.capacity}, minmax(70px, 1fr))`,
    gap: "8px",
    width: "100%"
  });
  for (let index = 0; index < config.spec.capacity; index += 1) {
    const slot = document.createElement("div");
    slot.dataset.slotIndex = String(index);
    slot.textContent = `EMPTY ${index + 1}`;
    applyStyles(slot, {
      display: "grid",
      placeItems: "center",
      minHeight: "42px",
      border: "1px solid rgba(255, 255, 255, 0.18)",
      borderRadius: "10px",
      color: "#9bb7a4",
      fontSize: "9px",
      fontWeight: "900",
      letterSpacing: "0.8px",
      background: "rgba(0, 0, 0, 0.18)"
    });
    slots.appendChild(slot);
  }

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
  feedback.textContent = `Load 0/${config.spec.capacity} correct cases`;
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

  const loadedOptionIds = new Set<string>();
  const dragStates = new Map<string, DragState>();
  let armed = false;
  let visible = false;
  let completed = false;
  let selectedKeyboardOptionId: string | undefined;
  let readinessTimer: number | undefined;

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

  const resetCard = (state: DragState): void => {
    state.pointerId = undefined;
    state.startX = 0;
    state.startY = 0;
    state.translateX = 0;
    state.translateY = 0;
    state.dragging = false;
    state.card.style.transform = "translate(0, 0)";
    state.card.style.zIndex = "";
    state.card.style.cursor = loadedOptionIds.has(state.option.spec.id) ? "default" : "grab";
    target.style.borderColor = "rgba(255, 217, 94, 0.65)";
    target.style.background = "rgba(90, 145, 79, 0.12)";
    target.style.transform = "scale(1)";
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
      return;
    }
    feedback.textContent = "Cart loaded. Deliver the cases to the cooler.";
    feedback.style.color = "#ffd95e";
    action.emit("pointerdown");
  };

  const show = (): void => {
    if (visible || completed || !armed || !isReady()) return;
    visible = true;
    overlay.style.display = "flex";
    setSceneInputEnabled(false);
    document.body.dataset.cartCapacityLoad = "active";
    requestAnimationFrame(() => choices.querySelector<HTMLElement>("[data-case-id]")?.focus());
  };

  const beginReadinessWatch = (): void => {
    if (readinessTimer !== undefined) return;
    readinessTimer = window.setInterval(() => {
      if (!visible && !completed) show();
    }, 100);
  };

  const sourceCentreInsideTarget = (card: HTMLElement): boolean => {
    const sourceRect = card.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const centreX = sourceRect.left + sourceRect.width / 2;
    const centreY = sourceRect.top + sourceRect.height / 2;
    return (
      centreX >= targetRect.left &&
      centreX <= targetRect.right &&
      centreY >= targetRect.top &&
      centreY <= targetRect.bottom
    );
  };

  const addLoadedCaseToSlot = (option: CartCapacityLoadOption): void => {
    const slot = slots.children.item(loadedOptionIds.size - 1) as HTMLElement | null;
    if (!slot) return;
    slot.textContent = "";
    const image = document.createElement("img");
    image.src = assetUrl(option.imagePath);
    image.alt = option.spec.label;
    image.draggable = false;
    applyStyles(image, {
      width: "54px",
      height: "38px",
      objectFit: "contain",
      pointerEvents: "none"
    });
    slot.appendChild(image);
    slot.style.borderColor = "rgba(255, 217, 94, 0.78)";
    slot.style.background = "rgba(220, 181, 63, 0.14)";
  };

  const tryLoad = (state: DragState): void => {
    const { option, card } = state;
    if (loadedOptionIds.has(option.spec.id)) {
      resetCard(state);
      return;
    }
    if (!option.spec.accepted) {
      feedback.textContent = `${option.spec.label} is not part of the closing cola load`;
      feedback.style.color = "#ff9e91";
      card.style.borderColor = "#ff786e";
      setTimeout(() => {
        card.style.borderColor = "rgba(255, 255, 255, 0.2)";
        resetCard(state);
      }, 260);
      return;
    }

    loadedOptionIds.add(option.spec.id);
    addLoadedCaseToSlot(option);
    card.style.opacity = "0.36";
    card.style.borderColor = "rgba(255, 217, 94, 0.62)";
    card.setAttribute("aria-disabled", "true");
    card.tabIndex = -1;
    resetCard(state);
    document.body.dataset.cartCapacityLoaded = String(loadedOptionIds.size);
    feedback.textContent = `Load ${loadedOptionIds.size}/${config.spec.capacity} correct cases`;
    feedback.style.color = "#ffd95e";

    if (loadedOptionIds.size === config.spec.capacity) {
      target.style.borderColor = "#ffd95e";
      target.style.background = "rgba(220, 181, 63, 0.22)";
      window.setTimeout(confirmPrimaryAction, 220);
    }
  };

  config.options.forEach((option) => {
    const card = document.createElement("div");
    card.dataset.caseId = option.spec.id;
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `Load ${option.spec.label}`);
    applyStyles(card, {
      position: "relative",
      display: "grid",
      placeItems: "center",
      minHeight: "128px",
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
      width: "92px",
      height: "78px",
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
      if (!visible || completed || loadedOptionIds.has(option.spec.id)) return;
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
      feedback.textContent = `Drag ${option.spec.label} into the cart`;
      feedback.style.color = "#d8e8dd";
    });

    card.addEventListener("pointermove", (event) => {
      if (!state.dragging || state.pointerId !== event.pointerId) return;
      event.preventDefault();
      event.stopPropagation();
      state.translateX = event.clientX - state.startX;
      state.translateY = event.clientY - state.startY;
      card.style.transform = `translate(${state.translateX}px, ${state.translateY}px)`;
      const overTarget = sourceCentreInsideTarget(card);
      target.style.transform = overTarget ? "scale(1.025)" : "scale(1)";
      target.style.background = overTarget
        ? "rgba(90, 145, 79, 0.3)"
        : "rgba(90, 145, 79, 0.12)";
    });

    card.addEventListener("pointerup", (event) => {
      if (!state.dragging || state.pointerId !== event.pointerId) return;
      event.preventDefault();
      event.stopPropagation();
      const acceptedDrop = sourceCentreInsideTarget(card);
      if (card.hasPointerCapture(event.pointerId)) card.releasePointerCapture(event.pointerId);
      if (acceptedDrop) tryLoad(state);
      else {
        feedback.textContent = "Drop the whole case inside the cart area";
        feedback.style.color = "#ffba9b";
        resetCard(state);
      }
    });

    card.addEventListener("pointercancel", () => resetCard(state));
    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (loadedOptionIds.has(option.spec.id)) return;
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
    if (state) tryLoad(state);
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
        hide();
      }
    }),
    gameDomainEvents.subscribe("task.completed", (event) => {
      if (event.payload.levelId !== config.levelId) return;
      completed = true;
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
    }
  });
}
