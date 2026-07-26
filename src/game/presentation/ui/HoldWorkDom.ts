import type Phaser from "phaser";
import type { HoldWorkExperienceSpec } from "../../content/experience/LevelExperienceSpec";
import { gameDomainEvents } from "../../events/GameDomainEvents";

export interface HoldWorkDomConfig {
  readonly game: Phaser.Game;
  readonly sceneKey: string;
  readonly levelId: string;
  readonly spec: HoldWorkExperienceSpec;
  readonly toolImagePath?: string;
}

export interface HoldWorkDomHandle {
  readonly destroy: () => void;
}

interface HoldScenePort {
  readonly controller?: {
    readonly snapshot?: () => {
      readonly step: string;
      readonly progress: number;
      readonly total: number;
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

export function mountHoldWorkDom(config: HoldWorkDomConfig): HoldWorkDomHandle {
  const overlay = document.createElement("section");
  overlay.id = "hold-work-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-label", config.spec.title);
  applyStyles(overlay, {
    position: "fixed",
    inset: "0",
    zIndex: "9500",
    display: "none",
    alignItems: "flex-end",
    justifyContent: "center",
    padding: "14px",
    boxSizing: "border-box",
    background: "rgba(3, 9, 6, 0.18)",
    fontFamily: "Arial, sans-serif",
    color: "#ffffff",
    touchAction: "none"
  });

  const panel = document.createElement("div");
  applyStyles(panel, {
    width: "min(640px, 100%)",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 150px",
    gap: "18px",
    alignItems: "center",
    padding: "18px",
    boxSizing: "border-box",
    border: "1px solid rgba(125, 219, 229, 0.5)",
    borderRadius: "20px",
    background: "rgba(9, 27, 24, 0.97)",
    boxShadow: "0 18px 55px rgba(0, 0, 0, 0.46)"
  });

  const copy = document.createElement("div");
  const stepLabel = document.createElement("div");
  applyStyles(stepLabel, {
    color: "#8edce3",
    fontSize: "10px",
    fontWeight: "900",
    letterSpacing: "1.4px"
  });
  const title = document.createElement("div");
  title.textContent = config.spec.title;
  applyStyles(title, { marginTop: "4px", fontSize: "21px", fontWeight: "900" });
  const instruction = document.createElement("p");
  instruction.textContent = config.spec.instruction;
  applyStyles(instruction, {
    margin: "7px 0 10px",
    color: "#d2e6e3",
    fontSize: "13px",
    lineHeight: "1.45"
  });
  const feedback = document.createElement("div");
  feedback.id = "hold-work-feedback";
  feedback.setAttribute("aria-live", "polite");
  feedback.textContent = "Move close to the spill, then hold the control";
  applyStyles(feedback, {
    minHeight: "18px",
    color: "#9bc5bf",
    fontSize: "12px",
    fontWeight: "700"
  });
  copy.append(stepLabel, title, instruction, feedback);

  const holdButton = document.createElement("button");
  holdButton.id = "hold-work-button";
  holdButton.type = "button";
  holdButton.setAttribute("aria-label", config.spec.holdLabel);
  applyStyles(holdButton, {
    position: "relative",
    display: "grid",
    placeItems: "center",
    width: "138px",
    height: "138px",
    padding: "0",
    border: "0",
    borderRadius: "50%",
    background: "conic-gradient(#7bd8e2 0deg, rgba(255,255,255,0.12) 0deg)",
    color: "#ffffff",
    cursor: "pointer",
    touchAction: "none",
    userSelect: "none",
    boxShadow: "0 12px 30px rgba(0,0,0,0.34)"
  });
  const inner = document.createElement("span");
  applyStyles(inner, {
    display: "grid",
    placeItems: "center",
    width: "108px",
    height: "108px",
    padding: "10px",
    boxSizing: "border-box",
    borderRadius: "50%",
    background: "#17382f",
    fontSize: "12px",
    fontWeight: "900",
    letterSpacing: "0.8px",
    textAlign: "center",
    lineHeight: "1.2"
  });
  if (config.toolImagePath) {
    const image = document.createElement("img");
    image.src = assetUrl(config.toolImagePath);
    image.alt = "";
    image.draggable = false;
    applyStyles(image, {
      width: "52px",
      height: "48px",
      objectFit: "contain",
      pointerEvents: "none"
    });
    const label = document.createElement("span");
    label.textContent = config.spec.holdLabel;
    applyStyles(label, { fontSize: "9px", pointerEvents: "none" });
    inner.append(image, label);
  } else {
    inner.textContent = config.spec.holdLabel;
  }
  holdButton.appendChild(inner);
  panel.append(copy, holdButton);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  document.body.dataset.holdWork = "waiting";

  let activeProgress = -1;
  let holding = false;
  let startedAt = 0;
  let frameId = 0;
  let pollId = 0;
  let destroyed = false;

  const scenePort = (): HoldScenePort | undefined => {
    try {
      return config.game.scene.getScene(config.sceneKey) as unknown as HoldScenePort;
    } catch {
      return undefined;
    }
  };
  const snapshot = () => scenePort()?.controller?.snapshot?.();
  const isReady = () => Boolean(scenePort()?.isInteractionReady?.());

  const resetHold = (message = "Hold until the ring reaches 100%"): void => {
    holding = false;
    cancelAnimationFrame(frameId);
    holdButton.style.background = "conic-gradient(#7bd8e2 0deg, rgba(255,255,255,0.12) 0deg)";
    holdButton.style.transform = "scale(1)";
    feedback.textContent = message;
    feedback.style.color = "#9bc5bf";
    document.body.dataset.holdWork = overlay.style.display === "none" ? "waiting" : "active";
  };

  const commit = (): void => {
    holding = false;
    cancelAnimationFrame(frameId);
    const action = scenePort()?.children?.getByName?.("shift-hud-action");
    if (!action || !isReady()) {
      resetHold("Move closer to the spill and try again");
      feedback.style.color = "#ffb098";
      return;
    }
    feedback.textContent = "Cleaning complete";
    feedback.style.color = "#8fe7c1";
    document.body.dataset.holdWork = "committing";
    action.emit("pointerdown");
  };

  const animate = (): void => {
    if (!holding) return;
    const ratio = Math.max(0, Math.min(1, (performance.now() - startedAt) / config.spec.durationMs));
    const degrees = Math.round(ratio * 360);
    holdButton.style.background = `conic-gradient(#7bd8e2 ${degrees}deg, rgba(255,255,255,0.12) ${degrees}deg)`;
    holdButton.style.transform = `scale(${1 + ratio * 0.035})`;
    feedback.textContent = `Cleaning ${Math.round(ratio * 100)}%`;
    feedback.style.color = "#d9fbff";
    if (ratio >= 1) commit();
    else frameId = requestAnimationFrame(animate);
  };

  const beginHold = (): void => {
    if (holding || !isReady()) {
      feedback.textContent = "Move close enough to the spill first";
      feedback.style.color = "#ffb098";
      return;
    }
    holding = true;
    startedAt = performance.now();
    document.body.dataset.holdWork = "holding";
    frameId = requestAnimationFrame(animate);
  };

  const interrupt = (): void => {
    if (!holding) return;
    resetHold("Released early — hold again to finish the scrub");
    feedback.style.color = "#ffcf91";
  };

  holdButton.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    holdButton.setPointerCapture(event.pointerId);
    beginHold();
  });
  holdButton.addEventListener("pointerup", (event) => {
    event.preventDefault();
    if (holdButton.hasPointerCapture(event.pointerId)) holdButton.releasePointerCapture(event.pointerId);
    interrupt();
  });
  holdButton.addEventListener("pointercancel", interrupt);
  holdButton.addEventListener("pointerleave", (event) => {
    if (event.buttons === 0) return;
    interrupt();
  });
  holdButton.addEventListener("keydown", (event) => {
    if ((event.key === "Enter" || event.key === " ") && !event.repeat) {
      event.preventDefault();
      beginHold();
    }
  });
  holdButton.addEventListener("keyup", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      interrupt();
    }
  });

  const hide = (): void => {
    overlay.style.display = "none";
    activeProgress = -1;
    resetHold();
  };

  const poll = (): void => {
    if (destroyed) return;
    const state = snapshot();
    if (state?.step === "clean" && state.progress < state.total && isReady()) {
      if (activeProgress !== state.progress) {
        activeProgress = state.progress;
        stepLabel.textContent = `SPILL ${state.progress + 1}/${state.total}`;
        overlay.style.display = "flex";
        document.body.dataset.holdWork = "active";
        feedback.textContent = "Hold until the ring reaches 100%";
        feedback.style.color = "#9bc5bf";
        holdButton.focus();
      }
    } else if (state?.step === "complete") {
      hide();
      document.body.dataset.holdWork = "complete";
    }
  };

  const disposers = [
    gameDomainEvents.subscribe("task.action-accepted", (event) => {
      if (event.payload.levelId !== config.levelId) return;
      if (event.payload.action === config.spec.action) hide();
    }),
    gameDomainEvents.subscribe("task.completed", (event) => {
      if (event.payload.levelId !== config.levelId) return;
      hide();
      document.body.dataset.holdWork = "complete";
    })
  ];
  pollId = window.setInterval(poll, 100);

  return Object.freeze({
    destroy: () => {
      destroyed = true;
      cancelAnimationFrame(frameId);
      window.clearInterval(pollId);
      disposers.forEach((dispose) => dispose());
      overlay.remove();
      delete document.body.dataset.holdWork;
    }
  });
}
