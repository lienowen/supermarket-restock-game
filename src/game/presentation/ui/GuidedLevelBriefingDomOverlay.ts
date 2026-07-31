import type {
  LevelChecklistSpec,
  LevelExperienceSpec
} from "../../content/experience/LevelExperienceSpec";

export interface GuidedLevelBriefingConfig {
  readonly levelLabel: string;
  readonly dayLabel: string;
  readonly experience: LevelExperienceSpec;
  readonly checklist: LevelChecklistSpec;
}

export interface GuidedLevelBriefingHandle {
  readonly start: () => void;
  readonly destroy: () => void;
}

const applyStyles = (
  element: HTMLElement,
  styles: Partial<CSSStyleDeclaration>
): void => {
  Object.assign(element.style, styles);
};

const createText = (
  tagName: "div" | "p" | "span" | "h1",
  text: string
): HTMLElement => {
  const element = document.createElement(tagName);
  element.textContent = text;
  return element;
};

/**
 * First-level briefing. It teaches the route at a glance instead of asking the
 * player to read several paragraphs before touching the game.
 */
export function mountGuidedLevelBriefingDomOverlay(
  config: GuidedLevelBriefingConfig,
  onStart: () => void
): GuidedLevelBriefingHandle {
  let active = true;

  const overlay = document.createElement("section");
  overlay.id = "guided-level-briefing";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "guided-level-title");
  applyStyles(overlay, {
    position: "fixed",
    inset: "0",
    zIndex: "10000",
    display: "grid",
    placeItems: "center",
    boxSizing: "border-box",
    padding: "clamp(14px, 3vw, 34px)",
    background: "linear-gradient(90deg, rgba(5, 14, 10, 0.62), rgba(5, 14, 10, 0.22))",
    fontFamily: "Arial, sans-serif",
    color: "#ffffff",
    touchAction: "manipulation"
  });

  const panel = document.createElement("div");
  applyStyles(panel, {
    width: "min(760px, calc(100vw - 28px))",
    boxSizing: "border-box",
    padding: "clamp(20px, 3vw, 32px)",
    border: "1px solid rgba(255, 218, 102, 0.52)",
    borderRadius: "24px",
    background: "linear-gradient(145deg, rgba(10, 27, 18, 0.98), rgba(20, 48, 31, 0.97))",
    boxShadow: "0 24px 70px rgba(0, 0, 0, 0.46)"
  });

  const meta = createText("div", `${config.dayLabel} · ${config.levelLabel}`);
  applyStyles(meta, {
    color: "#a9cfb7",
    fontSize: "11px",
    fontWeight: "800",
    letterSpacing: "1.3px"
  });

  const title = createText("h1", config.experience.title);
  title.id = "guided-level-title";
  applyStyles(title, {
    margin: "7px 0 8px",
    fontSize: "clamp(29px, 5vw, 44px)",
    lineHeight: "1.04",
    letterSpacing: "-1px"
  });

  const objective = createText("p", config.experience.objective);
  applyStyles(objective, {
    margin: "0",
    maxWidth: "660px",
    color: "#e9f3ec",
    fontSize: "clamp(14px, 2vw, 17px)",
    lineHeight: "1.42"
  });

  const routeLabel = createText("div", "FOLLOW THE GLOW · ONE STEP AT A TIME");
  applyStyles(routeLabel, {
    marginTop: "20px",
    color: "#ffd95e",
    fontSize: "10px",
    fontWeight: "900",
    letterSpacing: "1.5px"
  });

  const route = document.createElement("div");
  applyStyles(route, {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
    gap: "9px",
    marginTop: "9px"
  });

  config.checklist.steps.forEach((step, index) => {
    const card = document.createElement("div");
    applyStyles(card, {
      minHeight: "76px",
      boxSizing: "border-box",
      padding: "11px 12px",
      border: index === 0
        ? "1px solid rgba(255, 217, 94, 0.72)"
        : "1px solid rgba(255, 255, 255, 0.11)",
      borderRadius: "14px",
      background: index === 0
        ? "rgba(220, 181, 63, 0.13)"
        : "rgba(0, 0, 0, 0.16)"
    });

    const number = createText("span", String(index + 1));
    applyStyles(number, {
      display: "grid",
      placeItems: "center",
      width: "24px",
      height: "24px",
      borderRadius: "50%",
      background: index === 0 ? "#ffd95e" : "rgba(255,255,255,0.1)",
      color: index === 0 ? "#1c2a20" : "#d7e7dc",
      fontSize: "11px",
      fontWeight: "900"
    });

    const label = createText("div", step.label);
    applyStyles(label, {
      marginTop: "8px",
      color: "#ffffff",
      fontSize: "12px",
      fontWeight: "800",
      lineHeight: "1.25"
    });
    card.append(number, label);
    route.appendChild(card);
  });

  const helper = createText(
    "p",
    "The game highlights the only action you need now. Complete it and the guide moves automatically."
  );
  applyStyles(helper, {
    margin: "15px 0 0",
    color: "#b9d0c0",
    fontSize: "12px",
    lineHeight: "1.4"
  });

  const startButton = document.createElement("button");
  startButton.type = "button";
  startButton.textContent = "START FIRST DELIVERY";
  applyStyles(startButton, {
    width: "100%",
    minHeight: "54px",
    marginTop: "18px",
    border: "0",
    borderRadius: "15px",
    background: "linear-gradient(180deg, #f6cf57, #dcae2f)",
    color: "#172117",
    fontSize: "15px",
    fontWeight: "900",
    letterSpacing: "0.9px",
    cursor: "pointer",
    boxShadow: "0 9px 24px rgba(221, 176, 47, 0.25)"
  });

  panel.append(meta, title, objective, routeLabel, route, helper, startButton);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  document.body.dataset.levelBriefing = "open";
  document.body.dataset.guidanceMode = "single-focus";

  const destroy = (): void => {
    window.removeEventListener("keydown", handleKeyDown);
    overlay.remove();
    if (document.body.dataset.levelBriefing === "open") {
      document.body.dataset.levelBriefing = "closed";
    }
  };

  const start = (): void => {
    if (!active) return;
    active = false;
    startButton.disabled = true;
    panel.animate(
      [
        { opacity: 1, transform: "translateY(0) scale(1)" },
        { opacity: 0, transform: "translateY(-8px) scale(0.99)" }
      ],
      { duration: 150, easing: "ease-out", fill: "forwards" }
    ).finished.finally(() => {
      destroy();
      onStart();
    });
  };

  function handleKeyDown(event: KeyboardEvent): void {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    start();
  }

  startButton.addEventListener("click", start);
  window.addEventListener("keydown", handleKeyDown);
  window.setTimeout(() => startButton.focus(), 0);

  return Object.freeze({ start, destroy });
}
