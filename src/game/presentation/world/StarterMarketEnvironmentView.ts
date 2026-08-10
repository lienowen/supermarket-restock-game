import Phaser from "phaser";
import type { StarterMarketPresentationContext } from "../context/StarterMarketPresentationContext";
import { createOpaqueCutoutTexture } from "../visual/OpaqueCutoutTexture";
import { resolveLevelVisualPreset } from "../visual/LevelVisualPresetResolver";
import type { MarketLevelVisualPreset } from "../visual/MarketLevelVisualPreset";

const PURE_BACKGROUND_LEVEL_IDS = new Set(["starter-level-001"]);
const FOCUSED_GAMEPLAY_LEVEL_IDS = new Set(["starter-level-002"]);

/**
 * Owns the supermarket shell and non-gameplay scene dressing.
 *
 * Level 1 stays background-only. Level 2 is deliberately gameplay-focused:
 * its authored cold-display background already supplies enough supermarket
 * context, so adding reusable departments/customers on top makes the route and
 * cooler unreadable. Other levels can still use the richer layered dressing.
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

    if (this.isPureBackgroundLevel()) {
      document.body.dataset.sceneDressing = "background-only";
    } else if (this.isFocusedGameplayLevel()) {
      document.body.dataset.sceneDressing = "level-two-focused";
      this.createFocusedGameplayBackdrop();
    } else {
      document.body.dataset.sceneDressing = "layered-solid";
      this.createFloor();
      this.createStoreComposition();
      this.createAmbientLife();
      this.createModeFocus();
      this.createAtmosphere();
    }

    this.registerRestockCoolerPresentation();
    this.registerSharedFixtureAvailability();
  }

  private isPureBackgroundLevel(): boolean {
    return PURE_BACKGROUND_LEVEL_IDS.has(this.context.campaignLevel.level.id);
  }

  private isFocusedGameplayLevel(): boolean {
    return FOCUSED_GAMEPLAY_LEVEL_IDS.has(this.context.campaignLevel.level.id);
  }

  private createBase(): void {
    const { scene, context } = this;
    const environmentKey = context.levelAssets.environment.key;
    const keepsAuthoredOrientation =
      environmentKey === "environment-starter-market-restock-hd-v3" ||
      environmentKey.startsWith("environment-project-");

    scene.add.image(
      context.world.width / 2,
      context.world.height / 2,
      environmentKey
    )
      .setOrigin(0.5)
      .setDisplaySize(context.world.width, context.world.height)
      .setFlipX(context.mode === "restock" && !keepsAuthoredOrientation)
      .setDepth(-30)
      .setName("commercial-supermarket-salesfloor");
  }

  private createFocusedGameplayBackdrop(): void {
    const { scene, context } = this;

    // L2 gets only one neutral calming layer over the authored background.
    // No generic floor strip, ambient glow or vignette competes with the live
    // objective guide. All stronger emphasis belongs to the current task.
    scene.add.rectangle(
      context.world.width / 2,
      context.world.height / 2,
      context.world.width,
      context.world.height,
      0x07110e,
      0.06
    )
      .setDepth(4)
      .setName("level-two-background-calm-wash");
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

  private createStoreComposition(): void {
    this.addSceneAsset(
      "fixture-produce-display-a",
      185,
      700,
      320,
      300,
      10,
      "ambient-produce-display"
    );
    this.addSceneAsset(
      "fixture-backroom-rack-a",
      430,
      570,
      300,
      315,
      9,
      "ambient-backroom-rack"
    );
    this.addSceneAsset(
      "equipment-shopping-cart",
      305,
      810,
      132,
      136,
      21,
      "ambient-shopping-cart"
    );

    if (this.context.mode !== "restock") return;

    this.addSceneAsset(
      "fixture-dairy-breakfast-a",
      720,
      465,
      300,
      310,
      9,
      "ambient-dairy-aisle"
    );
    this.addSceneAsset(
      "fixture-cleaning-supplies-a",
      1435,
      480,
      270,
      290,
      9,
      "ambient-cleaning-aisle",
      true
    );
    this.addSceneAsset(
      "fixture-checkout-a",
      1390,
      725,
      310,
      260,
      12,
      "ambient-checkout"
    );
  }

  private createAmbientLife(): void {
    const first = this.addAmbientCustomer(
      "customer-a-idle",
      565,
      748,
      142,
      235,
      "ambient-customer-a"
    );
    const second = this.addAmbientCustomer(
      "customer-b-idle",
      1490,
      770,
      148,
      240,
      "ambient-customer-b",
      true
    );

    if (first) {
      this.scene.tweens.add({
        targets: first,
        x: 655,
        y: 756,
        duration: 6800,
        ease: "Sine.InOut",
        yoyo: true,
        repeat: -1,
        hold: 700,
        repeatDelay: 500
      });
    }

    if (second) {
      this.scene.tweens.add({
        targets: second,
        x: 1395,
        y: 764,
        duration: 7600,
        ease: "Sine.InOut",
        yoyo: true,
        repeat: -1,
        hold: 950,
        repeatDelay: 650
      });
    }
  }

  private addSceneAsset(
    key: string,
    x: number,
    y: number,
    width: number,
    height: number,
    depth: number,
    name: string,
    flipX = false
  ): Phaser.GameObjects.Image | undefined {
    if (!this.scene.textures.exists(key)) return undefined;
    const solidKey = createOpaqueCutoutTexture(this.scene, key, 24);
    return this.scene.add.image(x, y, solidKey)
      .setOrigin(0.5, 0.96)
      .setDisplaySize(width, height)
      .setFlipX(flipX)
      .setAlpha(1)
      .setDepth(depth + y / 1000)
      .setName(name);
  }

  private addAmbientCustomer(
    key: string,
    x: number,
    y: number,
    width: number,
    height: number,
    name: string,
    flipX = false
  ): Phaser.GameObjects.Container | undefined {
    if (!this.scene.textures.exists(key)) return undefined;

    const solidKey = createOpaqueCutoutTexture(this.scene, key, 24);
    const shadow = this.scene.add.ellipse(
      0,
      3,
      Math.max(62, width * 0.48),
      Math.max(18, height * 0.085),
      0x102018,
      0.2
    );
    const customer = this.scene.add.image(0, 0, solidKey)
      .setOrigin(0.5, 0.96)
      .setDisplaySize(width, height)
      .setFlipX(flipX)
      .setAlpha(1);

    return this.scene.add.container(x, y, [shadow, customer])
      .setDepth(18 + y / 1000)
      .setName(name);
  }

  private registerRestockCoolerPresentation(): void {
    if (this.context.mode !== "restock") {
      document.body.dataset.restockCoolerBackground = "not-applicable";
      delete document.body.dataset.restockCoolerAsset;
      return;
    }

    document.body.dataset.restockCoolerBackground = this.context.levelAssets.environment.key === "environment-project-restock-v2"
      ? "project-v2"
      : "production-v3-hd";
    document.body.dataset.restockCoolerAsset = "world-integrated-layered";
  }

  private registerSharedFixtureAvailability(): void {
    [
      "fixture-backroom-rack-a",
      "fixture-produce-display-a",
      "fixture-beverage-cooler-a",
      "fixture-beverage-cooler-glass-hd-v3",
      "fixture-dairy-breakfast-a",
      "fixture-cleaning-supplies-a",
      "fixture-checkout-a",
      "equipment-shopping-cart",
      "customer-a-idle",
      "customer-b-idle"
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
