export type RestockMemoryPreviewVariant = "promotion" | "finale-wave";

export interface RestockMemoryPreviewDomConfig {
  readonly sequence: readonly number[];
  readonly durationMs: number;
  readonly onComplete: () => void;
  readonly variant?: RestockMemoryPreviewVariant;
  readonly waveLabel?: string;
}

export interface RestockMemoryPreviewDomHandle {
  readonly destroy: () => void;
}

const applyStyles = (element: HTMLElement, styles: Partial<CSSStyleDeclaration>): void => {
  Object.assign(element.style, styles);
};

export function mountRestockMemoryPreviewDom(
  config: RestockMemoryPreviewDomConfig
): RestockMemoryPreviewDomHandle {
  if (config.sequence.length < 1 || config.sequence.length > 6) {
    throw new Error("Restock memory preview requires between one and six cooler slots");
  }
  const uniqueSlots = new Set(config.sequence);
  if (
    uniqueSlots.size !== config.sequence.length ||
    config.sequence.some((slot) => !Number.isInteger(slot) || slot < 0 || slot > 5)
  ) {
    throw new Error("Restock memory preview slots must be unique cooler indexes from 0 to 5");
  }
  if (!Number.isFinite(config.durationMs) || config.durationMs < 1000) {
    throw new Error("Restock memory preview duration must be at least one second");
  }

  const variant = config.variant ?? "promotion";
  const sequenceLength = config.sequence.length;
  const waveLabel = config.waveLabel?.trim() || "FINAL WAVE";
  const isFinaleWave = variant === "finale-wave";

  let active = true;
  let completed = false;
  const overlay = document.createElement("section");
  overlay.id = "restock-memory-preview";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute(
    "aria-label",
    isFinaleWave ? `Memorize ${waveLabel.toLowerCase()}` : "Memorize the promotion shelf order"
  );
  applyStyles(overlay, {
    position: "fixed",
    inset: "0",
    zIndex: "9400",
    display: "grid",
    placeItems: "center",
    padding: "18px",
    boxSizing: "border-box",
    background: "rgba(4, 10, 7, 0.64)",
    backdropFilter: "blur(5px)",
    fontFamily: "Arial, sans-serif",
    color: "#ffffff",
    pointerEvents: "all",
    touchAction: "none"
  });

  const panel = document.createElement("div");
  applyStyles(panel, {
    width: "min(620px, 100%)",
    padding: "22px",
    boxSizing: "border-box",
    border: "1px solid rgba(255, 217, 94, 0.55)",
    borderRadius: "22px",
    background: "linear-gradient(145deg, rgba(10, 31, 21, 0.98), rgba(18, 48, 33, 0.98))",
    boxShadow: "0 24px 70px rgba(0, 0, 0, 0.5)"
  });

  const eyebrow = document.createElement("div");
  eyebrow.textContent = isFinaleWave ? "CHAPTER FINALE" : "PROMOTION PLAN";
  applyStyles(eyebrow, {
    color: "#ffd95e",
    fontSize: "10px",
    fontWeight: "900",
    letterSpacing: "1.8px",
    textAlign: "center"
  });

  const title = document.createElement("h2");
  title.textContent = isFinaleWave ? `Memorize ${waveLabel}` : "Memorize the shelf order";
  applyStyles(title, {
    margin: "6px 0 5px",
    textAlign: "center",
    fontSize: "clamp(24px, 5vw, 36px)",
    lineHeight: "1.05"
  });

  const instruction = document.createElement("p");
  instruction.textContent = isFinaleWave
    ? `Watch this ${sequenceLength}-shelf route. The glow disappears when the rush begins.`
    : `Watch the glow from 1 to ${sequenceLength}. The numbers disappear when stocking begins.`;
  applyStyles(instruction, {
    margin: "0 auto 10px",
    maxWidth: "500px",
    textAlign: "center",
    color: "#d6e7db",
    fontSize: "14px",
    lineHeight: "1.45"
  });

  const sequenceCue = document.createElement("div");
  sequenceCue.id = "restock-memory-sequence-cue";
  sequenceCue.textContent = `WATCH THE GLOW · 1 → ${sequenceLength}`;
  applyStyles(sequenceCue, {
    marginBottom: "12px",
    textAlign: "center",
    color: "#9be7ff",
    fontSize: "12px",
    fontWeight: "900",
    letterSpacing: "1px"
  });

  const cooler = document.createElement("div");
  cooler.id = "restock-memory-grid";
  applyStyles(cooler, {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(120px, 1fr))",
    gridTemplateRows: "repeat(3, 70px)",
    gap: "10px 16px",
    maxWidth: "390px",
    margin: "0 auto",
    padding: "14px",
    border: "5px solid #203b30",
    borderRadius: "16px",
    background: "rgba(2, 14, 11, 0.8)",
    boxShadow: "inset 0 0 0 2px rgba(173, 203, 190, 0.18)"
  });

  const orderBySlot = new Map<number, number>();
  config.sequence.forEach((slotIndex, orderIndex) => orderBySlot.set(slotIndex, orderIndex + 1));
  const cellsByOrder: HTMLElement[] = [];
  [0, 3, 1, 4, 2, 5].forEach((slotIndex) => {
    const order = orderBySlot.get(slotIndex) ?? 0;
    const cell = document.createElement("div");
    cell.dataset.slotIndex = String(slotIndex);
    cell.dataset.order = String(order);
    applyStyles(cell, {
      position: "relative",
      display: "grid",
      placeItems: "center",
      border: "2px solid rgba(183, 213, 199, 0.26)",
      borderRadius: "10px",
      background: order > 0
        ? "linear-gradient(180deg, rgba(59, 92, 78, 0.5), rgba(13, 36, 28, 0.65))"
        : "linear-gradient(180deg, rgba(33, 48, 41, 0.4), rgba(9, 22, 17, 0.55))",
      overflow: "hidden",
      transformOrigin: "center",
      opacity: order > 0 ? "1" : "0.5"
    });

    const shelf = document.createElement("div");
    applyStyles(shelf, {
      position: "absolute",
      left: "8px",
      right: "8px",
      bottom: "8px",
      height: "4px",
      borderRadius: "3px",
      background: "rgba(216, 231, 224, 0.5)"
    });

    const number = document.createElement("span");
    number.textContent = String(order || "·");
    applyStyles(number, {
      display: "grid",
      placeItems: "center",
      width: "42px",
      height: "42px",
      borderRadius: "50%",
      background: order > 0 ? "#dcb53f" : "rgba(92, 116, 104, 0.45)",
      color: order > 0 ? "#182319" : "#a7b8af",
      fontSize: "22px",
      fontWeight: "900",
      boxShadow: "0 6px 14px rgba(0, 0, 0, 0.28)",
      transformOrigin: "center"
    });
    cell.append(shelf, number);
    cooler.appendChild(cell);
    if (order > 0) cellsByOrder[order - 1] = cell;
  });

  const countdown = document.createElement("div");
  countdown.id = "restock-memory-countdown";
  applyStyles(countdown, {
    marginTop: "14px",
    textAlign: "center",
    color: "#ffd95e",
    fontSize: "13px",
    fontWeight: "800",
    letterSpacing: "0.6px"
  });

  const progress = document.createElement("div");
  applyStyles(progress, {
    height: "5px",
    marginTop: "10px",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.1)",
    overflow: "hidden"
  });
  const fill = document.createElement("div");
  applyStyles(fill, {
    width: "100%",
    height: "100%",
    borderRadius: "999px",
    background: "linear-gradient(90deg, #ffd95e, #9be7ff)",
    transformOrigin: "left center"
  });
  progress.appendChild(fill);

  panel.append(eyebrow, title, instruction, sequenceCue, cooler, countdown, progress);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  document.body.dataset.restockMemory = "preview";
  document.body.dataset.restockMemoryVariant = variant;
  if (!isFinaleWave && sequenceLength === 6) {
    document.body.dataset.levelTwoMemoryPreview = "sequential-glow";
  }

  const startedAt = performance.now();
  let frameId = 0;
  let timerId = 0;
  let exitTimerId = 0;
  const pulseTimerIds: number[] = [];
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pulseStepMs = Math.max(
    90,
    Math.min(420, Math.floor(Math.max(540, config.durationMs - 560) / sequenceLength))
  );

  const clearPulseTimers = (): void => {
    pulseTimerIds.splice(0).forEach((id) => window.clearTimeout(id));
  };

  if (!reducedMotion) {
    cellsByOrder.forEach((cell, index) => {
      const pulseTimerId = window.setTimeout(() => {
        if (!active) return;
        sequenceCue.textContent = `NOW WATCH ${index + 1} OF ${cellsByOrder.length}`;
        cell.style.borderColor = "rgba(155, 231, 255, 0.94)";
        const number = cell.querySelector("span");
        cell.animate(
          [
            { transform: "scale(1)", boxShadow: "0 0 0 rgba(155, 231, 255, 0)" },
            { transform: "scale(1.09)", boxShadow: "0 0 28px rgba(155, 231, 255, 0.72)" },
            { transform: "scale(1)", boxShadow: "0 0 8px rgba(155, 231, 255, 0.3)" }
          ],
          { duration: 360, easing: "cubic-bezier(.2,.8,.2,1)" }
        );
        number?.animate(
          [
            { transform: "scale(1)", background: "#dcb53f" },
            { transform: "scale(1.22)", background: "#9be7ff" },
            { transform: "scale(1)", background: "#dcb53f" }
          ],
          { duration: 360, easing: "cubic-bezier(.2,.8,.2,1)" }
        );
      }, 180 + index * pulseStepMs);
      pulseTimerIds.push(pulseTimerId);
    });
  }

  const completeOverlay = (): void => {
    if (completed) return;
    completed = true;
    overlay.remove();
    document.body.dataset.restockMemory = "active";
    config.onComplete();
  };

  const finish = (): void => {
    if (!active) return;
    active = false;
    cancelAnimationFrame(frameId);
    window.clearTimeout(timerId);
    clearPulseTimers();
    countdown.textContent = isFinaleWave ? "GO! STOCK THE WAVE" : "GO! STOCK FROM MEMORY";
    countdown.style.color = "#9be7ff";
    countdown.style.fontSize = "18px";
    sequenceCue.textContent = "NUMBERS HIDDEN · TRUST YOUR MEMORY";
    sequenceCue.style.color = "#ffd95e";
    fill.style.transform = "scaleX(0)";

    panel.animate(
      [
        { transform: "scale(1)", boxShadow: "0 24px 70px rgba(0, 0, 0, 0.5)" },
        { transform: "scale(1.025)", boxShadow: "0 24px 85px rgba(155, 231, 255, 0.32)" },
        { transform: "scale(1)", boxShadow: "0 24px 70px rgba(0, 0, 0, 0.5)" }
      ],
      { duration: 340, easing: "ease-out" }
    );

    exitTimerId = window.setTimeout(() => {
      overlay.animate(
        [
          { opacity: 1, transform: "scale(1)" },
          { opacity: 0, transform: "scale(1.015)" }
        ],
        { duration: 180, easing: "ease-out", fill: "forwards" }
      ).finished.finally(completeOverlay);
    }, reducedMotion ? 80 : 360);
  };

  const update = (): void => {
    if (!active) return;
    const elapsed = performance.now() - startedAt;
    const remaining = Math.max(0, config.durationMs - elapsed);
    countdown.textContent = `${isFinaleWave ? "Wave" : "Stocking"} starts in ${Math.max(1, Math.ceil(remaining / 1000))}`;
    fill.style.transform = `scaleX(${Math.max(0, remaining / config.durationMs)})`;
    if (remaining > 0) frameId = requestAnimationFrame(update);
  };
  update();
  timerId = window.setTimeout(finish, config.durationMs);

  return Object.freeze({
    destroy: () => {
      active = false;
      completed = true;
      cancelAnimationFrame(frameId);
      window.clearTimeout(timerId);
      window.clearTimeout(exitTimerId);
      clearPulseTimers();
      overlay.remove();
      delete document.body.dataset.restockMemory;
      delete document.body.dataset.restockMemoryVariant;
      delete document.body.dataset.levelTwoMemoryPreview;
    }
  });
}
