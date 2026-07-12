import Phaser from "phaser";
import { StorefrontScene } from "./scenes/StorefrontScene";

type RuntimeStorefront = Phaser.Scene & {
  startShift: (day: "day01" | "day02" | "day03") => void;
};

type StorefrontPrototype = {
  create: (...args: unknown[]) => void;
};

let activeStorefront: RuntimeStorefront | undefined;
let observer: MutationObserver | undefined;

installStorefrontBridge();
installMobileStartCapture();

function installStorefrontBridge(): void {
  const prototype = StorefrontScene.prototype as unknown as StorefrontPrototype;
  const originalCreate = prototype.create;

  prototype.create = function createWithDayThreeMobileStart(...args: unknown[]): void {
    originalCreate.apply(this, args);
    const scene = this as unknown as RuntimeStorefront;
    activeStorefront = scene;
    syncMobileStartButton();
    ensureObserver();

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (activeStorefront === scene) activeStorefront = undefined;
    });
  };
}

function installMobileStartCapture(): void {
  document.addEventListener("click", (event) => {
    const target = event.target as HTMLElement | null;
    const button = target?.closest<HTMLButtonElement>('#mobile-storefront-actions [data-action="start"]');
    if (!button || readActiveDay() !== "day03") return;
    if (!activeStorefront?.scene.isActive()) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    activeStorefront.startShift("day03");
  }, true);
}

function ensureObserver(): void {
  if (observer) return;
  const actions = document.getElementById("mobile-storefront-actions");
  if (!actions) return;
  observer = new MutationObserver(syncMobileStartButton);
  observer.observe(actions, { childList: true, subtree: true, characterData: true });
}

function syncMobileStartButton(): void {
  const button = document.querySelector<HTMLButtonElement>('#mobile-storefront-actions [data-action="start"]');
  if (!button) return;
  const day = readActiveDay();
  const expected = `START DAY ${Number(day.slice(-2))}`;
  if (button.textContent !== expected) button.textContent = expected;
}

function readActiveDay(): "day01" | "day02" | "day03" {
  try {
    const stored = globalThis.localStorage?.getItem("supermarket.activeDay");
    if (stored === "day03") return "day03";
    if (stored === "day02") return "day02";
    return "day01";
  } catch {
    return "day01";
  }
}
