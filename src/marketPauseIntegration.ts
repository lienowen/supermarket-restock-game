import Phaser from "phaser";
import "./marketPause.css";
import { GameScene } from "./scenes/GameScene";
import { gameSession } from "./systems/GameSession";

const PAUSE_BUTTON_ID = "market-pause-button";
const PAUSE_OVERLAY_ID = "market-pause-overlay";

type SceneRuntimeState = {
  scene: Phaser.Scene;
  timePaused: boolean;
  inputEnabled: boolean;
};

type RuntimeGame = Phaser.Scene & {
  shiftEnded: boolean;
};

type GamePrototype = {
  create: (...args: unknown[]) => void;
  togglePauseOverlay: () => void;
};

let activeGame: RuntimeGame | undefined;
let pausedStates: SceneRuntimeState[] = [];
let pausing = false;

installPauseDom();
installGamePauseBridge();
installLifecyclePause();

function installPauseDom(): void {
  if (!document.getElementById(PAUSE_BUTTON_ID)) {
    const button = document.createElement("button");
    button.id = PAUSE_BUTTON_ID;
    button.type = "button";
    button.textContent = "PAUSE";
    button.setAttribute("aria-label", "Pause shift");
    button.addEventListener("click", () => openPause("Manual pause"));
    document.body.appendChild(button);
  }

  if (document.getElementById(PAUSE_OVERLAY_ID)) return;
  const overlay = document.createElement("div");
  overlay.id = PAUSE_OVERLAY_ID;
  overlay.innerHTML = [
    '<section class="market-pause-card" role="dialog" aria-modal="true" aria-label="Shift paused">',
    "<small>FRESH MART · SHIFT CONTROL</small>",
    "<strong>PAUSED</strong>",
    '<span data-role="reason">Your shift is safely paused. Customers and timers are stopped.</span>',
    '<div class="market-pause-actions">',
    '<button type="button" class="primary" data-action="resume">RESUME SHIFT</button>',
    '<button type="button" data-action="restart">RESTART SHIFT</button>',
    '<button type="button" class="danger" data-action="exit">EXIT TO STORE</button>',
    "</div>",
    "</section>"
  ].join("");

  overlay.querySelector<HTMLButtonElement>('[data-action="resume"]')
    ?.addEventListener("click", resumeShift);
  overlay.querySelector<HTMLButtonElement>('[data-action="restart"]')
    ?.addEventListener("click", restartShift);
  overlay.querySelector<HTMLButtonElement>('[data-action="exit"]')
    ?.addEventListener("click", exitToStorefront);
  document.body.appendChild(overlay);
}

function installGamePauseBridge(): void {
  const prototype = GameScene.prototype as unknown as GamePrototype;
  const originalCreate = prototype.create;

  prototype.create = function createWithMarketPause(...args: unknown[]): void {
    originalCreate.apply(this, args);
    const scene = this as unknown as RuntimeGame;
    activeGame = scene;
    clearPauseMarker();

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (document.body.dataset.marketPaused === "true") resumeAllScenes();
      clearPauseMarker();
      if (activeGame === scene) activeGame = undefined;
    });
  };

  prototype.togglePauseOverlay = function toggleUnifiedPause(): void {
    if (document.body.dataset.marketPaused === "true") {
      resumeShift();
      return;
    }
    openPause("Manual pause");
  };
}

function installLifecyclePause(): void {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") openPause("Paused because the game moved to the background");
  });
  window.addEventListener("pagehide", () => {
    openPause("Paused because the game moved to the background");
  });
}

function openPause(reason: string): void {
  const scene = activeGame;
  if (pausing || !scene?.scene.isActive() || scene.shiftEnded) return;
  if (document.body.dataset.gameScene !== "game" && document.body.dataset.gameScene !== "promotion") return;
  if (document.body.dataset.marketPaused === "true") return;

  pausing = true;
  pausedStates = scene.game.scene.getScenes(true).map((activeScene) => ({
    scene: activeScene,
    timePaused: activeScene.time.paused,
    inputEnabled: activeScene.input.enabled
  }));

  pausedStates.forEach(({ scene: activeScene }) => {
    activeScene.time.paused = true;
    activeScene.tweens.pauseAll();
    activeScene.input.enabled = false;
  });
  gameSession.setPaused(true);
  document.body.dataset.marketPaused = "true";
  const reasonElement = document.querySelector<HTMLElement>(`#${PAUSE_OVERLAY_ID} [data-role="reason"]`);
  if (reasonElement) reasonElement.textContent = `${reason}. Customers and timers are stopped.`;
  pausing = false;
}

function resumeShift(): void {
  if (document.body.dataset.marketPaused !== "true") return;
  resumeAllScenes();
  clearPauseMarker();
}

function resumeAllScenes(): void {
  pausedStates.forEach(({ scene, timePaused, inputEnabled }) => {
    if (!scene.scene.isActive()) return;
    scene.time.paused = timePaused;
    if (!timePaused) scene.tweens.resumeAll();
    scene.input.enabled = inputEnabled;
  });
  pausedStates = [];
}

function clearPauseMarker(): void {
  document.body.dataset.marketPaused = "false";
  gameSession.setPaused(false);
  pausing = false;
}

function restartShift(): void {
  const scene = activeGame;
  if (!scene?.scene.isActive()) return;
  resumeShift();
  stopAuxiliaryScenes(scene);
  scene.scene.restart();
}

function exitToStorefront(): void {
  const scene = activeGame;
  if (!scene?.scene.isActive()) return;
  resumeShift();
  stopAuxiliaryScenes(scene);
  document.body.dataset.gameScene = "storefront";
  scene.scene.start("storefront", { showResult: false });
}

function stopAuxiliaryScenes(scene: Phaser.Scene): void {
  [
    "promotion-wing",
    "day2-room-nav",
    "back-stock",
    "polish-overlay",
    "progression-customer"
  ].forEach((key) => {
    if (scene.scene.isActive(key)) scene.scene.stop(key);
  });
}
