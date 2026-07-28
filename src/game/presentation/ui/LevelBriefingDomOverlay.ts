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
    placeItems: "start end",
    boxSizing: "border-box",
    padding: "clamp(12px, 2vw, 24px)",
    background: "transparent",
    backdropFilter: "none",
    fontFamily: "Arial, sans-serif",
    color: "#ffffff",
    touchAction: "manipulation",
    pointerEvents: "none"
  });
  overlay.style.setProperty("-webkit-backdrop-filter", "none");

  const panel = document.createElement("div");
  applyStyles(panel, {
    width: "min(430px, calc(100vw - 24px))",
    maxHeight: "calc(100dvh - 24px)",
    overflowY: "auto",
    boxSizing: "border-box",
    padding: "clamp(18px, 2.5vw, 28px)",
    border: "1px solid rgba(255, 218, 102, 0.48)",
    borderRadius: "20px",
    background: "linear-gradient(145deg, rgba(10, 27, 18, 0.96), rgba(20, 48, 31, 0.94))",
    boxShadow: "0 18px 46px rgba(0, 0, 0, 0.38)",
    pointerEvents: "auto"
  });

  const topRow = document.createElement("div");
  applyStyles(topRow, {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "8px",
    marginBottom: "12px"
  });

  const modePill = createText("span", config.experience.modeLabel);
  applyStyles(modePill, {
    display: "inline-flex",
    alignItems: "center",
    minHeight: "28px",
    padding: "0 11px",
    borderRadius: "999px",
    background: "#5a914f",
    fontSize: "11px",
    fontWeight: "700",
    letterSpacing: "1px"
  });
  topRow.appendChild(modePill);

  const levelMeta = createText(
    "span",
    `${config.dayLabel} · ${config.levelLabel} · ${config.startTime}`
  );
  applyStyles(levelMeta, {
    color: "#c6dfce",
    fontSize: "12px",
    fontWeight: "700",
    letterSpacing: "0.5px"
  });
  topRow.appendChild(levelMeta);
  panel.appendChild(topRow);

  const eyebrow = createText("div", config.experience.eyebrow);
  applyStyles(eyebrow, {
    marginBottom: "6px",
    color: "#ffd966",
    fontSize: "11px",
    fontWeight: "800",
    letterSpacing: "1.6px"
  });
  panel.appendChild(eyebrow);

  const title = createText("h1", config.experience.title);
  title.id = "level-briefing-title";
  applyStyles(title, {
    margin: "0 0 9px",
    fontSize: "clamp(25px, 4vw, 36px)",
    lineHeight: "1.08",
    letterSpacing: "-0.8px"
  });
  panel.appendChild(title);

  const objective = createText("p", config.experience.objective);
  applyStyles(objective, {
    margin: "0 0 16px",
    color: "#f2f8f4",
    fontSize: "clamp(14px, 2vw, 17px)",
    lineHeight: "1.42"
  });
  panel.appendChild(objective);

  const cards = document.createElement("div");
  applyStyles(cards, {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "8px",
    marginBottom: "16px"
  });

  const cardData = [
    ["NEW THIS LEVEL", config.experience.mechanic],
    ["HOW TO PLAY", config.experience.control],
    ["SUCCESS", config.experience.successMetric]
  ] as const;

  cardData.forEach(([label, value]) => {
    const card = document.createElement("div");
    applyStyles(card, {
      padding: "11px 13px",
      boxSizing: "border-box",
      border: "1px solid rgba(255, 255, 255, 0.1)",
      borderRadius: "12px",
      background: "rgba(0, 0, 0, 0.16)"
    });

    const cardLabel = createText("div", label);
    applyStyles(cardLabel, {
      marginBottom: "4px",
      color: "#a9cfb7",
      fontSize: "9px",
      fontWeight: "800",
      letterSpacing: "1.2px"
    });
    card.appendChild(cardLabel);

    const cardValue = createText("p", value);
    applyStyles(cardValue, {
      margin: "0",
      color: "#ffffff",
      fontSize: "13px",
      lineHeight: "1.38"
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
    minHeight: "52px",
    border: "0",
    borderRadius: "14px",
    background: "linear-gradient(180deg, #f6cf57, #dcae2f)",
    color: "#172117",
    fontSize: "15px",
    fontWeight: "900",
    letterSpacing: "1.1px",
    cursor: "pointer",
    boxShadow: "0 8px 22px rgba(221, 176, 47, 0.24)"
  });
  panel.appendChild(startButton);

  const keyboardHint = createText("div", "Press Enter or tap the button to begin");
  applyStyles(keyboardHint, {
    marginTop: "8px",
    textAlign: "center",
    color: "#9db8a5",
    fontSize: "11px"
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
    panel.animate(
      [
        { opacity: 1, transform: "translateY(0)" },
        { opacity: 0, transform: "translateY(-8px)" }
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
