import Phaser from "phaser";
import type { RestockSceneSnapshot } from "../../application/RestockSceneController";
import { IntegratedBeverageCoolerView } from "../fixtures/IntegratedBeverageCoolerView";
import type { VisualPoint } from "../visual/StarterMarketVisualSpec";
import { RestockActorView } from "./RestockActorView";

const PROMOTION_LEVEL_ID = "starter-level-002";
const WATER_BOTTLE_KEY = "product-water-bottle";
const NORMALIZED_WATER_BOTTLE_KEY = "level-two-water-bottle-normalized";
const WATER_BOTTLE_SIZE = Object.freeze({ width: 30, height: 70 });
const CART_WATER_BOTTLE_SIZE = Object.freeze({ width: 20, height: 54 });
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

interface CoolerInternals {
  readonly scene: Phaser.Scene;
}

interface CoolerPrototypeInternals {
  createStockBottle(
    this: IntegratedBeverageCoolerView,
    rowIndex: number,
    itemIndex: number,
    animate: boolean
  ): Phaser.GameObjects.Image;
}

const isPromotionLevel = (): boolean => (
  document.body.dataset.activeLevel === PROMOTION_LEVEL_ID
);

const ensureNormalizedWaterTexture = (scene: Phaser.Scene): string => {
  if (scene.textures.exists(NORMALIZED_WATER_BOTTLE_KEY)) return NORMALIZED_WATER_BOTTLE_KEY;
  if (!scene.textures.exists(WATER_BOTTLE_KEY)) return WATER_BOTTLE_KEY;

  const source = scene.textures.get(WATER_BOTTLE_KEY).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const width = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
  const height = source instanceof HTMLImageElement ? source.naturalHeight : source.height;
  if (!width || !height) return WATER_BOTTLE_KEY;

  const scratch = document.createElement("canvas");
  scratch.width = width;
  scratch.height = height;
  const scratchContext = scratch.getContext("2d", { willReadFrequently: true });
  if (!scratchContext) return WATER_BOTTLE_KEY;
  scratchContext.drawImage(source, 0, 0, width, height);

  const pixels = scratchContext.getImageData(0, 0, width, height).data;
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = pixels[(y * width + x) * 4 + 3] ?? 0;
      if (alpha <= 8) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < left || bottom < top) return WATER_BOTTLE_KEY;

  const cropWidth = right - left + 1;
  const cropHeight = bottom - top + 1;
  const texture = scene.textures.createCanvas(
    NORMALIZED_WATER_BOTTLE_KEY,
    WATER_BOTTLE_SIZE.width,
    WATER_BOTTLE_SIZE.height
  );
  if (!texture) return WATER_BOTTLE_KEY;

  const context = texture.context;
  context.clearRect(0, 0, WATER_BOTTLE_SIZE.width, WATER_BOTTLE_SIZE.height);
  const scale = Math.min(
    WATER_BOTTLE_SIZE.width / cropWidth,
    WATER_BOTTLE_SIZE.height / cropHeight
  );
  const drawWidth = cropWidth * scale;
  const drawHeight = cropHeight * scale;
  context.drawImage(
    source,
    left,
    top,
    cropWidth,
    cropHeight,
    (WATER_BOTTLE_SIZE.width - drawWidth) / 2,
    WATER_BOTTLE_SIZE.height - drawHeight,
    drawWidth,
    drawHeight
  );
  texture.refresh();
  return NORMALIZED_WATER_BOTTLE_KEY;
};

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
  const waterTexture = ensureNormalizedWaterTexture(view.scene);
  if (view.scene.textures.exists(waterTexture)) {
    view.handProduct
      .setTexture(waterTexture)
      .setDisplaySize(CART_WATER_BOTTLE_SIZE.width, CART_WATER_BOTTLE_SIZE.height);
  }
  syncPromotionCartWater(view, snapshot);
  document.body.dataset.levelTwoActorControl = "routed-memory-restock";
  document.body.dataset.levelTwoProductVisual = "normalized-water-bottle-only";
};

const originalUpdate = RestockActorView.prototype.update;
RestockActorView.prototype.update = function updateLevelTwoWaterVisual(
  this: RestockActorView,
  deltaMs: number
): void {
  originalUpdate.call(this, deltaMs);
  if (!isPromotionLevel()) return;

  const view = this as unknown as RestockActorInternals;
  const waterTexture = ensureNormalizedWaterTexture(view.scene);
  if (view.scene.textures.exists(waterTexture)) {
    view.handProduct
      .setTexture(waterTexture)
      .setDisplaySize(CART_WATER_BOTTLE_SIZE.width, CART_WATER_BOTTLE_SIZE.height);
  }
  const snapshot = view.currentSnapshot;
  if (snapshot) syncPromotionCartWater(view, snapshot);
};

const coolerPrototype = IntegratedBeverageCoolerView.prototype as unknown as CoolerPrototypeInternals;
const originalCreateStockBottle = coolerPrototype.createStockBottle;
coolerPrototype.createStockBottle = function createLevelTwoWaterStock(
  this: IntegratedBeverageCoolerView,
  rowIndex: number,
  itemIndex: number,
  animate: boolean
): Phaser.GameObjects.Image {
  const bottle = originalCreateStockBottle.call(this, rowIndex, itemIndex, animate);
  const view = this as unknown as CoolerInternals;
  if (!isPromotionLevel()) return bottle;
  const waterTexture = ensureNormalizedWaterTexture(view.scene);
  if (!view.scene.textures.exists(waterTexture)) return bottle;

  // Important: the shared restock animation tweens scale back to 1. The texture
  // itself therefore has to be normalized to shelf size, otherwise the original
  // production PNG dimensions reappear at the end of the tween.
  bottle
    .setTexture(waterTexture)
    .setDisplaySize(WATER_BOTTLE_SIZE.width, WATER_BOTTLE_SIZE.height);
  return bottle;
};

function syncPromotionCartWater(
  view: RestockActorInternals,
  snapshot: RestockSceneSnapshot
): void {
  const show = snapshot.step === "restock";
  const x = view.config.cartDestination.x;
  const y = view.config.cartDestination.y - 86;
  const waterTexture = ensureNormalizedWaterTexture(view.scene);

  WATER_BOTTLE_NAMES.forEach((name, index) => {
    const bottle = getOrCreateWaterBottle(view.scene, name, waterTexture);
    bottle
      .setTexture(waterTexture)
      .setPosition(x + (index - 1) * 34, y + Math.abs(index - 1) * 3)
      .setDisplaySize(CART_WATER_BOTTLE_SIZE.width, CART_WATER_BOTTLE_SIZE.height)
      .setVisible(show)
      .setDepth(25.2 + index * 0.02);
  });

  if (show) view.caseBox.setVisible(false);
}

function getOrCreateWaterBottle(
  scene: Phaser.Scene,
  name: string,
  textureKey: string
): Phaser.GameObjects.Image {
  const existing = scene.children.getByName(name);
  if (existing instanceof Phaser.GameObjects.Image) return existing;
  return scene.add.image(0, 0, textureKey)
    .setOrigin(0.5, 1)
    .setVisible(false)
    .setName(name);
}
