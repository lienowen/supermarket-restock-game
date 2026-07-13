import Phaser from "phaser";
import { Assets } from "./assets";
import { OpeningScene } from "./scenes/OpeningScene";
import { StorefrontScene } from "./scenes/StorefrontScene";

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
  const scene = this as unknown as Phaser.Scene;

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

  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, sync);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, sync);
  });
};
