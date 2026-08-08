import Phaser from "phaser";
import type { FindItemsStarterMarketPresentationContext } from "../context/StarterMarketPresentationContext";
import { resolveLevelVisualPreset } from "../visual/LevelVisualPresetResolver";
import type { FindItemsLevelVisualPreset } from "../visual/MarketLevelVisualPreset";
import { createOpaqueCutoutTexture } from "../visual/OpaqueCutoutTexture";
import { UtilityTaskScene } from "./UtilityTaskScene";
import type { SceneCampaignSessionContext } from "./StarterMarketScene";

const GOLDEN_EXTRA_PRODUCT_KEYS = Object.freeze([
  "product-banana-bunch",
  "product-grapes-pack",
  "product-peanut-butter"
]);

const GOLDEN_DECOY_LAYOUT = Object.freeze([
  Object.freeze({
    sourceName: "find-decoy-decoy-oats",
    name: "find-decoy-oats",
    assetKey: "product-oats-canister",
    x: 650,
    y: 565,
    width: 72,
    height: 100
  }),
  Object.freeze({
    sourceName: "find-decoy-decoy-yogurt",
    name: "find-decoy-yogurt",
    assetKey: "product-yogurt-cup",
    x: 520,
    y: 648,
    width: 66,
    height: 68
  }),
  Object.freeze({
    sourceName: "find-decoy-decoy-chips",
    name: "find-decoy-banana",
    assetKey: "product-banana-bunch",
    x: 1105,
    y: 663,
    width: 84,
    height: 66
  }),
  Object.freeze({
    sourceName: "find-decoy-decoy-detergent",
    name: "find-decoy-grapes",
    assetKey: "product-grapes-pack",
    x: 1255,
    y: 665,
    width: 74,
    height: 64
  }),
  Object.freeze({
    sourceName: "find-decoy-decoy-paper-towels",
    name: "find-decoy-peanut-butter",
    assetKey: "product-peanut-butter",
    x: 780,
    y: 648,
    width: 70,
    height: 90
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
    this.createStoreFixtures();
    this.reframeDecoys();
    this.normalizeWorkerTexture();
  }

  override update(time: number, delta: number): void {
    super.update(time, delta);
    this.normalizeWorkerTexture();
  }

  private createStoreFixtures(): void {
    const primary = this.goldenVisual.fixture;
    this.add.image(
      primary.position.x,
      primary.position.y,
      this.goldenContext.levelAssets.fixture.key
    )
      .setOrigin(0.5, 0.96)
      .setDisplaySize(primary.size.width, primary.size.height)
      .setDepth(10)
      .setName("golden-order-dairy-fixture");

    this.goldenVisual.auxiliaryFixtures.forEach((fixture, index) => {
      this.goldenContext.assets.require(fixture.assetKey);
      this.add.image(
        fixture.position.x,
        fixture.position.y,
        fixture.assetKey
      )
        .setOrigin(0.5, 0.96)
        .setDisplaySize(fixture.size.width, fixture.size.height)
        .setDepth(10)
        .setName(`golden-order-aux-fixture-${index + 1}`);
    });
  }

  private reframeDecoys(): void {
    GOLDEN_DECOY_LAYOUT.forEach((layout) => {
      const object = this.children.getByName(layout.sourceName);
      if (!(object instanceof Phaser.GameObjects.Image)) return;
      object
        .setName(layout.name)
        .setTexture(layout.assetKey)
        .setPosition(layout.x, layout.y)
        .setDisplaySize(layout.width, layout.height)
        .setDepth(12 + layout.y / 1000);
    });
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
      .setBlendMode(Phaser.BlendModes.NORMAL);
  }
}
