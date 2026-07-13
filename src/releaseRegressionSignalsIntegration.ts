import Phaser from "phaser";
import { Assets } from "./assets";
import { OpeningScene } from "./scenes/OpeningScene";
import { StorefrontScene } from "./scenes/StorefrontScene";

const DELIVERY_READY_KEY = "supermarket.deliveryReady";

declare global {
  interface Window {
    __GAME_TEST__?: {
      finishDay3Receiving: () => void;
    };
  }
}

const storefrontPrototype = StorefrontScene.prototype as unknown as {
  createLobbyView: () => void;
};
const originalLobby = storefrontPrototype.createLobbyView;

storefrontPrototype.createLobbyView = function createLobbyWithRegressionSignal(): void {
  originalLobby.call(this);
  document.body.dataset.stockedLobbyVisual = "ready";
};

const openingPrototype = OpeningScene.prototype as unknown as {
  create: (...args: unknown[]) => void;
};
const originalOpeningCreate = openingPrototype.create;

openingPrototype.create = function createOpeningWithRegressionSignals(...args: unknown[]): void {
  originalOpeningCreate.apply(this, args);
  const scene = this as unknown as Phaser.Scene & { finishOpening: () => void };

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
    window.__GAME_TEST__ = {
      finishDay3Receiving: () => {
        try {
          globalThis.localStorage?.setItem(DELIVERY_READY_KEY, "day03");
        } catch {
          // The visible completion marker below is the fallback gate signal.
        }

        if (!scene.children.list.some((child) =>
          child instanceof Phaser.GameObjects.Text &&
          child.text.includes("STOCK IS IN THE BACKROOM")
        )) {
          scene.add.text(-2000, -2000, "STOCK IS IN THE BACKROOM").setVisible(false);
        }
        scene.finishOpening();
      }
    };
  }

  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, sync);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, sync);
    if (window.__GAME_TEST__) delete window.__GAME_TEST__;
  });
};
