export interface RestockMemoryPreviewDomConfig {
  readonly sequence: readonly number[];
  readonly durationMs: number;
  readonly onComplete: () => void;
}

export interface RestockMemoryPreviewDomHandle {
  readonly destroy: () => void;
}

const applyStyles = (element: HTMLElement, styles: Partial<CSSStyleDeclaration>): void => {
  Object.assign(element.style, styles);
};

/**
 * Compact memorization card for the promotion restock. The gameplay scene stays
 * visible behind it and the player has exactly one thing to read: shelf order.
 */
export function mountRestockMemoryPreviewDom(
  config: RestockMemoryPreviewDomConfig
): RestockMemoryPreviewDomHandle {
  if (config.sequence.length !== 6) {
    throw new Error("Restock memory preview requires exactly six cooler slots");
  }
  if (!Number.isFinite(config.durationMs) || config.durationMs < 1000) {
    throw new Error("Restock memory preview duration must be at least one second");
  }

  let active = true;
  let completed = false;
  let frameId = 0;
  let timerId = 0;
  let exitTimerId = 0;
  const pulseTimerIds: number[] = [];

  const overlay = document.createElement("section");
  overlay.id = "restock-memory-preview";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-label", "Memorize the promotion shelf order");
  applyStyles(overlay, {
    position: "fixed",
    inset: "0",
    zIndex: "9400",
    display: "grid",
    placeItems: "start center",
    padding: "38px 14px 14px",
    boxSizing: "border-box",
    background: "rgba(4, 10, 7, 0.32)",
    backdropFilter: "blur(2px)",
    fontFamily: "Arial, sans-serif",
    color: "#ffffff",
    pointerEvents: "all",
    touchAction: "none"
  });

  const panel = document.createElement("div");
  applyStyles(panel, {
    width: "min(440px, 100%)",
    padding: "14px 16px 12px",
    boxSizing: "border-box",
    border: "1px solid rgba(255, 217, 94, 0.58)",
    borderRadius: "16px",
    background: "rgba(9, 27, 18, 0.96)",
    boxShadow: "0 16px 42px rgba(0, 0, 0, 0.42)"
  });

  const title = document.createElement("div");
  title.textContent = "MEMORIZE · 1 → 6";
  applyStyles(title, {
    textAlign: "center",
    color: "#ffe078",
    fontSize: "18px",
    fontWeight: "900",
    letterSpacing: "1px"
  });

  const instruction = document.createElement("div");
  instruction.textContent = "Remember the shelf positions.";
  applyStyles(instruction, {
    margin: "4px 0 10px",
    textAlign: "center",
    color: "#cfe1d4",
    fontSize: "11px",
    fontWeight: "700"
  });

  const cooler = document.createElement("div");
  cooler.id = "restock-memory-grid";
  applyStyles(cooler, {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(100px, 1fr))",
    gridTemplateRows: "repeat(3, 52px)",
    gap: "7px 10px",
    maxWidth: "300px",
    margin: "0 auto",
    padding: "9px",
    border: "3px solid #294739",
    borderRadius: "12px",
    background: "rgba(2, 14, 11, 0.72)"
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
      border: "1px solid rgba(183, 213, 199, 0.25)",
      borderRadius: "8px",
      background: "rgba(48, 78, 65, 0.48)",
      overflow: "hidden"
    });

    const shelf = document.createElement("div");
    applyStyles(shelf, {
      position: "absolute",
      left: "7px",
      right: "7px",
      bottom: "6px",
      height: "3px",
      borderRadius: "2px",
      background: "rgba(216, 231, 224, 0.44)"
    });

    const number = document.createElement("span");
    number.textContent = String(order || "?");
    applyStyles(number, {
      display: "grid",
      placeItems: "center",
      width: "30px",
      height: "30px",
      borderRadius: "50%",
      background: "#dcb53f",
      color: "#182319",
      fontSize: "16px",
      fontWeight: "900",
      boxShadow: "0 4px 10px rgba(0,0,0,0.24)"
    });

    cell.append(shelf, number);
    cooler.appendChild(cell);
    if (order > 0) cellsByOrder[order - 1] = cell;
  });

  const footer = document.createElement("div");
  applyStyles(footer, {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    marginTop: "9px"
  });

  const countdown = document.createElement("div");
  countdown.id = "restock-memory-countdown";
  applyStyles(countdown, {
    minWidth: "126px",
    textAlign: "center",
    color: "#ffe078",
    fontSize: "11px",
    fontWeight: "900",
    letterSpacing: "0.4px"
  });

  const progress = document.createElement("div");
  applyStyles(progress, {
    width: "110px",
    height: "3px",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.1)",
    overflow: "hidden"
  });
  const fill = document.createElement("div");
  applyStyles(fill, {
    width: "100%",
    height: "100%",
    borderRadius: "999px",
    background: "#ffe078",
    transformOrigin: "left center"
  });
  progress.appendChild(fill);
  footer.append(countdown, progress);

  panel.append(title, instruction, cooler, footer);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  document.body.dataset.restockMemory = "preview";
  document.body.dataset.levelTwoMemoryPreview = "compact-six-slot";

  const startedAt = performance.now();
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pulseStepMs = Math.max(
    90,
    Math.min(390, Math.floor(Math.max(540, config.durationMs - 520) / config.sequence.length))
  );

  const clearPulseTimers = (): void => {
    pulseTimerIds.splice(0).forEach((id) => window.clearTimeout(id));
  };

  if (!reducedMotion) {
    cellsByOrder.forEach((cell, index) => {
      const pulseTimerId = window.setTimeout(() => {
        if (!active) return;
        cell.style.borderColor = "rgba(155, 231, 255, 0.9)";
        const number = cell.querySelector("span");
        number?.animate(
          [
            { transform: "scale(1)", background: "#dcb53f" },
            { transform: "scale(1.16)", background: "#9be7ff" },
            { transform: "scale(1)", background: "#dcb53f" }
          ],
          { duration: 300, easing: "ease-out" }
        );
        window.setTimeout(() => {
          cell.style.borderColor = "rgba(183, 213, 199, 0.25)";
        }, 320);
      }, 140 + index * pulseStepMs);
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
    title.textContent = "GO · PICK 3 → PLACE";
    instruction.textContent = "Follow the single highlighted shelf.";
    countdown.textContent = "START";
    fill.style.transform = "scaleX(0)";

    exitTimerId = window.setTimeout(() => {
      const animation = overlay.animate(
        [
          { opacity: 1, transform: "translateY(0)" },
          { opacity: 0, transform: "translateY(-8px)" }
        ],
        { duration: 150, easing: "ease-out", fill: "forwards" }
      );
      animation.finished.finally(completeOverlay);
    }, reducedMotion ? 40 : 180);
  };

  const update = (): void => {
    if (!active) return;
    const elapsed = performance.now() - startedAt;
    const remaining = Math.max(0, config.durationMs - elapsed);
    countdown.textContent = `${Math.max(1, Math.ceil(remaining / 1000))}s`;
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
      delete document.body.dataset.levelTwoMemoryPreview;
    }
  });
}
