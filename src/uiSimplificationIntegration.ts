import Phaser from "phaser";
import { DayTwoRoomNavigationScene } from "./scenes/DayTwoRoomNavigationScene";
import { GameScene } from "./scenes/GameScene";
import { PolishOverlayScene } from "./scenes/PolishOverlayScene";
import { gameSession } from "./systems/GameSession";

type RuntimeGameScene = Phaser.Scene & {
  __contractPanel?: Phaser.GameObjects.Container;
  __campaignDutyStrip?: Phaser.GameObjects.Container;
  __day2DealBoard?: Phaser.GameObjects.Container;
  __uiSimplificationMonitor?: () => void;
};

type RuntimeNavigationScene = Phaser.Scene & {
  gameScene?: Phaser.Scene & {
    showPhaseBanner: (message: string) => void;
    showTransientHint: (message: string) => void;
  };
};

type CreatePrototype = {
  create: (...args: unknown[]) => void;
};

type UpdatePrototype = {
  update: (...args: unknown[]) => void;
};

type NavigationPrototype = {
  showUnlockAndEnter: () => void;
};

const DUPLICATE_ENTRY_LABELS = [
  "OPEN PROMOTION WING",
  "FRESH PICKS"
] as const;

installSingleGameplayStatusSurface();
installDayOneOnlyTutorialOverlay();
installSingleDayTwoRoomEntry();

function installSingleGameplayStatusSurface(): void {
  const prototype = GameScene.prototype as unknown as CreatePrototype;
  const originalCreate = prototype.create;

  prototype.create = function createWithSimplifiedUi(...args: unknown[]): void {
    originalCreate.apply(this, args);
    const scene = this as unknown as RuntimeGameScene;
    let lastCheck = -Infinity;

    const monitor = (): void => {
      if (scene.time.now - lastCheck < 180) return;
      lastCheck = scene.time.now;

      // The normal HUD task line is the single persistent duty surface.
      // Contracts remain active for scoring, but their extra in-game card is hidden.
      hideContainer(scene.__campaignDutyStrip);
      hideContainer(scene.__contractPanel);

      // Day 2 keeps the timed flash-sale card, but removes the second persistent
      // deal board because it repeats the same objective and stock state.
      hideContainer(scene.__day2DealBoard);

      if (gameSession.day === "day02") hideLegacyPromotionEntries(scene);
      document.body.dataset.uiSimplification = "ready";
    };

    scene.__uiSimplificationMonitor = monitor;
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, monitor);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, monitor);
      scene.__uiSimplificationMonitor = undefined;
      delete document.body.dataset.uiSimplification;
    });

    monitor();
  };
}

function installDayOneOnlyTutorialOverlay(): void {
  const prototype = PolishOverlayScene.prototype as unknown as UpdatePrototype;
  const originalUpdate = prototype.update;

  prototype.update = function updateOnlyForFirstDay(...args: unknown[]): void {
    const scene = this as unknown as Phaser.Scene;
    const enabled = gameSession.day === "day01";
    scene.scene.setVisible(enabled);
    scene.input.enabled = enabled;
    if (!enabled) return;
    originalUpdate.apply(this, args);
  };
}

function installSingleDayTwoRoomEntry(): void {
  const prototype = DayTwoRoomNavigationScene.prototype as unknown as NavigationPrototype;

  // The top ROOM 1/2 | ROOM 2/2 navigation is the only permanent room entry.
  // Do not open another full-screen unlock card or force the player into Room 2.
  prototype.showUnlockAndEnter = function showCompactRoomUnlock(): void {
    const scene = this as unknown as RuntimeNavigationScene;
    const game = scene.gameScene;
    if (!game?.scene?.isActive()) return;

    game.showPhaseBanner("PROMOTION WING AVAILABLE");
    game.showTransientHint("Use ROOM 2/2 at the top when you are ready to manage the promotion floor.");
  };
}

function hideLegacyPromotionEntries(scene: RuntimeGameScene): void {
  for (const child of scene.children.list) {
    if (!(child instanceof Phaser.GameObjects.Text)) continue;
    const value = child.text.toUpperCase();
    if (!DUPLICATE_ENTRY_LABELS.some((label) => value.includes(label))) continue;

    const parent = child.parentContainer;
    if (parent && parent.list.length <= 20) {
      hideContainer(parent);
    } else {
      child.setVisible(false).disableInteractive();
    }
  }
}

function hideContainer(container?: Phaser.GameObjects.Container): void {
  if (!container?.active) return;
  container.setVisible(false);

  for (const child of container.getAll()) {
    if (child instanceof Phaser.GameObjects.GameObject) child.disableInteractive();
  }
}
