import type { LevelChecklistSpec } from "../../content/experience/LevelExperienceSpec";
import { gameDomainEvents } from "../../events/GameDomainEvents";

export interface LevelChecklistDomConfig {
  readonly levelId: string;
  readonly checklist: LevelChecklistSpec;
}

export interface LevelChecklistHandle {
  readonly destroy: () => void;
}

const applyStyles = (element: HTMLElement, styles: Partial<CSSStyleDeclaration>): void => {
  Object.assign(element.style, styles);
};

export function mountLevelChecklistDom(config: LevelChecklistDomConfig): LevelChecklistHandle {
  const root = document.createElement("aside");
  root.id = "level-checklist";
  root.setAttribute("aria-label", `${config.checklist.heading} steps`);
  applyStyles(root, {
    position: "fixed",
    left: "clamp(12px, 2vw, 28px)",
    top: "clamp(112px, 16vh, 154px)",
    zIndex: "9000",
    width: "min(280px, calc(100vw - 24px))",
    boxSizing: "border-box",
    padding: "16px",
    border: "1px solid rgba(255, 217, 94, 0.34)",
    borderRadius: "18px",
    background: "rgba(9, 27, 18, 0.9)",
    boxShadow: "0 16px 38px rgba(0, 0, 0, 0.28)",
    color: "#ffffff",
    fontFamily: "Arial, sans-serif",
    pointerEvents: "none",
    backdropFilter: "blur(5px)"
  });

  const eyebrow = document.createElement("div");
  eyebrow.textContent = config.checklist.eyebrow;
  applyStyles(eyebrow, {
    marginBottom: "4px",
    color: "#ffd95e",
    fontSize: "10px",
    fontWeight: "800",
    letterSpacing: "1.5px"
  });
  root.appendChild(eyebrow);

  const heading = document.createElement("div");
  heading.textContent = config.checklist.heading;
  applyStyles(heading, {
    marginBottom: "12px",
    fontSize: "18px",
    fontWeight: "800"
  });
  root.appendChild(heading);

  const rowById = new Map<string, { row: HTMLElement; icon: HTMLElement; label: HTMLElement }>();
  config.checklist.steps.forEach((step, index) => {
    const row = document.createElement("div");
    row.dataset.stepId = step.id;
    applyStyles(row, {
      display: "grid",
      gridTemplateColumns: "24px 1fr",
      alignItems: "center",
      gap: "9px",
      minHeight: "34px",
      padding: "4px 0",
      opacity: index === 0 ? "1" : "0.48",
      transition: "opacity 160ms ease, transform 160ms ease"
    });

    const icon = document.createElement("span");
    icon.textContent = index === 0 ? "→" : "○";
    applyStyles(icon, {
      display: "grid",
      placeItems: "center",
      width: "22px",
      height: "22px",
      borderRadius: "50%",
      background: index === 0 ? "#5a914f" : "rgba(255,255,255,0.08)",
      color: index === 0 ? "#ffffff" : "#aac2b1",
      fontSize: "12px",
      fontWeight: "900"
    });

    const label = document.createElement("span");
    label.textContent = step.label;
    applyStyles(label, {
      fontSize: "13px",
      lineHeight: "1.3",
      fontWeight: index === 0 ? "700" : "500"
    });

    row.append(icon, label);
    root.appendChild(row);
    rowById.set(step.id, { row, icon, label });
  });

  document.body.appendChild(root);
  document.body.dataset.levelChecklist = "active";

  const completed = new Set<string>();
  let progress = 0;
  let progressTotal = 0;

  const render = (): void => {
    const firstIncomplete = config.checklist.steps.find((step) => !completed.has(step.id));
    config.checklist.steps.forEach((step) => {
      const elements = rowById.get(step.id);
      if (!elements) return;
      const isComplete = completed.has(step.id);
      const isActive = firstIncomplete?.id === step.id;
      elements.row.style.opacity = isComplete || isActive ? "1" : "0.48";
      elements.row.style.transform = isActive ? "translateX(2px)" : "translateX(0)";
      elements.icon.textContent = isComplete ? "✓" : isActive ? "→" : "○";
      elements.icon.style.background = isComplete
        ? "#dcb53f"
        : isActive
          ? "#5a914f"
          : "rgba(255,255,255,0.08)";
      elements.icon.style.color = isComplete ? "#172117" : isActive ? "#ffffff" : "#aac2b1";
      elements.label.style.fontWeight = isComplete || isActive ? "700" : "500";
      elements.label.style.textDecoration = isComplete ? "line-through" : "none";
      elements.label.style.color = isComplete ? "#b8c9bd" : "#ffffff";
      elements.label.textContent = step.tracksProgress && progressTotal > 0
        ? `${step.label} · ${progress}/${progressTotal}`
        : step.label;
    });

    if (completed.size === config.checklist.steps.length) {
      heading.textContent = "Task complete";
      root.style.borderColor = "rgba(255, 217, 94, 0.72)";
      document.body.dataset.levelChecklist = "complete";
    }
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
      progress = progressTotal;
      config.checklist.steps.forEach((step) => completed.add(step.id));
      render();
    })
  ];

  render();

  return Object.freeze({
    destroy: () => {
      disposers.forEach((dispose) => dispose());
      root.remove();
      delete document.body.dataset.levelChecklist;
    }
  });
}
