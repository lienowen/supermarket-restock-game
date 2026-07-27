import Phaser from "phaser";
import type { StarterMarketPresentationContext } from "../context/StarterMarketPresentationContext";
import { resolveCoolerStockSlots } from "../visual/CoolerStockLayout";
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
    this.createRestockEmptyCooler();
    this.registerSharedFixtureAvailability();
    this.createModeFocus();
    this.createAtmosphere();
  }

  private createBase(): void {
    const { scene, context } = this;
    scene.add.image(
      context.world.width / 2,
      context.world.height / 2,
      context.levelAssets.environment.key
    )
      .setOrigin(0.5)
      .setDisplaySize(context.world.width, context.world.height)
      .setFlipX(context.mode === "restock")
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

  /**
   * The sales-floor background contains stocked drinks baked into its pixels.
   * Restock mode therefore places a fully opaque backing over the complete wall
   * segment and then renders the production empty-cooler asset above it. Stock
   * products remain separate gameplay objects; the glass layer is rendered last
   * so the result reads as one real refrigerated fixture instead of debug art.
   */
  private createRestockEmptyCooler(): void {
    if (this.context.mode !== "restock") {
      document.body.dataset.restockCoolerBackground = "not-applicable";
      return;
    }

    const slots = resolveCoolerStockSlots(this.context.world.beverageCooler.x);
    const xs = slots.map((slot) => slot.x);
    const ys = slots.map((slot) => slot.y);
    const left = Math.max(0, Math.min(...xs) - 135);
    const right = Math.min(this.context.world.width - 2, Math.max(...xs) + 108);
    const top = Math.min(...ys) - 82;
    const bottom = Math.max(...ys) + 86;
    const width = right - left;
    const height = bottom - top;
    const centreX = left + width / 2;
    const centreY = top + height / 2;
    const bounds = Object.freeze({ left, right, top, bottom });

    this.scene.add.rectangle(
      centreX,
      centreY,
      width,
      height,
      0x050907,
      1
    )
      .setDepth(2)
      .setName("beverage-cooler-stock-occluder")
      .setData("background-stock-occluded", true)
      .setData("occluded-wall-bounds", bounds);

    this.scene.add.image(
      centreX,
      centreY,
      "fixture-beverage-cooler-empty"
    )
      .setOrigin(0.5)
      .setDisplaySize(width, height)
      .setDepth(3)
      .setName("beverage-cooler-empty-shell")
      .setData("background-stock-occluded", true)
      .setData("asset-driven", true)
      .setData("occluded-wall-bounds", bounds);

    this.scene.add.image(
      centreX,
      centreY,
      "fixture-beverage-cooler-glass-overlay"
    )
      .setOrigin(0.5)
      .setDisplaySize(width, height)
      .setDepth(15)
      .setAlpha(0.78)
      .setName("beverage-cooler-glass-overlay");

    document.body.dataset.restockCoolerBackground = "occluded";
    document.body.dataset.restockCoolerAsset = "fixture-beverage-cooler-empty";
  }

  private registerSharedFixtureAvailability(): void {
    // These production fixtures stay registered for task-specific views, but
    // are deliberately not enlarged into the shared background composition.
    [
      "fixture-backroom-rack-a",
      "fixture-produce-display-a",
      "fixture-beverage-cooler-empty",
      "fixture-beverage-cooler-glass-overlay"
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
