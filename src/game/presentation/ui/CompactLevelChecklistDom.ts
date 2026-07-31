import type { LevelChecklistSpec } from "../../content/experience/LevelExperienceSpec";
import { gameDomainEvents } from "../../events/GameDomainEvents";

export interface CompactLevelChecklistConfig {
  readonly levelId: string;
  readonly checklist: LevelChecklistSpec;
}

export interface CompactLevelChecklistHandle {
  readonly destroy: () => void;
}

const applyStyles = (element: HTMLElement, styles: Partial<CSSStyleDeclaration>): void => {
  Object.assign(element.style, styles);
};

/**
 * A low-obstruction coach card for guided levels. It shows the current action,
 * the next action and overall progress instead of keeping the full checklist on screen.
 */
export function mountCompactLevelChecklistDom(
  config: CompactLevelChecklistConfig
): CompactLevelChecklistHandle {
  const root = document.createElement("aside");
  root.id = "level-checklist";
  root.setAttribute("aria-live", "polite");
  root.setAttribute("aria-label", `${config.checklist.heading} guidance`);
  applyStyles(root, {
    position: "fixed",
    left: "clamp(10px, 1.5vw, 22px)",
    top: "clamp(102px, 13vh, 126px)",
    zIndex: "9000",
    width: "min(250px, calc(100vw - 20px))",
    boxSizing: "border-box",
    padding: "13px 14px 12px",
    border: "1px solid rgba(255, 217, 94, 0.38)",
    borderRadius: "16px",
    background: "rgba(8, 24, 16, 0.9)",
    boxShadow: "0 12px 30px rgba(0, 0, 0, 0.25)",
    color: "#ffffff",
    fontFamily: "Arial, sans-serif",
    pointerEvents: "none",
    backdropFilter: "blur(4px)",
    transition: "opacity 180ms ease, transform 180ms ease"
  });

  const topRow = document.createElement("div");
  applyStyles(topRow, {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px"
  });

  const eyebrow = document.createElement("div");
  eyebrow.textContent = config.checklist.eyebrow;
  applyStyles(eyebrow, {
    color: "#ffd95e",
    fontSize: "9px",
    fontWeight: "900",
    letterSpacing: "1.3px"
  });

  const counter = document.createElement("div");
  applyStyles(counter, {
    color: "#a9cfb7",
    fontSize: "10px",
    fontWeight: "800",
    letterSpacing: "0.8px"
  });
  topRow.append(eyebrow, counter);

  const currentRow = document.createElement("div");
  applyStyles(currentRow, {
    display: "grid",
    gridTemplateColumns: "30px 1fr",
    alignItems: "center",
    gap: "9px",
    marginTop: "9px"
  });

  const currentIcon = document.createElement("span");
  currentIcon.textContent = "→";
  applyStyles(currentIcon, {
    display: "grid",
    placeItems: "center",
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    background: "#5a914f",
    color: "#ffffff",
    fontSize: "14px",
    fontWeight: "900",
    boxShadow: "0 0 0 4px rgba(90, 145, 79, 0.14)"
  });

  const currentLabel = document.createElement("div");
  applyStyles(currentLabel, {
    color: "#ffffff",
    fontSize: "14px",
    fontWeight: "800",
    lineHeight: "1.28"
  });
  currentRow.append(currentIcon, currentLabel);

  const nextLabel = document.createElement("div");
  applyStyles(nextLabel, {
    margin: "8px 0 0 39px",
    color: "#9fb8a7",
    fontSize: "11px",
    lineHeight: "1.3"
  });

  const dots = document.createElement("div");
  applyStyles(dots, {
    display: "flex",
    gap: "5px",
    margin: "10px 0 0 39px"
  });
  const dotElements = config.checklist.steps.map(() => {
    const dot = document.createElement("span");
    applyStyles(dot, {
      width: "21px",
      height: "4px",
      borderRadius: "99px",
      background: "rgba(255,255,255,0.11)",
      transition: "background 160ms ease, transform 160ms ease"
    });
    dots.appendChild(dot);
    return dot;
  });

  root.append(topRow, currentRow, nextLabel, dots);
  document.body.appendChild(root);
  document.body.dataset.levelChecklist = "active";

  const completed = new Set<string>();
  let progress = 0;
  let progressTotal = 0;
  let completionTimer: number | undefined;

  const render = (): void => {
    const activeIndex = config.checklist.steps.findIndex((step) => !completed.has(step.id));
    const complete = activeIndex < 0;

    dotElements.forEach((dot, index) => {
      const finished = complete || index < activeIndex;
      const active = !complete && index === activeIndex;
      dot.style.background = finished
        ? "#dcb53f"
        : active
          ? "#5a914f"
          : "rgba(255,255,255,0.11)";
      dot.style.transform = active ? "scaleY(1.45)" : "scaleY(1)";
    });

    if (complete) {
      counter.textContent = `${config.checklist.steps.length}/${config.checklist.steps.length}`;
      currentIcon.textContent = "✓";
      currentIcon.style.background = "#dcb53f";
      currentIcon.style.color = "#172117";
      currentLabel.textContent = "First delivery complete";
      nextLabel.textContent = "You learned the full restock flow.";
      root.style.borderColor = "rgba(255, 217, 94, 0.74)";
      document.body.dataset.levelChecklist = "complete";
      if (completionTimer === undefined) {
        completionTimer = window.setTimeout(() => {
          root.style.opacity = "0";
          root.style.transform = "translateY(-6px)";
        }, 1200);
      }
      return;
    }

    const activeStep = config.checklist.steps[activeIndex];
    const nextStep = config.checklist.steps[activeIndex + 1];
    counter.textContent = `STEP ${activeIndex + 1}/${config.checklist.steps.length}`;
    currentIcon.textContent = "→";
    currentIcon.style.background = "#5a914f";
    currentIcon.style.color = "#ffffff";
    currentLabel.textContent = activeStep.tracksProgress && progressTotal > 0
      ? `${activeStep.label} · ${progress}/${progressTotal}`
      : activeStep.label;
    nextLabel.textContent = nextStep ? `Next: ${nextStep.label}` : "Finish this step to complete the delivery.";
  };

  const completeForAction = (action: string): void => {
    const step = config.checklist.steps.find((entry) => entry.action === action);
    if (!step) return;
    completed.add(step.id);
    render();
  };

  const disposers = [
    gameDomainEvents.subscribe("task.action-accepted", (event) => {
      if (event.payload.levelId !== config.levelId) return;
      completeForAction(event.payload.action);
    }),
    gameDomainEvents.subscribe("task.progressed", (event) => {
      if (event.payload.levelId !== config.levelId) return;
      progress = event.payload.progress;
      progressTotal = event.payload.total;
      config.checklist.steps
        .filter((step) => step.tracksProgress && progress >= progressTotal)
        .forEach((step) => completed.add(step.id));
      render();
    }),
    gameDomainEvents.subscribe("task.completed", (event) => {
      if (event.payload.levelId !== config.levelId) return;
      config.checklist.steps.forEach((step) => completed.add(step.id));
      render();
    })
  ];

  render();

  return Object.freeze({
    destroy: () => {
      if (completionTimer !== undefined) window.clearTimeout(completionTimer);
      disposers.forEach((dispose) => dispose());
      root.remove();
      delete document.body.dataset.levelChecklist;
    }
  });
}
