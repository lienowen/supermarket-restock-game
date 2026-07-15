import { GameScene } from "./scenes/GameScene";
import { gameSession } from "./systems/GameSession";
import { SupermarketSceneAssets } from "./supermarketSceneAssets";

type GamePrototype = {
  create: (...args: unknown[]) => void;
};

type StoryController = {
  view: "overview" | "drinks" | "stockroom" | "checkout";
  transitioning: boolean;
  background: Phaser.GameObjects.Image;
  locationText: Phaser.GameObjects.Text;
  actionText: Phaser.GameObjects.Text;
  overviewHotspot: { container: Phaser.GameObjects.Container };
  overviewButton: { container: Phaser.GameObjects.Container };
  stockroomButton: { container: Phaser.GameObjects.Container };
  returnButton: { container: Phaser.GameObjects.Container };
  closeButton: { container: Phaser.GameObjects.Container };
  restockHit: Phaser.GameObjects.Rectangle;
};

type RuntimeGame = Phaser.Scene & {
  __dayTwoStory?: StoryController;
  cart: Phaser.GameObjects.Container;
  worker: Phaser.GameObjects.Image;
  boxes: Array<{
    image: Phaser.GameObjects.Image;
    shadow: Phaser.GameObjects.Ellipse;
  }>;
};

const prototype = GameScene.prototype as unknown as GamePrototype;
const originalCreate = prototype.create;

prototype.create = function createDayTwoStoryBootstrap(...args: unknown[]): void {
  originalCreate.apply(this, args);
  const scene = this as unknown as RuntimeGame;
  if (gameSession.day !== "day02") return;

  const controller = scene.__dayTwoStory;
  if (!controller) return;

  controller.view = "overview";
  controller.transitioning = false;
  controller.background
    .setTexture(SupermarketSceneAssets.backgrounds.store.overview01)
    .setDisplaySize(1330, 960)
    .setAlpha(1);
  controller.locationText.setText("MAIN STORE");
  controller.actionText.setText("Walk to the drinks aisle before opening.");
  controller.overviewHotspot.container.setVisible(true);
  controller.overviewButton.container.setVisible(false);
  controller.stockroomButton.container.setVisible(false);
  controller.returnButton.container.setVisible(false);
  controller.closeButton.container.setVisible(false);
  controller.restockHit.setVisible(false).disableInteractive();

  scene.cart.setVisible(false);
  scene.worker.setVisible(false);
  scene.boxes.forEach((box) => {
    box.image.setVisible(false);
    box.shadow.setVisible(false);
    if (box.image.input) box.image.input.enabled = false;
  });
};
