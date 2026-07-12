import Phaser from "phaser";
import type { LevelId } from "./domain/gameTypes";
import { LEVELS } from "./levels/levelConfigs";
import { GameScene } from "./scenes/GameScene";
import { OpeningScene } from "./scenes/OpeningScene";
import { PromotionWingScene } from "./scenes/PromotionWingScene";
import { StorefrontScene } from "./scenes/StorefrontScene";
import { gameSession } from "./systems/GameSession";

const GAME_HUD_ID = "mobile-game-hud";
const GAME_TASK_ID = "mobile-game-task";
const STOREFRONT_ACTIONS_ID = "mobile-storefront-actions";
const STOREFRONT_CLOSE_ID = "mobile-storefront-close";

type RuntimeStorefront = Phaser.Scene & {
  modal?: Phaser.GameObjects.Container;
  startShift: (day: LevelId) => void;
  openDaySelector: () => void;
  showToast: (message: string) => void;
};

type RuntimeGame = Phaser.Scene & {
  phase: "PREPARE" | "OPEN" | "RUSH" | "CLOSING" | "RESULT";
  soldCount: number;
  stocked: number;
  money: number;
  remainingSeconds: number;
  shelfSlots: unknown[];
  taskText?: Phaser.GameObjects.Text;
  hintText?: Phaser.GameObjects.Text;
};

type RuntimeWing = Phaser.Scene & {
  gameScene?: RuntimeGame;
  objectiveText?: Phaser.GameObjects.Text;
  __promoQueue?: unknown[];
  slots?: Array<{ product?: Phaser.GameObjects.Image }>;
};

type CreatePrototype = {
  create: (...args: unknown[]) => void;
};

let activeStorefront: RuntimeStorefront | undefined;
let activeGame: RuntimeGame | undefined;
let activeWing: RuntimeWing | undefined;
let lastDomSyncAt = 0;

installDomShell();
wrapStorefront();
wrapOpening();
wrapGame();
wrapPromotionWing();

function wrapStorefront(): void {
  const prototype = StorefrontScene.prototype as unknown as CreatePrototype;
  const originalCreate = prototype.create;

  prototype.create = function createMobileStorefront(...args: unknown[]): void {
    originalCreate.apply(this, args);
    const scene = this as unknown as RuntimeStorefront;
    activeStorefront = scene;
    activeGame = undefined;
    activeWing = undefined;
    setSceneMode("storefront");
    syncStorefrontControls();

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (activeStorefront === scene) activeStorefront = undefined;
    });
  };
}

function wrapOpening(): void {
  const prototype = OpeningScene.prototype as unknown as CreatePrototype;
  const originalCreate = prototype.create;

  prototype.create = function createMobileOpening(...args: unknown[]): void {
    originalCreate.apply(this, args);
    activeStorefront = undefined;
    activeGame = undefined;
    activeWing = undefined;
    setSceneMode("opening");
  };
}

function wrapGame(): void {
  const prototype = GameScene.prototype as unknown as CreatePrototype;
  const originalCreate = prototype.create;

  prototype.create = function createMobileGameplayShell(...args: unknown[]): void {
    originalCreate.apply(this, args);
    const scene = this as unknown as RuntimeGame;
    activeStorefront = undefined;
    activeGame = scene;
    activeWing = undefined;
    setSceneMode("game");
    syncGameplayHud(scene);

    const postUpdate = (): void => throttledGameplaySync(scene);
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, postUpdate);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, postUpdate);
      if (activeGame === scene) activeGame = undefined;
    });
  };
}

function wrapPromotionWing(): void {
  const prototype = PromotionWingScene.prototype as unknown as CreatePrototype;
  const originalCreate = prototype.create;

  prototype.create = function createMobilePromotionShell(...args: unknown[]): void {
    originalCreate.apply(this, args);
    const scene = this as unknown as RuntimeWing;
    activeWing = scene;
    if (scene.gameScene) activeGame = scene.gameScene;
    setSceneMode("promotion");
    syncPromotionHud(scene);

    const postUpdate = (): void => throttledPromotionSync(scene);
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, postUpdate);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, postUpdate);
      if (activeWing === scene) activeWing = undefined;
      if (scene.gameScene?.scene.isActive()) {
        activeGame = scene.gameScene;
        setSceneMode("game");
        syncGameplayHud(scene.gameScene);
      }
    });
  };
}

function installDomShell(): void {
  ensureGameplayHud();
  ensureGameplayTask();
  ensureStorefrontActions();
  ensureStorefrontCloseButton();
}

function ensureGameplayHud(): void {
  if (document.getElementById(GAME_HUD_ID)) return;
  const hud = document.createElement("div");
  hud.id = GAME_HUD_ID;
  hud.innerHTML = [
    '<div class="mobile-hud-duty">',
    '<strong data-role="day">DAY 1</strong>',
    '<span data-role="phase">PREPARE</span>',
    "</div>",
    '<div class="mobile-hud-stats">',
    '<span data-role="stock">STOCK 0/6</span>',
    '<span data-role="sales">SALES 0/4</span>',
    '<span data-role="coins">COINS 0</span>',
    '<span data-role="time">03:30</span>',
    "</div>"
  ].join("");
  document.body.appendChild(hud);
}

function ensureGameplayTask(): void {
  if (document.getElementById(GAME_TASK_ID)) return;
  const task = document.createElement("div");
  task.id = GAME_TASK_ID;
  task.innerHTML = [
    '<strong data-role="task">CURRENT DUTY</strong>',
    '<span data-role="instruction">Prepare the store</span>'
  ].join("");
  document.body.appendChild(task);
}

function ensureStorefrontActions(): void {
  if (document.getElementById(STOREFRONT_ACTIONS_ID)) return;
  const actions = document.createElement("div");
  actions.id = STOREFRONT_ACTIONS_ID;

  const buttons: Array<{ action: string; label: string; primary?: boolean }> = [
    { action: "start", label: "START SHIFT", primary: true },
    { action: "contract", label: "CONTRACT" },
    { action: "days", label: "DAYS" },
    { action: "upgrades", label: "UPGRADES" },
    { action: "store", label: "STORE" },
    { action: "collection", label: "COLLECTION" },
    { action: "settings", label: "SETTINGS" }
  ];

  buttons.forEach(({ action, label, primary }) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.action = action;
    button.textContent = label;
    if (primary) button.className = "primary";
    button.addEventListener("click", () => runStorefrontAction(action));
    actions.appendChild(button);
  });
  document.body.appendChild(actions);
}

function ensureStorefrontCloseButton(): void {
  if (document.getElementById(STOREFRONT_CLOSE_ID)) return;
  const close = document.createElement("button");
  close.id = STOREFRONT_CLOSE_ID;
  close.type = "button";
  close.textContent = "CLOSE PANEL";
  close.addEventListener("click", () => {
    activeStorefront?.modal?.destroy(true);
    if (activeStorefront) activeStorefront.modal = undefined;
    syncStorefrontControls();
  });
  document.body.appendChild(close);
}

function runStorefrontAction(action: string): void {
  const scene = activeStorefront;
  if (!scene?.scene.isActive()) return;

  switch (action) {
    case "start":
      scene.startShift(resolveStoredDay());
      return;
    case "contract":
      scene.showToast("CONTRACT");
      break;
    case "days":
      scene.openDaySelector();
      break;
    case "upgrades":
      scene.showToast("UPGRADES");
      break;
    case "store":
      scene.showToast("STORE");
      break;
    case "collection":
      scene.showToast("COLLECTION");
      break;
    case "settings":
      scene.showToast("SETTINGS");
      break;
    default:
      return;
  }

  window.setTimeout(syncStorefrontControls, 30);
}

function syncStorefrontControls(): void {
  const actions = document.getElementById(STOREFRONT_ACTIONS_ID);
  const close = document.getElementById(STOREFRONT_CLOSE_ID);
  const start = actions?.querySelector<HTMLButtonElement>('[data-action="start"]');
  const day = resolveStoredDay();
  const dayNumber = Number(day.slice(-2));
  if (start) start.textContent = `START DAY ${dayNumber}`;
  if (close) close.dataset.visible = activeStorefront?.modal?.active ? "true" : "false";
}

function throttledGameplaySync(scene: RuntimeGame): void {
  const now = performance.now();
  if (now - lastDomSyncAt < 120) return;
  lastDomSyncAt = now;
  syncGameplayHud(scene);
}

function throttledPromotionSync(scene: RuntimeWing): void {
  const now = performance.now();
  if (now - lastDomSyncAt < 120) return;
  lastDomSyncAt = now;
  syncPromotionHud(scene);
}

function syncGameplayHud(scene: RuntimeGame): void {
  const hud = document.getElementById(GAME_HUD_ID);
  const task = document.getElementById(GAME_TASK_ID);
  if (!hud || !task) return;

  const level = LEVELS[gameSession.day];
  const dayNumber = Number(gameSession.day.slice(-2));
  setRoleText(hud, "day", `DAY ${dayNumber}`);
  setRoleText(hud, "phase", scene.phase);
  setRoleText(hud, "stock", `STOCK ${scene.stocked}/${scene.shelfSlots.length}`);
  setRoleText(hud, "sales", `SALES ${scene.soldCount}/${level.salesTargets.rushToClosing}`);
  setRoleText(hud, "coins", `COINS ${scene.money}`);
  setRoleText(hud, "time", formatTime(scene.remainingSeconds));
  setRoleText(task, "task", cleanTask(scene.taskText?.text || level.title));
  setRoleText(task, "instruction", scene.hintText?.text || level.objective);
}

function syncPromotionHud(scene: RuntimeWing): void {
  const game = scene.gameScene ?? activeGame;
  if (!game) return;
  syncGameplayHud(game);

  const task = document.getElementById(GAME_TASK_ID);
  const hud = document.getElementById(GAME_HUD_ID);
  if (!task || !hud) return;
  const queue = scene.__promoQueue?.length ?? 0;
  const promoStock = scene.slots?.filter((slot) => Boolean(slot.product)).length ?? 0;
  setRoleText(hud, "phase", "PROMOTION ROOM");
  setRoleText(hud, "stock", `PROMO STOCK ${promoStock}/6`);
  setRoleText(hud, "sales", `QUEUE ${queue}/2`);
  setRoleText(task, "task", cleanTask(scene.objectiveText?.text || "PROMOTION DUTY"));
}

function cleanTask(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 96);
}

function setRoleText(root: HTMLElement, role: string, value: string): void {
  const element = root.querySelector<HTMLElement>(`[data-role="${role}"]`);
  if (element && element.textContent !== value) element.textContent = value;
}

function formatTime(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function resolveStoredDay(): Extract<LevelId, "day01" | "day02" | "day03"> {
  try {
    const stored = globalThis.localStorage?.getItem("supermarket.activeDay");
    if (stored === "day03") return "day03";
    if (stored === "day02") return "day02";
    return "day01";
  } catch {
    if (gameSession.day === "day03") return "day03";
    return gameSession.day === "day02" ? "day02" : "day01";
  }
}

function setSceneMode(mode: "storefront" | "opening" | "game" | "promotion"): void {
  document.body.dataset.gameScene = mode;
  if (mode !== "storefront") {
    const close = document.getElementById(STOREFRONT_CLOSE_ID);
    if (close) close.dataset.visible = "false";
  }
}
