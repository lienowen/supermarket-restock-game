import Phaser from "phaser";
import type { FindItemsStarterMarketPresentationContext } from "../context/StarterMarketPresentationContext";
import { resolveLevelVisualPreset } from "../visual/LevelVisualPresetResolver";
import type { FindItemsLevelVisualPreset } from "../visual/MarketLevelVisualPreset";
import { createOpaqueCutoutTexture } from "../visual/OpaqueCutoutTexture";
import { createTrimmedTexture, fitImageIntoBox } from "../visual/TrimmedTexture";
import { UtilityTaskScene } from "./UtilityTaskScene";
import type { SceneCampaignSessionContext } from "./StarterMarketScene";

const GOLDEN_EXTRA_PRODUCT_KEYS = Object.freeze([
  "product-banana-bunch",
  "product-grapes-pack",
  "product-peanut-butter"
]);

const GOLDEN_ZONE_LAYOUT = Object.freeze({
  breakfastFixture: Object.freeze({ x: 700, y: 690, maxWidth: 430, maxHeight: 270 }),
  produceFixture: Object.freeze({ x: 1220, y: 742, maxWidth: 320, maxHeight: 205 }),
  basket: Object.freeze({ x: 865, y: 815, maxWidth: 118, maxHeight: 72 }),
  worker: Object.freeze({ maxWidth: 185, maxHeight: 300 })
});

const GOLDEN_PRODUCT_LAYOUT = Object.freeze([
  Object.freeze({
    sourceName: "find-item-milk-bottle",
    name: "find-item-milk-bottle",
    assetKey: "product-milk-bottle",
    x: 940,
    y: 570,
    maxWidth: 52,
    maxHeight: 88,
    requested: true
  }),
  Object.freeze({
    sourceName: "find-decoy-decoy-yogurt",
    name: "find-decoy-yogurt",
    assetKey: "product-yogurt-cup",
    x: 1020,
    y: 575,
    maxWidth: 54,
    maxHeight: 62,
    requested: false
  }),
  Object.freeze({
    sourceName: "find-item-cereal-box",
    name: "find-item-cereal-box",
    assetKey: "product-cereal-box",
    x: 720,
    y: 610,
    maxWidth: 68,
    maxHeight: 92,
    requested: true
  }),
  Object.freeze({
    sourceName: "find-decoy-decoy-oats",
    name: "find-decoy-oats",
    assetKey: "product-oats-canister",
    x: 625,
    y: 610,
    maxWidth: 64,
    maxHeight: 88,
    requested: false
  }),
  Object.freeze({
    sourceName: "find-decoy-decoy-paper-towels",
    name: "find-decoy-peanut-butter",
    assetKey: "product-peanut-butter",
    x: 810,
    y: 612,
    maxWidth: 58,
    maxHeight: 82,
    requested: false
  }),
  Object.freeze({
    sourceName: "find-item-apple",
    name: "find-item-apple",
    assetKey: "product-apple",
    x: 1220,
    y: 675,
    maxWidth: 62,
    maxHeight: 62,
    requested: true
  }),
  Object.freeze({
    sourceName: "find-decoy-decoy-chips",
    name: "find-decoy-banana",
    assetKey: "product-banana-bunch",
    x: 1135,
    y: 681,
    maxWidth: 82,
    maxHeight: 62,
    requested: false
  }),
  Object.freeze({
    sourceName: "find-decoy-decoy-detergent",
    name: "find-decoy-grapes",
    assetKey: "product-grapes-pack",
    x: 1300,
    y: 681,
    maxWidth: 72,
    maxHeight: 60,
    requested: false
  })
]);

/**
 * Level 5 is the mature-pass golden level. Gameplay stays on the proven
 * UtilityTaskScene controller while this layer owns the production presentation
 * we want to propagate to the rest of the campaign after visual approval.
 */
export class GoldenOrderHuntScene extends UtilityTaskScene {
  private readonly goldenVisual: FindItemsLevelVisualPreset;

  constructor(
    private readonly goldenContext: FindItemsStarterMarketPresentationContext,
    campaignSession?: SceneCampaignSessionContext
  ) {
    super(goldenContext, campaignSession);
    this.goldenVisual = resolveLevelVisualPreset(
      goldenContext.campaignLevel.level
    ) as FindItemsLevelVisualPreset;
  }

  override preload(): void {
    super.preload();
    GOLDEN_EXTRA_PRODUCT_KEYS.forEach((assetKey) => {
      const asset = this.goldenContext.assets.require(assetKey);
      if (!this.textures.exists(asset.key)) this.load.image(asset.key, asset.path);
    });
  }

  override create(): void {
    super.create();
    document.body.dataset.goldenLevel = "level-5-mature-pass-v1";
    document.body.dataset.goldenEnvironment = this.goldenContext.levelAssets.environment.key;
    document.body.dataset.goldenWorldScale = "trimmed-v2";
    this.createStoreFixtures();
    this.reframeProducts();
    this.reframeBasket();
    this.normalizeWorkerTexture();
  }

  override update(time: number, delta: number): void {
    super.update(time, delta);
    this.normalizeWorkerTexture();
  }

  private createStoreFixtures(): void {
    const breakfastTexture = createTrimmedTexture(
      this,
      this.goldenContext.levelAssets.fixture.key,
      { suffix: "--golden-trimmed", padding: 2 }
    );
    const breakfast = this.add.image(
      GOLDEN_ZONE_LAYOUT.breakfastFixture.x,
      GOLDEN_ZONE_LAYOUT.breakfastFixture.y,
      breakfastTexture
    )
      .setOrigin(0.5, 0.98)
      .setDepth(10)
      .setName("golden-order-breakfast-fixture");
    fitImageIntoBox(
      breakfast,
      GOLDEN_ZONE_LAYOUT.breakfastFixture.maxWidth,
      GOLDEN_ZONE_LAYOUT.breakfastFixture.maxHeight
    );

    const produceAssetKey = this.goldenVisual.auxiliaryFixtures[0]?.assetKey;
    if (!produceAssetKey) throw new Error("Golden Level 5 requires a produce fixture");
    this.goldenContext.assets.require(produceAssetKey);
    const produceTexture = createTrimmedTexture(
      this,
      produceAssetKey,
      { suffix: "--golden-trimmed", padding: 2 }
    );
    const produce = this.add.image(
      GOLDEN_ZONE_LAYOUT.produceFixture.x,
      GOLDEN_ZONE_LAYOUT.produceFixture.y,
      produceTexture
    )
      .setOrigin(0.5, 0.98)
      .setDepth(10)
      .setName("golden-order-produce-fixture");
    fitImageIntoBox(
      produce,
      GOLDEN_ZONE_LAYOUT.produceFixture.maxWidth,
      GOLDEN_ZONE_LAYOUT.produceFixture.maxHeight
    );
  }

  private reframeProducts(): void {
    GOLDEN_PRODUCT_LAYOUT.forEach((layout) => {
      const object = this.children.getByName(layout.sourceName);
      if (!(object instanceof Phaser.GameObjects.Image)) return;
      const trimmedTexture = createTrimmedTexture(
        this,
        layout.assetKey,
        { suffix: "--golden-trimmed", padding: 1 }
      );
      object
        .setName(layout.name)
        .setTexture(trimmedTexture)
        .setPosition(layout.x, layout.y)
        .setOrigin(0.5, 0.96)
        .setDepth(12 + layout.y / 1000)
        .setData("requested", layout.requested);
      fitImageIntoBox(object, layout.maxWidth, layout.maxHeight);
      object.setInteractive({ useHandCursor: true });
    });
  }

  private reframeBasket(): void {
    const basket = this.children.getByName("order-basket");
    if (!(basket instanceof Phaser.GameObjects.Image)) return;
    const trimmedTexture = createTrimmedTexture(
      this,
      basket.texture.key,
      { suffix: "--golden-trimmed", padding: 2 }
    );
    basket
      .setTexture(trimmedTexture)
      .setPosition(GOLDEN_ZONE_LAYOUT.basket.x, GOLDEN_ZONE_LAYOUT.basket.y)
      .setOrigin(0.5, 0.98)
      .setDepth(20);
    fitImageIntoBox(
      basket,
      GOLDEN_ZONE_LAYOUT.basket.maxWidth,
      GOLDEN_ZONE_LAYOUT.basket.maxHeight
    );
  }

  private normalizeWorkerTexture(): void {
    const actor = this.children.getByName("find-items-worker");
    if (!(actor instanceof Phaser.GameObjects.Image)) return;

    const currentKey = actor.texture.key;
    if (!currentKey.endsWith("--opaque-cutout")) {
      actor.setTexture(createOpaqueCutoutTexture(this, currentKey));
    }
    actor
      .setAlpha(1)
      .setOrigin(0.5, 0.98)
      .setBlendMode(Phaser.BlendModes.NORMAL);
    fitImageIntoBox(
      actor,
      GOLDEN_ZONE_LAYOUT.worker.maxWidth,
      GOLDEN_ZONE_LAYOUT.worker.maxHeight
    );
  }
}
