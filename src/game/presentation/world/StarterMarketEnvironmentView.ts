import Phaser from "phaser";
import type { StarterMarketPresentationContext } from "../context/StarterMarketPresentationContext";
import { resolveLevelVisualPreset } from "../visual/LevelVisualPresetResolver";
import type { MarketLevelVisualPreset } from "../visual/MarketLevelVisualPreset";

/**
 * Owns the fixed supermarket shell only. Gameplay fixtures, actors and targets
 * are layered by their dedicated views so the environment remains one coherent
 * place instead of a collage of oversized departments.
 */
export class StarterMarketEnvironmentView {
  private readonly visualPreset: MarketLevelVisualPreset;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly context: StarterMarketPresentationContext
  ) {
    this.visualPreset = resolveLevelVisualPreset(context.campaignLevel.level);
  }

  create(): void {
    this.createBase();
    this.createFloor();
    this.registerRestockCoolerPresentation();
    this.registerSharedFixtureAvailability();
    this.createModeFocus();
    this.createAtmosphere();
  }

  private createBase(): void {
    const { scene, context } = this;
    const isHdRestockBackground =
      context.levelAssets.environment.key === "environment-starter-market-restock-hd-v3";
    scene.add.image(
      context.world.width / 2,
      context.world.height / 2,
      context.levelAssets.environment.key
    )
      .setOrigin(0.5)
      .setDisplaySize(context.world.width, context.world.height)
      .setFlipX(context.mode === "restock" && !isHdRestockBackground)
      .setDepth(-30)
      .setName("commercial-supermarket-salesfloor");
  }

  private createFloor(): void {
    const { scene, context } = this;
    scene.add.rectangle(
      context.world.width / 2,
      context.world.height - 18,
      context.world.width,
      36,
      0x10201b,
      0.08
    ).setDepth(-29);
  }

  private registerRestockCoolerPresentation(): void {
    if (this.context.mode !== "restock") {
      document.body.dataset.restockCoolerBackground = "not-applicable";
      delete document.body.dataset.restockCoolerAsset;
      return;
    }

    document.body.dataset.restockCoolerBackground = "production-v3-hd";
    document.body.dataset.restockCoolerAsset = "hd-closeup-layered";
  }

  private registerSharedFixtureAvailability(): void {
    [
      "fixture-backroom-rack-a",
      "fixture-produce-display-a",
      "fixture-beverage-cooler-a",
      "fixture-beverage-cooler-glass-hd-v3"
    ].forEach((key) => {
      this.scene.textures.exists(key);
    });
  }

  private createModeFocus(): void {
    const { focus, focusSize } = this.visualPreset.environment;
    const accent = this.context.mode === "checkout"
      ? this.context.palette.greenBright
      : this.context.palette.gold;
    const glow = this.scene.add.ellipse(
      focus.x,
      focus.y + 36,
      focusSize.width * 0.72,
      focusSize.height * 0.34,
      accent,
      this.context.mode === "restock" ? 0.026 : 0.035
    ).setDepth(7);
    glow.setBlendMode(Phaser.BlendModes.ADD);
  }

  private createAtmosphere(): void {
    const { scene, context } = this;
    scene.add.rectangle(
      context.world.width / 2,
      context.world.height / 2,
      context.world.width,
      context.world.height,
      0xffe8bf,
      0.012
    ).setDepth(80);

    const alpha = Math.min(0.12, this.visualPreset.environment.vignetteAlpha * 0.42);
    scene.add.rectangle(6, context.world.height / 2, 12, context.world.height, 0x07110e, alpha).setDepth(81);
    scene.add.rectangle(
      context.world.width - 6,
      context.world.height / 2,
      12,
      context.world.height,
      0x07110e,
      alpha
    ).setDepth(81);
    scene.add.rectangle(
      context.world.width / 2,
      6,
      context.world.width,
      12,
      0x07110e,
      alpha * 0.7
    ).setDepth(81);
  }
}
