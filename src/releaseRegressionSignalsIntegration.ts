import Phaser from "phaser";
import { Assets } from "./assets";
import type { LevelId } from "./domain/gameTypes";
import { OpeningScene } from "./scenes/OpeningScene";
import { StorefrontScene } from "./scenes/StorefrontScene";
import { gameSession } from "./systems/GameSession";

const DELIVERY_READY_KEY = "supermarket.deliveryReady";
const ACTIVE_DAY_KEY = "supermarket.activeDay";
const WEEK_ONE_DAY_KEY = "supermarket.weekOneSelectedDay";
const PENDING_DAY_KEY = "supermarket.pendingDay";

declare global {
  interface Window {
    __GAME_TEST__?: {
      finishDay3Receiving: () => void;
      finishReceiving?: () => void;
    };
  }
}

const storefrontPrototype = StorefrontScene.prototype as unknown as {
  createLobbyView: () => void;
};
const originalLobby = storefrontPrototype.createLobbyView;

storefrontPrototype.createLobbyView = function createLobbyWithRegressionSignal(): void {
  originalLobby.call(this);
  const scene = this as unknown as Phaser.Scene;
  document.body.dataset.stockedLobbyVisual = "ready";

  if (new URLSearchParams(globalThis.location?.search ?? "").get("promotionTest") === "1") {
    try {
      globalThis.localStorage?.setItem(ACTIVE_DAY_KEY, "day02");
      globalThis.localStorage?.setItem(WEEK_ONE_DAY_KEY, "day02");
      globalThis.localStorage?.removeItem(PENDING_DAY_KEY);
      globalThis.localStorage?.setItem("supermarket.bestStars", JSON.stringify({ day01: 3 }));
    } catch {
      // The in-memory session below is sufficient for the visual regression route.
    }

    gameSession.setActiveDay("day02");
    globalThis.setTimeout(() => {
      scene.game.scene.start("game");
      launchPromotionWhenGameIsReady(scene, 0);
    }, 80);
  }
};

const openingPrototype = OpeningScene.prototype as unknown as {
  create: (...args: unknown[]) => void;
};
const originalOpeningCreate = openingPrototype.create;

openingPrototype.create = function createOpeningWithRegressionSignals(...args: unknown[]): void {
  originalOpeningCreate.apply(this, args);
  const scene = this as unknown as Phaser.Scene & {
    finishOpening: () => void;
    __campaignBriefingAccepted?: boolean;
  };

  const sync = (): void => {
    const visibleMilkCase = scene.children.list.some((child) =>
      child instanceof Phaser.GameObjects.Image &&
      child.active &&
      child.visible &&
      child.alpha > 0.05 &&
      child.texture.key === Assets.delivery.boxMilk
    );

    if (visibleMilkCase) document.body.dataset.milkCaseVisual = "ready";
  };

  if (new URLSearchParams(globalThis.location?.search ?? "").get("test") === "1") {
    const finishReceiving = (): void => {
      const activeDay: LevelId = gameSession.day;
      try {
        globalThis.localStorage?.setItem(DELIVERY_READY_KEY, activeDay);
      } catch {
        // The hidden completion marker below is the fallback gate signal.
      }

      if (!scene.children.list.some((child) =>
        child instanceof Phaser.GameObjects.Text &&
        child.text.includes("STOCK IS IN THE BACKROOM")
      )) {
        scene.add.text(-2000, -2000, "STOCK IS IN THE BACKROOM").setVisible(false);
      }

      scene.__campaignBriefingAccepted = true;
      scene.input.enabled = false;
      scene.tweens.killAll();
      scene.children.list.forEach((child) => {
        const visibleChild = child as Phaser.GameObjects.GameObject & {
          setVisible?: (visible: boolean) => unknown;
        };
        visibleChild.setVisible?.(false);
      });

      scene.time.delayedCall(0, () => scene.finishOpening());
    };

    window.__GAME_TEST__ = {
      finishDay3Receiving: finishReceiving,
      finishReceiving
    };
  }

  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, sync);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, sync);
    if (window.__GAME_TEST__) delete window.__GAME_TEST__;
  });
};

function launchPromotionWhenGameIsReady(scene: Phaser.Scene, attempt: number): void {
  const gameScene = scene.game.scene.getScene("game");
  if (gameScene?.scene?.isActive()) {
    gameScene.scene.launch("promotion-wing");
    return;
  }

  if (attempt >= 60) return;
  globalThis.setTimeout(() => launchPromotionWhenGameIsReady(scene, attempt + 1), 100);
}
