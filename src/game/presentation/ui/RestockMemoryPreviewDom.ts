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
  const overlay = document.createElement("section");
  overlay.id = "restock-memory-preview";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-label", "Memorize the promotion shelf order");
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
  eyebrow.textContent = "PROMOTION PLAN";
  applyStyles(eyebrow, {
    color: "#ffd95e",
    fontSize: "10px",
    fontWeight: "900",
    letterSpacing: "1.8px",
    textAlign: "center"
  });

  const title = document.createElement("h2");
  title.textContent = "Memorize the shelf order";
  applyStyles(title, {
    margin: "6px 0 5px",
    textAlign: "center",
    fontSize: "clamp(24px, 5vw, 36px)",
    lineHeight: "1.05"
  });

  const instruction = document.createElement("p");
  instruction.textContent = "The numbers disappear when stocking begins. Fill every slot in this exact order.";
  applyStyles(instruction, {
    margin: "0 auto 18px",
    maxWidth: "500px",
    textAlign: "center",
    color: "#d6e7db",
    fontSize: "14px",
    lineHeight: "1.45"
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
  [0, 3, 1, 4, 2, 5].forEach((slotIndex) => {
    const cell = document.createElement("div");
    cell.dataset.slotIndex = String(slotIndex);
    applyStyles(cell, {
      position: "relative",
      display: "grid",
      placeItems: "center",
      border: "2px solid rgba(183, 213, 199, 0.26)",
      borderRadius: "10px",
      background: "linear-gradient(180deg, rgba(59, 92, 78, 0.5), rgba(13, 36, 28, 0.65))",
      overflow: "hidden"
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
    number.textContent = String(orderBySlot.get(slotIndex) ?? "?");
    applyStyles(number, {
      display: "grid",
      placeItems: "center",
      width: "42px",
      height: "42px",
      borderRadius: "50%",
      background: "#dcb53f",
      color: "#182319",
      fontSize: "22px",
      fontWeight: "900",
      boxShadow: "0 6px 14px rgba(0, 0, 0, 0.28)"
    });
    cell.append(shelf, number);
    cooler.appendChild(cell);
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
    background: "#ffd95e",
    transformOrigin: "left center"
  });
  progress.appendChild(fill);

  panel.append(eyebrow, title, instruction, cooler, countdown, progress);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  document.body.dataset.restockMemory = "preview";

  const startedAt = performance.now();
  let frameId = 0;
  let timerId = 0;

  const finish = (): void => {
    if (!active) return;
    active = false;
    cancelAnimationFrame(frameId);
    window.clearTimeout(timerId);
    overlay.animate(
      [
        { opacity: 1, transform: "scale(1)" },
        { opacity: 0, transform: "scale(1.015)" }
      ],
      { duration: 180, easing: "ease-out", fill: "forwards" }
    ).finished.finally(() => {
      overlay.remove();
      document.body.dataset.restockMemory = "active";
      config.onComplete();
    });
  };

  const update = (): void => {
    if (!active) return;
    const elapsed = performance.now() - startedAt;
    const remaining = Math.max(0, config.durationMs - elapsed);
    countdown.textContent = `Stocking starts in ${Math.max(1, Math.ceil(remaining / 1000))}`;
    fill.style.transform = `scaleX(${Math.max(0, remaining / config.durationMs)})`;
    if (remaining > 0) frameId = requestAnimationFrame(update);
  };
  update();
  timerId = window.setTimeout(finish, config.durationMs);

  return Object.freeze({
    destroy: () => {
      active = false;
      cancelAnimationFrame(frameId);
      window.clearTimeout(timerId);
      overlay.remove();
      delete document.body.dataset.restockMemory;
    }
  });
}
