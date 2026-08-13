import type Phaser from "phaser";
import type { GuidedDragActionSpec } from "../../content/experience/LevelExperienceSpec";
import { gameDomainEvents } from "../../events/GameDomainEvents";

export interface GuidedDragActionDomConfig {
  readonly game: Phaser.Game;
  readonly sceneKey: string;
  readonly levelId: string;
  readonly spec: GuidedDragActionSpec;
  readonly sourceImagePath: string;
  readonly targetImagePath: string;
}

export interface GuidedDragActionDomHandle {
  readonly destroy: () => void;
}

interface PrimaryActionScenePort {
  readonly isInteractionReady?: () => boolean;
  readonly input?: { enabled: boolean };
  readonly children?: {
    readonly getByName?: (name: string) => Phaser.GameObjects.GameObject | null;
  };
}

interface DragPoint {
  readonly x: number;
  readonly y: number;
}

const applyStyles = (element: HTMLElement, styles: Partial<CSSStyleDeclaration>): void => {
  Object.assign(element.style, styles);
};

const assetUrl = (path: string): string => `/${path.replace(/^\/+/, "")}`;
const softwareLandscapeActive = (): boolean => (
  document.body.dataset.softwareLandscape === "true"
);
const coarsePointerActive = (): boolean => (
  window.matchMedia?.("(pointer: coarse)")?.matches ?? false
);

/** Convert viewport PointerEvent coordinates into the local axes of the stage.
 * The portrait fallback rotates body +90deg, so local landscape X follows
 * viewport Y and local landscape Y follows negative viewport X. */
const dragPoint = (event: PointerEvent): DragPoint => (
  softwareLandscapeActive()
    ? { x: event.clientY, y: window.innerWidth - event.clientX }
    : { x: event.clientX, y: event.clientY }
);

export function mountGuidedDragActionDom(
  config: GuidedDragActionDomConfig
): GuidedDragActionDomHandle {
  const overlay = document.createElement("section");
  overlay.id = "guided-drag-action";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", config.spec.title);
  applyStyles(overlay, {
    position: "fixed",
    inset: "0",
    zIndex: "9500",
    display: "none",
    alignItems: "flex-end",
    justifyContent: "center",
    padding: "18px",
    boxSizing: "border-box",
    background: "rgba(3, 9, 6, 0.34)",
    fontFamily: "Arial, sans-serif",
    color: "#ffffff",
    touchAction: "none",
    pointerEvents: "auto"
  });

  const panel = document.createElement("div");
  applyStyles(panel, {
    width: "min(700px, 100%)",
    boxSizing: "border-box",
    padding: "16px 18px 18px",
    border: "1px solid rgba(255, 218, 94, 0.56)",
    borderRadius: "20px",
    background: "rgba(9, 27, 18, 0.98)",
    boxShadow: "0 18px 54px rgba(0, 0, 0, 0.46)",
    pointerEvents: "auto"
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
    gridTemplateColumns: "minmax(120px, 1fr) 44px minmax(150px, 1.25fr)",
    alignItems: "center",
    gap: "12px"
  });

  const source = document.createElement("div");
  source.id = "guided-drag-source";
  source.tabIndex = 0;
  source.setAttribute("role", "button");
  source.setAttribute("aria-label", `Drag ${config.spec.sourceLabel}`);
  applyStyles(source, {
    position: "relative",
    display: "grid",
    placeItems: "center",
    minHeight: "112px",
    border: "2px solid rgba(255, 255, 255, 0.2)",
    borderRadius: "15px",
    background: "rgba(255, 255, 255, 0.07)",
    cursor: "grab",
    userSelect: "none",
    touchAction: "none",
    transition: "border-color 120ms ease, background 120ms ease"
  });

  const sourceImage = document.createElement("img");
  sourceImage.src = assetUrl(config.sourceImagePath);
  sourceImage.alt = "";
  sourceImage.draggable = false;
  applyStyles(sourceImage, {
    width: "92px",
    height: "78px",
    objectFit: "contain",
    pointerEvents: "none",
    filter: "drop-shadow(0 8px 10px rgba(0,0,0,0.3))"
  });

  const sourceLabel = document.createElement("span");
  sourceLabel.textContent = config.spec.sourceLabel;
  applyStyles(sourceLabel, {
    position: "absolute",
    left: "8px",
    right: "8px",
    bottom: "6px",
    textAlign: "center",
    color: "#ffffff",
    fontSize: "10px",
    fontWeight: "900",
    letterSpacing: "1px",
    pointerEvents: "none"
  });
  source.append(sourceImage, sourceLabel);

  const arrow = document.createElement("div");
  arrow.textContent = "→";
  applyStyles(arrow, {
    textAlign: "center",
    color: "#ffd95e",
    fontSize: "30px",
    fontWeight: "900",
    pointerEvents: "none"
  });

  const target = document.createElement("div");
  target.id = "guided-drag-target";
  target.tabIndex = 0;
  target.setAttribute("role", "button");
  target.setAttribute("aria-label", `Drop into ${config.spec.targetLabel}`);
  applyStyles(target, {
    position: "relative",
    display: "grid",
    placeItems: "center",
    minHeight: "112px",
    border: "2px dashed rgba(255, 217, 94, 0.6)",
    borderRadius: "15px",
    background: "rgba(90, 145, 79, 0.12)",
    transition: "border-color 120ms ease, background 120ms ease, transform 120ms ease"
  });

  const targetImage = document.createElement("img");
  targetImage.src = assetUrl(config.targetImagePath);
  targetImage.alt = "";
  targetImage.draggable = false;
  applyStyles(targetImage, {
    width: "128px",
    height: "88px",
    objectFit: "contain",
    pointerEvents: "none",
    opacity: "0.92"
  });

  const targetLabel = document.createElement("span");
  targetLabel.textContent = config.spec.targetLabel;
  applyStyles(targetLabel, {
    position: "absolute",
    left: "8px",
    right: "8px",
    bottom: "6px",
    textAlign: "center",
    color: "#ffe993",
    fontSize: "10px",
    fontWeight: "900",
    letterSpacing: "1px",
    pointerEvents: "none"
  });
  target.append(targetImage, targetLabel);

  const feedback = document.createElement("div");
  feedback.id = "guided-drag-feedback";
  feedback.setAttribute("aria-live", "polite");
  feedback.textContent = "Drag the case into the cart";
  applyStyles(feedback, {
    minHeight: "18px",
    marginTop: "10px",
    textAlign: "center",
    color: "#a9cfb7",
    fontSize: "12px",
    fontWeight: "700"
  });

  workArea.append(source, arrow, target);
  panel.append(eyebrow, title, instruction, workArea, feedback);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  document.body.dataset.guidedDrag = "waiting";

  let armed = false;
  let visible = false;
  let completed = false;
  let dragging = false;
  let keyboardPicked = false;
  let pointerId: number | undefined;
  let startX = 0;
  let startY = 0;
  let translateX = 0;
  let translateY = 0;
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

  const dropTolerance = (): number => (
    softwareLandscapeActive() || coarsePointerActive() ? 64 : 10
  );

  const viewportPointInsideTarget = (clientX: number, clientY: number): boolean => {
    const targetRect = target.getBoundingClientRect();
    const tolerance = dropTolerance();
    return (
      clientX >= targetRect.left - tolerance &&
      clientX <= targetRect.right + tolerance &&
      clientY >= targetRect.top - tolerance &&
      clientY <= targetRect.bottom + tolerance
    );
  };

  const sourceCentreInsideTarget = (): boolean => {
    const sourceRect = source.getBoundingClientRect();
    return viewportPointInsideTarget(
      sourceRect.left + sourceRect.width / 2,
      sourceRect.top + sourceRect.height / 2
    );
  };

  const updateTargetFeedback = (clientX?: number, clientY?: number): void => {
    const overTarget = clientX !== undefined && clientY !== undefined
      ? viewportPointInsideTarget(clientX, clientY)
      : sourceCentreInsideTarget();
    target.style.transform = overTarget ? "scale(1.035)" : "scale(1)";
    target.style.background = overTarget
      ? "rgba(90, 145, 79, 0.34)"
      : "rgba(90, 145, 79, 0.12)";
    target.style.borderColor = overTarget ? "#ffd95e" : "rgba(255, 217, 94, 0.6)";
    document.body.dataset.mobileGuidedDragTarget = overTarget ? "inside" : "outside";
  };

  const resetSource = (): void => {
    dragging = false;
    keyboardPicked = false;
    pointerId = undefined;
    translateX = 0;
    translateY = 0;
    source.style.transform = "translate(0, 0)";
    source.style.zIndex = "";
    source.style.cursor = "grab";
    source.style.borderColor = "rgba(255, 255, 255, 0.2)";
    target.style.borderColor = "rgba(255, 217, 94, 0.6)";
    target.style.background = "rgba(90, 145, 79, 0.12)";
    target.style.transform = "scale(1)";
    document.body.dataset.mobileGuidedDrag = "ready";
    document.body.dataset.mobileGuidedDragTarget = "outside";
  };

  const hide = (state: "complete" | "closed"): void => {
    visible = false;
    overlay.style.display = "none";
    setSceneInputEnabled(true);
    document.body.dataset.guidedDrag = state;
  };

  const show = (): void => {
    if (visible || completed || !armed || !isReady()) return;
    visible = true;
    overlay.style.display = "flex";
    setSceneInputEnabled(false);
    document.body.dataset.guidedDrag = "active";
    document.body.dataset.mobileGuidedDragTarget = "outside";
    requestAnimationFrame(() => source.focus());
  };

  const beginReadinessWatch = (): void => {
    if (readinessTimer !== undefined) return;
    readinessTimer = window.setInterval(() => {
      if (completed || visible) return;
      show();
    }, 100);
  };

  const confirmPrimaryAction = (): void => {
    if (completed || !isReady()) {
      feedback.textContent = "Move the worker closer to the cart, then try again";
      feedback.style.color = "#ffba9b";
      resetSource();
      return;
    }
    const action = scenePort()?.children?.getByName?.("shift-hud-action") as Phaser.GameObjects.GameObject | null;
    if (!action) {
      feedback.textContent = "The cart action is not available yet";
      feedback.style.color = "#ffba9b";
      resetSource();
      return;
    }
    feedback.textContent = "Case loaded";
    feedback.style.color = "#ffd95e";
    target.style.borderColor = "#ffd95e";
    target.style.background = "rgba(220, 181, 63, 0.22)";
    action.emit("pointerdown");
  };

  const blockUnderlyingPointer = (event: Event): void => {
    event.stopPropagation();
  };
  overlay.addEventListener("pointerdown", blockUnderlyingPointer);
  overlay.addEventListener("pointermove", blockUnderlyingPointer);
  overlay.addEventListener("pointerup", blockUnderlyingPointer);
  overlay.addEventListener("click", blockUnderlyingPointer);
  overlay.addEventListener("dblclick", blockUnderlyingPointer);
  overlay.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });

  const removeWindowDragListeners = (): void => {
    window.removeEventListener("pointermove", handleWindowPointerMove, true);
    window.removeEventListener("pointerup", handleWindowPointerUp, true);
    window.removeEventListener("pointercancel", handleWindowPointerCancel, true);
  };

  function handleWindowPointerMove(event: PointerEvent): void {
    if (!dragging || pointerId !== event.pointerId) return;
    event.preventDefault();
    const point = dragPoint(event);
    translateX = point.x - startX;
    translateY = point.y - startY;
    source.style.transform = `translate3d(${translateX}px, ${translateY}px, 0)`;
    updateTargetFeedback(event.clientX, event.clientY);
  }

  function handleWindowPointerUp(event: PointerEvent): void {
    if (!dragging || pointerId !== event.pointerId) return;
    event.preventDefault();
    const point = dragPoint(event);
    translateX = point.x - startX;
    translateY = point.y - startY;
    source.style.transform = `translate3d(${translateX}px, ${translateY}px, 0)`;
    const accepted = viewportPointInsideTarget(event.clientX, event.clientY);
    if (source.hasPointerCapture(event.pointerId)) {
      try { source.releasePointerCapture(event.pointerId); } catch { /* browser already released */ }
    }
    dragging = false;
    pointerId = undefined;
    removeWindowDragListeners();
    if (accepted) {
      document.body.dataset.mobileGuidedDrag = "accepted";
      document.body.dataset.mobileGuidedDragTarget = "inside";
      confirmPrimaryAction();
    } else {
      feedback.textContent = "Drag the case onto the cart";
      feedback.style.color = "#ffba9b";
      resetSource();
    }
  }

  function handleWindowPointerCancel(event: PointerEvent): void {
    if (pointerId !== event.pointerId) return;
    removeWindowDragListeners();
    resetSource();
  }

  source.addEventListener("pointerdown", (event) => {
    if (!visible || completed || dragging) return;
    event.preventDefault();
    event.stopPropagation();
    const point = dragPoint(event);
    dragging = true;
    pointerId = event.pointerId;
    startX = point.x - translateX;
    startY = point.y - translateY;
    try { source.setPointerCapture(event.pointerId); } catch { /* window capture listeners are the fallback */ }
    source.style.zIndex = "2";
    source.style.cursor = "grabbing";
    source.style.borderColor = "#ffd95e";
    feedback.textContent = "Keep dragging into the cart";
    feedback.style.color = "#ffd95e";
    document.body.dataset.mobileGuidedDrag = softwareLandscapeActive()
      ? "dragging-software-landscape"
      : "dragging";
    updateTargetFeedback(event.clientX, event.clientY);
    window.addEventListener("pointermove", handleWindowPointerMove, { capture: true, passive: false });
    window.addEventListener("pointerup", handleWindowPointerUp, { capture: true, passive: false });
    window.addEventListener("pointercancel", handleWindowPointerCancel, { capture: true, passive: false });
  });

  source.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    keyboardPicked = true;
    feedback.textContent = "Case selected. Focus the cart and press Enter.";
    feedback.style.color = "#ffd95e";
    target.focus();
  });

  target.addEventListener("keydown", (event) => {
    if ((event.key !== "Enter" && event.key !== " ") || !keyboardPicked) return;
    event.preventDefault();
    confirmPrimaryAction();
  });

  const disposers = [
    gameDomainEvents.subscribe("task.action-accepted", (event) => {
      if (event.payload.levelId !== config.levelId) return;
      if (event.payload.action === config.spec.unlockAfterAction) {
        armed = true;
        document.body.dataset.guidedDrag = "armed";
        beginReadinessWatch();
        show();
      }
      if (event.payload.action === config.spec.confirmAction) {
        completed = true;
        hide("complete");
      }
    }),
    gameDomainEvents.subscribe("task.completed", (event) => {
      if (event.payload.levelId !== config.levelId) return;
      completed = true;
      hide("complete");
    })
  ];

  return Object.freeze({
    destroy: () => {
      removeWindowDragListeners();
      if (readinessTimer !== undefined) window.clearInterval(readinessTimer);
      disposers.forEach((dispose) => dispose());
      setSceneInputEnabled(true);
      overlay.remove();
      delete document.body.dataset.guidedDrag;
      delete document.body.dataset.mobileGuidedDrag;
      delete document.body.dataset.mobileGuidedDragTarget;
    }
  });
}