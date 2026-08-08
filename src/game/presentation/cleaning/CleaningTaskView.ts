import Phaser from "phaser";
import type { NavigationPoint } from "../../application/PlayerNavigationController";
import type { CleanLevelVisualPreset } from "../visual/MarketLevelVisualPreset";
import { createTrimmedTexture, fitImageIntoBox } from "../visual/TrimmedTexture";

export interface CleaningTaskViewConfig {
  readonly fixtureAssetKey: string;
  readonly cleaningCartAssetKey: string;
  readonly wetFloorSignAssetKey: string;
  readonly spillAssetKeys?: readonly string[];
  readonly toolPoint: NavigationPoint;
  readonly spotPositions: readonly NavigationPoint[];
  readonly visual: CleanLevelVisualPreset;
}

export interface CleaningTaskViewState {
  readonly phase: "tools" | "spills" | "complete";
  readonly completedSpills: number;
}

const DEFAULT_SPILL_ASSET_KEYS = Object.freeze([
  "spill-water-large",
  "spill-juice-large",
  "spill-dirt-smear-large"
]);
const SPILL_SIZE_MULTIPLIERS = Object.freeze([
  Object.freeze({ width: 1.0, height: 0.9 }),
  Object.freeze({ width: 1.12, height: 0.98 }),
  Object.freeze({ width: 1.22, height: 1.02 })
]);

/**
 * Reusable mature cleaning presentation. Gameplay owns which spill is active;
 * this view renders the actual water / juice / dirt production art at grounded
 * floor scale instead of prototype vector puddles.
 */
export class CleaningTaskView {
  private readonly staticObjects: Phaser.GameObjects.GameObject[] = [];
  private readonly toolObjects: Phaser.GameObjects.Image[] = [];
  private readonly spills: Phaser.GameObjects.Container[] = [];
  private previousPhase: CleaningTaskViewState["phase"] = "tools";
  private previousCompletedSpills = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly config: CleaningTaskViewConfig
  ) {}

  create(): readonly Phaser.GameObjects.Container[] {
    if (this.staticObjects.length > 0 || this.spills.length > 0) {
      return Object.freeze([...this.spills]);
    }

    const { scene, config } = this;
    const { visual } = config;

    scene.textures.exists(config.fixtureAssetKey);
    scene.textures.exists(config.wetFloorSignAssetKey);

    const cartTexture = createTrimmedTexture(scene, config.cleaningCartAssetKey, {
      alphaThreshold: 10,
      suffix: "--clean-trimmed",
      padding: 2
    });
    const cartShadow = scene.add.ellipse(
      config.toolPoint.x + 5,
      config.toolPoint.y + 4,
      visual.cartSize.width * 0.72,
      Math.max(16, visual.cartSize.height * 0.12),
      0x16231f,
      0.2
    ).setDepth(18);

    const cart = scene.add.image(
      config.toolPoint.x,
      config.toolPoint.y,
      cartTexture
    )
      .setOrigin(0.5, 0.96)
      .setDisplaySize(visual.cartSize.width, visual.cartSize.height)
      .setDepth(20)
      .setName("cleaning-cart-tool");

    this.staticObjects.push(cartShadow, cart);
    this.toolObjects.push(cart);

    config.spotPositions.forEach((point, index) => {
      this.spills.push(this.createSpill(point, index));
    });
    this.showToolsPhase(false);
    document.body.dataset.cleaningPresentation = "mature-clean-v1";
    document.body.dataset.cleaningSpillArt = "water-juice-dirt-production";
    return Object.freeze([...this.spills]);
  }

  sync(state: CleaningTaskViewState): void {
    if (state.phase === "tools") {
      this.showToolsPhase(this.previousPhase !== "tools");
    } else if (state.phase === "spills") {
      this.showSpillPhase(
        state.completedSpills,
        this.previousPhase !== "spills" || state.completedSpills !== this.previousCompletedSpills
      );
    } else {
      this.showCompletePhase();
    }

    this.previousPhase = state.phase;
    this.previousCompletedSpills = state.completedSpills;
  }

  destroy(): void {
    this.staticObjects.splice(0).forEach((object) => object.destroy());
    this.toolObjects.length = 0;
    this.spills.splice(0).forEach((spill) => spill.destroy(true));
  }

  private showToolsPhase(animate: boolean): void {
    this.toolObjects.forEach((tool) => {
      tool.setVisible(true);
      if (!animate) {
        tool.setAlpha(1).setScale(1);
        return;
      }
      this.scene.tweens.killTweensOf(tool);
      this.scene.tweens.add({
        targets: tool,
        alpha: 1,
        scaleX: 1,
        scaleY: 1,
        duration: 220,
        ease: "Sine.Out"
      });
    });
    this.spills.forEach((spill) => {
      this.scene.tweens.killTweensOf(spill);
      spill.setVisible(false).setAlpha(0).setScale(0.82);
    });
  }

  private showSpillPhase(completedSpills: number, animate: boolean): void {
    const { visual } = this.config;
    this.toolObjects.forEach((tool) => {
      this.scene.tweens.killTweensOf(tool);
      if (!animate) {
        tool.setAlpha(visual.collectedToolsAlpha);
        return;
      }
      this.scene.tweens.add({
        targets: tool,
        alpha: visual.collectedToolsAlpha,
        duration: 260,
        ease: "Sine.Out"
      });
    });

    this.spills.forEach((spill, index) => {
      this.scene.tweens.killTweensOf(spill);
      if (index < completedSpills) {
        if (animate && index >= this.previousCompletedSpills) {
          this.scene.tweens.add({
            targets: spill,
            alpha: 0,
            scaleX: 0.58,
            scaleY: 0.58,
            duration: 340,
            ease: "Cubic.In",
            onComplete: () => spill.setVisible(false)
          });
        } else {
          spill.setVisible(false).setAlpha(0).setScale(0.58);
        }
        return;
      }

      const active = index === completedSpills;
      const targetAlpha = active ? 1 : 0.54;
      const targetScale = active ? 1.04 : 0.94;
      spill.setVisible(true);

      if (!animate) {
        spill.setAlpha(targetAlpha).setScale(targetScale);
        return;
      }

      const enteringSpillPhase = this.previousPhase !== "spills";
      if (enteringSpillPhase) {
        spill.setAlpha(0).setScale(0.82);
      }
      this.scene.tweens.add({
        targets: spill,
        alpha: targetAlpha,
        scaleX: targetScale,
        scaleY: targetScale,
        duration: 260,
        delay: enteringSpillPhase ? Math.max(0, index - completedSpills) * 65 : 0,
        ease: active ? "Back.Out" : "Sine.Out"
      });
    });
  }

  private showCompletePhase(): void {
    const { visual } = this.config;
    this.toolObjects.forEach((tool) => {
      this.scene.tweens.killTweensOf(tool);
      tool.setAlpha(visual.collectedToolsAlpha);
    });
    this.spills.forEach((spill) => {
      this.scene.tweens.killTweensOf(spill);
      spill.setVisible(false).setAlpha(0);
    });
  }

  private createSpill(
    point: NavigationPoint,
    index: number
  ): Phaser.GameObjects.Container {
    const { scene, config } = this;
    const visual = config.visual;
    const spillAssetKeys = config.spillAssetKeys ?? DEFAULT_SPILL_ASSET_KEYS;
    const sourceKey = spillAssetKeys[index % spillAssetKeys.length];
    if (!sourceKey) throw new Error("Clean mode requires at least one spill asset");
    const textureKey = createTrimmedTexture(scene, sourceKey, {
      alphaThreshold: 8,
      suffix: "--clean-spill",
      padding: 2
    });
    const multiplier = SPILL_SIZE_MULTIPLIERS[index % SPILL_SIZE_MULTIPLIERS.length] ?? SPILL_SIZE_MULTIPLIERS[0];
    const maxWidth = visual.spillTargetSize.width * multiplier.width;
    const maxHeight = visual.spillTargetSize.height * multiplier.height;

    const shadow = scene.add.ellipse(
      3,
      5,
      maxWidth * 0.88,
      Math.max(14, maxHeight * 0.42),
      0x17211d,
      0.14
    );
    const art = scene.add.image(0, 0, textureKey)
      .setOrigin(0.5, 0.5)
      .setName(`clean-spill-art-${index + 1}`);
    fitImageIntoBox(art, maxWidth, maxHeight);

    return scene.add.container(point.x, point.y, [shadow, art])
      .setDepth(9 + point.y / 1000)
      .setAngle([-4, 3, -2, 5][index % 4] ?? 0)
      .setVisible(false)
      .setAlpha(0)
      .setScale(0.82)
      .setData("spill-source-key", sourceKey)
      .setName(`clean-spill-${index + 1}`);
  }
}
