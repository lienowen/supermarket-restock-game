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
  readonly children?: {
    readonly getByName?: (name: string) => Phaser.GameObjects.GameObject | null;
  };
}

const applyStyles = (element: HTMLElement, styles: Partial<CSSStyleDeclaration>): void => {
  Object.assign(element.style, styles);
};

const assetUrl = (path: string): string => `/${path.replace(/^\/+/, "")}`;

export function mountGuidedDragActionDom(
  config: GuidedDragActionDomConfig
): GuidedDragActionDomHandle {
  const overlay = document.createElement("section");
  overlay.id = "guided-drag-action";
  overlay.setAttribute("role", "dialog");
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
    background: "rgba(3, 9, 6, 0.24)",
    fontFamily: "Arial, sans-serif",
    color: "#ffffff",
    touchAction: "none"
  });

  const panel = document.createElement("div");
  applyStyles(panel, {
    width: "min(700px, 100%)",
    boxSizing: "border-box",
    padding: "16px 18px 18px",
    border: "1px solid rgba(255, 218, 94, 0.56)",
    borderRadius: "20px",
    background: "rgba(9, 27, 18, 0.96)",
    boxShadow: "0 18px 54px rgba(0, 0, 0, 0.46)"
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
    letterSpacing: "1px"
  });
  source.append(sourceImage, sourceLabel);

  const arrow = document.createElement("div");
  arrow.textContent = "→";
  applyStyles(arrow, {
    textAlign: "center",
    color: "#ffd95e",
    fontSize: "30px",
    fontWeight: "900"
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
    letterSpacing: "1px"
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
  };

  const scenePort = (): PrimaryActionScenePort | undefined => {
    try {
      return config.game.scene.getScene(config.sceneKey) as unknown as PrimaryActionScenePort;
    } catch {
      return undefined;
    }
  };

  const isReady = (): boolean => Boolean(scenePort()?.isInteractionReady?.());

  const show = (): void => {
    if (visible || completed || !armed || !isReady()) return;
    visible = true;
    overlay.style.display = "flex";
    document.body.dataset.guidedDrag = "active";
    source.focus();
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

  const sourceCentreInsideTarget = (): boolean => {
    const sourceRect = source.getBoundingClientRect();
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

  source.addEventListener("pointerdown", (event) => {
    if (!visible || completed) return;
    event.preventDefault();
    dragging = true;
    pointerId = event.pointerId;
    startX = event.clientX - translateX;
    startY = event.clientY - translateY;
    source.setPointerCapture(event.pointerId);
    source.style.zIndex = "2";
    source.style.cursor = "grabbing";
    source.style.borderColor = "#ffd95e";
    feedback.textContent = "Keep dragging into the cart";
  });

  source.addEventListener("pointermove", (event) => {
    if (!dragging || pointerId !== event.pointerId) return;
    event.preventDefault();
    translateX = event.clientX - startX;
    translateY = event.clientY - startY;
    source.style.transform = `translate(${translateX}px, ${translateY}px)`;
    const overTarget = sourceCentreInsideTarget();
    target.style.transform = overTarget ? "scale(1.025)" : "scale(1)";
    target.style.background = overTarget
      ? "rgba(90, 145, 79, 0.3)"
      : "rgba(90, 145, 79, 0.12)";
  });

  source.addEventListener("pointerup", (event) => {
    if (!dragging || pointerId !== event.pointerId) return;
    event.preventDefault();
    const accepted = sourceCentreInsideTarget();
    if (source.hasPointerCapture(event.pointerId)) source.releasePointerCapture(event.pointerId);
    if (accepted) {
      confirmPrimaryAction();
    } else {
      feedback.textContent = "Drop the whole case inside the cart area";
      feedback.style.color = "#ffba9b";
      resetSource();
    }
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
        visible = false;
        overlay.style.display = "none";
        document.body.dataset.guidedDrag = "complete";
      }
    }),
    gameDomainEvents.subscribe("task.completed", (event) => {
      if (event.payload.levelId !== config.levelId) return;
      completed = true;
      overlay.style.display = "none";
      document.body.dataset.guidedDrag = "complete";
    })
  ];

  return Object.freeze({
    destroy: () => {
      if (readinessTimer !== undefined) window.clearInterval(readinessTimer);
      disposers.forEach((dispose) => dispose());
      overlay.remove();
      delete document.body.dataset.guidedDrag;
    }
  });
}
