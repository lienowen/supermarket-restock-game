import Phaser from "phaser";
import type { RestockSceneSnapshot } from "../../application/RestockSceneController";
import type { VisualPoint } from "../visual/StarterMarketVisualSpec";
import { RestockActorView } from "./RestockActorView";
import { RestockCoolerProductSprite } from "./RestockCoolerProductSprite";

const PROMOTION_LEVEL_ID = "starter-level-002";
const WATER_BOTTLE_SOURCE_KEY = "restock-water-bottle-hd-v2";
const WATER_BOTTLE_SOURCE_PATH = "assets/game/production-v2/products/product-water-bottle.png";
const WATER_BOTTLE_SIZE = Object.freeze({ width: 42, height: 96 });
const WATER_BOTTLE_NAMES = Object.freeze([
  "restock-level-two-water-a",
  "restock-level-two-water-b",
  "restock-level-two-water-c"
]);

interface RestockActorInternals {
  readonly scene: Phaser.Scene;
  readonly config: {
    readonly cartDestination: VisualPoint;
  };
  readonly caseBox: Phaser.GameObjects.Image;
  readonly handProduct: Phaser.GameObjects.Image;
  readonly currentSnapshot?: RestockSceneSnapshot;
}

const isPromotionLevel = (): boolean => (
  document.body.dataset.activeLevel === PROMOTION_LEVEL_ID
);

/**
 * Level 2 keeps only product-specific art here. Movement, proximity and action
 * sequencing remain owned by RestockActorView and StarterMarketScene so the
 * memory challenge runs on top of the same real carry/push/open chain as L1.
 */
const originalSync = RestockActorView.prototype.sync;
RestockActorView.prototype.sync = function syncLevelTwoWaterVisual(
  this: RestockActorView,
  snapshot: RestockSceneSnapshot
): void {
  originalSync.call(this, snapshot);
  if (!isPromotionLevel()) return;

  const view = this as unknown as RestockActorInternals;
  view.handProduct.setTexture(WATER_BOTTLE_SOURCE_KEY);
  syncPromotionCartWater(view, snapshot);
  document.body.dataset.levelTwoActorControl = "routed-memory-restock";
  document.body.dataset.levelTwoProductVisual = "water-bottle-only";
};

const originalUpdate = RestockActorView.prototype.update;
RestockActorView.prototype.update = function updateLevelTwoWaterVisual(
  this: RestockActorView,
  deltaMs: number
): void {
  originalUpdate.call(this, deltaMs);
  if (!isPromotionLevel()) return;

  const view = this as unknown as RestockActorInternals;
  view.handProduct.setTexture(WATER_BOTTLE_SOURCE_KEY);
  const snapshot = view.currentSnapshot;
  if (snapshot) syncPromotionCartWater(view, snapshot);
};

const originalCreateStockBottle = RestockCoolerProductSprite.prototype.createStockBottle;
RestockCoolerProductSprite.prototype.createStockBottle = function createLevelTwoWaterStock(
  this: RestockCoolerProductSprite,
  position: VisualPoint
): Phaser.GameObjects.Image {
  if (!isPromotionLevel()) return originalCreateStockBottle.call(this, position);
  return this.scene.add.image(position.x, position.y, WATER_BOTTLE_SOURCE_KEY)
    .setOrigin(0.5, 0.96)
    .setDisplaySize(30, 70)
    .setDepth(31);
};

function syncPromotionCartWater(
  view: RestockActorInternals,
  snapshot: RestockSceneSnapshot
): void {
  const show = snapshot.step === "restock";
  const x = view.config.cartDestination.x;
  const y = view.config.cartDestination.y - 86;

  WATER_BOTTLE_NAMES.forEach((name, index) => {
    const bottle = getOrCreateWaterBottle(view.scene, name);
    bottle
      .setPosition(x + (index - 1) * 50, y + Math.abs(index - 1) * 4)
      .setDisplaySize(WATER_BOTTLE_SIZE.width, WATER_BOTTLE_SIZE.height)
      .setVisible(show)
      .setDepth(25.2 + index * 0.02);
  });

  if (show) view.caseBox.setVisible(false);
}

function getOrCreateWaterBottle(
  scene: Phaser.Scene,
  name: string
): Phaser.GameObjects.Image {
  const existing = scene.children.getByName(name);
  if (existing instanceof Phaser.GameObjects.Image) return existing;
  return scene.add.image(0, 0, WATER_BOTTLE_SOURCE_KEY)
    .setOrigin(0.5, 0.96)
    .setVisible(false)
    .setName(name);
}

export function preloadLevelTwoWaterBottle(scene: Phaser.Scene): void {
  if (!scene.textures.exists(WATER_BOTTLE_SOURCE_KEY)) {
    scene.load.image(WATER_BOTTLE_SOURCE_KEY, WATER_BOTTLE_SOURCE_PATH);
  }
}
