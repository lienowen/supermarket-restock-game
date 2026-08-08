import Phaser from "phaser";
import type { FindItemsStarterMarketPresentationContext } from "../context/StarterMarketPresentationContext";
import { resolveLevelVisualPreset } from "../visual/LevelVisualPresetResolver";
import type { FindItemsLevelVisualPreset } from "../visual/MarketLevelVisualPreset";
import { createOpaqueCutoutTexture } from "../visual/OpaqueCutoutTexture";
import { UtilityTaskScene } from "./UtilityTaskScene";
import type { SceneCampaignSessionContext } from "./StarterMarketScene";

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

  override create(): void {
    super.create();
    document.body.dataset.goldenLevel = "level-5-mature-pass-v1";
    document.body.dataset.goldenEnvironment = this.goldenContext.levelAssets.environment.key;
    this.createStoreFixtures();
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
