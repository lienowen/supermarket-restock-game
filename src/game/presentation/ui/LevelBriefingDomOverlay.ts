import type { LevelExperienceSpec } from "../../content/experience/LevelExperienceSpec";

export interface LevelBriefingDomConfig {
  readonly levelLabel: string;
  readonly dayLabel: string;
  readonly startTime: string;
  readonly experience: LevelExperienceSpec;
}

export interface LevelBriefingDomHandle {
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
  tagName: "div" | "p" | "span" | "h1" | "h2",
  text: string
): HTMLElement => {
  const element = document.createElement(tagName);
  element.textContent = text;
  return element;
};

export function mountLevelBriefingDomOverlay(
  config: LevelBriefingDomConfig,
  onStart: () => void
): LevelBriefingDomHandle {
  let active = true;
  const overlay = document.createElement("section");
  overlay.id = "level-briefing-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "level-briefing-title");
  overlay.tabIndex = -1;
  applyStyles(overlay, {
    position: "fixed",
    inset: "0",
    zIndex: "10000",
    display: "grid",
    placeItems: "center",
    boxSizing: "border-box",
    padding: "clamp(18px, 4vw, 48px)",
    background: "rgba(4, 10, 7, 0.78)",
    backdropFilter: "blur(8px)",
    fontFamily: "Arial, sans-serif",
    color: "#ffffff",
    touchAction: "manipulation"
  });
  overlay.style.setProperty("-webkit-backdrop-filter", "blur(8px)");

  const panel = document.createElement("div");
  applyStyles(panel, {
    width: "min(760px, 100%)",
    maxHeight: "min(760px, calc(100vh - 32px))",
    overflowY: "auto",
    boxSizing: "border-box",
    padding: "clamp(22px, 4vw, 42px)",
    border: "1px solid rgba(255, 218, 102, 0.45)",
    borderRadius: "24px",
    background: "linear-gradient(145deg, rgba(10, 27, 18, 0.98), rgba(20, 48, 31, 0.97))",
    boxShadow: "0 30px 90px rgba(0, 0, 0, 0.55)"
  });

  const topRow = document.createElement("div");
  applyStyles(topRow, {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "10px",
    marginBottom: "18px"
  });

  const modePill = createText("span", config.experience.modeLabel);
  applyStyles(modePill, {
    display: "inline-flex",
    alignItems: "center",
    minHeight: "30px",
    padding: "0 13px",
    borderRadius: "999px",
    background: "#5a914f",
    fontSize: "12px",
    fontWeight: "700",
    letterSpacing: "1.2px"
  });
  topRow.appendChild(modePill);

  const levelMeta = createText(
    "span",
    `${config.dayLabel} · ${config.levelLabel} · ${config.startTime}`
  );
  applyStyles(levelMeta, {
    color: "#c6dfce",
    fontSize: "13px",
    fontWeight: "700",
    letterSpacing: "0.7px"
  });
  topRow.appendChild(levelMeta);
  panel.appendChild(topRow);

  const eyebrow = createText("div", config.experience.eyebrow);
  applyStyles(eyebrow, {
    marginBottom: "8px",
    color: "#ffd966",
    fontSize: "12px",
    fontWeight: "800",
    letterSpacing: "2px"
  });
  panel.appendChild(eyebrow);

  const title = createText("h1", config.experience.title);
  title.id = "level-briefing-title";
  applyStyles(title, {
    margin: "0 0 12px",
    fontSize: "clamp(30px, 6vw, 52px)",
    lineHeight: "1.02",
    letterSpacing: "-1.4px"
  });
  panel.appendChild(title);

  const objective = createText("p", config.experience.objective);
  applyStyles(objective, {
    margin: "0 0 26px",
    color: "#f2f8f4",
    fontSize: "clamp(16px, 2.5vw, 20px)",
    lineHeight: "1.5"
  });
  panel.appendChild(objective);

  const cards = document.createElement("div");
  applyStyles(cards, {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: "12px",
    marginBottom: "26px"
  });

  const cardData = [
    ["NEW THIS LEVEL", config.experience.mechanic],
    ["HOW TO PLAY", config.experience.control],
    ["SUCCESS", config.experience.successMetric]
  ] as const;

  cardData.forEach(([label, value]) => {
    const card = document.createElement("div");
    applyStyles(card, {
      minHeight: "118px",
      padding: "16px",
      boxSizing: "border-box",
      border: "1px solid rgba(255, 255, 255, 0.11)",
      borderRadius: "16px",
      background: "rgba(0, 0, 0, 0.18)"
    });
    const cardLabel = createText("div", label);
    applyStyles(cardLabel, {
      marginBottom: "8px",
      color: "#a9cfb7",
      fontSize: "10px",
      fontWeight: "800",
      letterSpacing: "1.4px"
    });
    card.appendChild(cardLabel);
    const cardValue = createText("p", value);
    applyStyles(cardValue, {
      margin: "0",
      color: "#ffffff",
      fontSize: "14px",
      lineHeight: "1.45"
    });
    card.appendChild(cardValue);
    cards.appendChild(card);
  });
  panel.appendChild(cards);

  const startButton = document.createElement("button");
  startButton.type = "button";
  startButton.textContent = "START SHIFT";
  startButton.setAttribute("aria-label", `Start ${config.experience.title}`);
  applyStyles(startButton, {
    width: "100%",
    minHeight: "56px",
    border: "0",
    borderRadius: "16px",
    background: "linear-gradient(180deg, #f6cf57, #dcae2f)",
    color: "#172117",
    fontSize: "16px",
    fontWeight: "900",
    letterSpacing: "1.2px",
    cursor: "pointer",
    boxShadow: "0 10px 28px rgba(221, 176, 47, 0.25)"
  });
  panel.appendChild(startButton);

  const keyboardHint = createText("div", "Press Enter or tap the button to begin");
  applyStyles(keyboardHint, {
    marginTop: "11px",
    textAlign: "center",
    color: "#9db8a5",
    fontSize: "12px"
  });
  panel.appendChild(keyboardHint);

  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  document.body.dataset.levelBriefing = "open";

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
    overlay.animate(
      [
        { opacity: 1, transform: "scale(1)" },
        { opacity: 0, transform: "scale(1.015)" }
      ],
      { duration: 170, easing: "ease-out", fill: "forwards" }
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

  startButton.addEventListener("pointerenter", () => {
    startButton.style.transform = "translateY(-1px)";
  });
  startButton.addEventListener("pointerleave", () => {
    startButton.style.transform = "translateY(0)";
  });
  startButton.addEventListener("click", start);
  window.addEventListener("keydown", handleKeyDown);
  window.setTimeout(() => startButton.focus(), 0);

  return Object.freeze({ start, destroy });
}
