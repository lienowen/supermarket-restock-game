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
const SCRUB_DISTANCE_REQUIRED = 300;

interface CleanScenePort extends Phaser.Scene {
  isInteractionReady?: () => boolean;
}

/**
 * Mature cleaning presentation. The player now scrubs the spill itself instead
 * of holding a detached progress button: pointer travel fades the production
 * spill art and only a completed scrub commits CLEAN_SPOT.
 */
export class CleaningTaskView {
  private readonly staticObjects: Phaser.GameObjects.GameObject[] = [];
  private readonly toolObjects: Phaser.GameObjects.Image[] = [];
  private readonly spills: Phaser.GameObjects.Container[] = [];
  private readonly scrubHint: Phaser.GameObjects.Text;
  private previousPhase: CleaningTaskViewState["phase"] = "tools";
  private previousCompletedSpills = 0;
  private activeSpillIndex = -1;
  private scrubDistance = 0;
  private scrubPointerId?: number;
  private scrubLastPoint?: { readonly x: number; readonly y: number };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly config: CleaningTaskViewConfig
  ) {
    this.scrubHint = scene.add.text(0, 0, "DRAG TO SCRUB", {
      fontFamily: "Arial, sans-serif",
      fontSize: "12px",
      fontStyle: "bold",
      color: "#e8fff8",
      backgroundColor: "rgba(11, 31, 25, 0.82)",
      padding: { x: 9, y: 5 }
    })
      .setOrigin(0.5)
      .setDepth(30)
      .setVisible(false)
      .setName("clean-scrub-hint");
  }

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
    scene.input.on("pointermove", this.handleScrubMove, this);
    scene.input.on("pointerup", this.handleScrubEnd, this);
    scene.input.on("pointerupoutside", this.handleScrubEnd, this);

    this.showToolsPhase(false);
    document.body.dataset.cleaningPresentation = "mature-clean-v2-scrub";
    document.body.dataset.cleaningSpillArt = "water-juice-dirt-production";
    document.body.dataset.cleanScrubProgress = "0";
    return Object.freeze([...this.spills]);
  }

  sync(state: CleaningTaskViewState): void {
    if (state.phase === "tools") {
      this.showToolsPhase(this.previousPhase !== "tools");
      this.setHudActionVisible(true);
    } else if (state.phase === "spills") {
      this.showSpillPhase(
        state.completedSpills,
        this.previousPhase !== "spills" || state.completedSpills !== this.previousCompletedSpills
      );
      // The world spill is the action surface now; do not leave a one-click
      // MOP FLOOR shortcut on screen.
      this.setHudActionVisible(false);
    } else {
      this.showCompletePhase();
      this.setHudActionVisible(false);
    }

    this.previousPhase = state.phase;
    this.previousCompletedSpills = state.completedSpills;
  }

  destroy(): void {
    this.scene.input.off("pointermove", this.handleScrubMove, this);
    this.scene.input.off("pointerup", this.handleScrubEnd, this);
    this.scene.input.off("pointerupoutside", this.handleScrubEnd, this);
    this.staticObjects.splice(0).forEach((object) => object.destroy());
    this.toolObjects.length = 0;
    this.spills.splice(0).forEach((spill) => spill.destroy(true));
    this.scrubHint.destroy();
    delete document.body.dataset.cleanScrubProgress;
  }

  private showToolsPhase(animate: boolean): void {
    this.activeSpillIndex = -1;
    this.resetScrubProgress();
    this.scrubHint.setVisible(false);
    this.syncSpillInteractivity();
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
    if (completedSpills !== this.activeSpillIndex) {
      this.activeSpillIndex = completedSpills;
      this.resetScrubProgress();
    }

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
      if (enteringSpillPhase) spill.setAlpha(0).setScale(0.82);
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

    const active = this.spills[completedSpills];
    if (active) {
      this.scrubHint
        .setPosition(active.x, active.y - 68)
        .setText("DRAG TO SCRUB")
        .setVisible(true);
    } else {
      this.scrubHint.setVisible(false);
    }
    this.syncSpillInteractivity();
  }

  private showCompletePhase(): void {
    const { visual } = this.config;
    this.activeSpillIndex = -1;
    this.resetScrubProgress();
    this.scrubHint.setVisible(false);
    this.toolObjects.forEach((tool) => {
      this.scene.tweens.killTweensOf(tool);
      tool.setAlpha(visual.collectedToolsAlpha);
    });
    this.spills.forEach((spill) => {
      this.scene.tweens.killTweensOf(spill);
      spill.setVisible(false).setAlpha(0);
    });
    this.syncSpillInteractivity();
  }

  private createSpill(point: NavigationPoint, index: number): Phaser.GameObjects.Container {
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

    const shadow = scene.add.ellipse(3, 5, maxWidth * 0.88, Math.max(14, maxHeight * 0.42), 0x17211d, 0.14);
    const art = scene.add.image(0, 0, textureKey)
      .setOrigin(0.5, 0.5)
      .setName(`clean-spill-art-${index + 1}`);
    fitImageIntoBox(art, maxWidth, maxHeight);

    const spill = scene.add.container(point.x, point.y, [shadow, art])
      .setSize(maxWidth, maxHeight)
      .setDepth(9 + point.y / 1000)
      .setAngle([-4, 3, -2, 5][index % 4] ?? 0)
      .setVisible(false)
      .setAlpha(0)
      .setScale(0.82)
      .setData("spill-source-key", sourceKey)
      .setName(`clean-spill-${index + 1}`)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", (pointer: Phaser.Input.Pointer) => this.beginScrub(index, pointer));
    spill.disableInteractive();
    return spill;
  }

  private beginScrub(index: number, pointer: Phaser.Input.Pointer): void {
    if (index !== this.activeSpillIndex) return;
    const scene = this.scene as CleanScenePort;
    if (scene.isInteractionReady?.() !== true) {
      this.scrubHint.setText("MOVE CLOSER");
      this.scene.time.delayedCall(650, () => {
        if (this.activeSpillIndex === index) this.scrubHint.setText("DRAG TO SCRUB");
      });
      return;
    }
    this.scrubPointerId = pointer.id;
    this.scrubLastPoint = Object.freeze({ x: pointer.worldX, y: pointer.worldY });
    document.body.dataset.cleanScrubProgress = String(Math.round(this.scrubRatio() * 100));
  }

  private handleScrubMove(pointer: Phaser.Input.Pointer): void {
    if (this.scrubPointerId !== pointer.id || !pointer.isDown || !this.scrubLastPoint) return;
    const spill = this.spills[this.activeSpillIndex];
    if (!spill) return;
    const distance = Math.hypot(
      pointer.worldX - this.scrubLastPoint.x,
      pointer.worldY - this.scrubLastPoint.y
    );
    if (distance < 2) return;
    this.scrubDistance = Math.min(SCRUB_DISTANCE_REQUIRED, this.scrubDistance + distance);
    this.scrubLastPoint = Object.freeze({ x: pointer.worldX, y: pointer.worldY });
    const ratio = this.scrubRatio();
    spill.setAlpha(1 - ratio * 0.66).setScale(1.04 - ratio * 0.12);
    this.scrubHint.setText(`SCRUB ${Math.round(ratio * 100)}%`);
    document.body.dataset.cleanScrubProgress = String(Math.round(ratio * 100));
    if (ratio >= 1) this.commitScrub();
  }

  private handleScrubEnd(pointer: Phaser.Input.Pointer): void {
    if (this.scrubPointerId !== pointer.id) return;
    this.scrubPointerId = undefined;
    this.scrubLastPoint = undefined;
    if (this.scrubRatio() < 1) this.scrubHint.setText(`KEEP SCRUBBING · ${Math.round(this.scrubRatio() * 100)}%`);
  }

  private commitScrub(): void {
    this.scrubPointerId = undefined;
    this.scrubLastPoint = undefined;
    this.scrubHint.setText("CLEAN!");
    document.body.dataset.cleanScrubProgress = "100";
    const action = this.scene.children.getByName("shift-hud-action");
    action?.emit("pointerdown");
  }

  private scrubRatio(): number {
    return Phaser.Math.Clamp(this.scrubDistance / SCRUB_DISTANCE_REQUIRED, 0, 1);
  }

  private resetScrubProgress(): void {
    this.scrubDistance = 0;
    this.scrubPointerId = undefined;
    this.scrubLastPoint = undefined;
    document.body.dataset.cleanScrubProgress = "0";
  }

  private syncSpillInteractivity(): void {
    this.spills.forEach((spill, index) => {
      if (index === this.activeSpillIndex && spill.visible) {
        if (!spill.input?.enabled) spill.setInteractive({ useHandCursor: true });
      } else if (spill.input?.enabled) {
        spill.disableInteractive();
      }
    });
  }

  private setHudActionVisible(visible: boolean): void {
    const action = this.scene.children.getByName("shift-hud-action") as Phaser.GameObjects.GameObject & {
      setVisible?: (value: boolean) => unknown;
    } | null;
    action?.setVisible?.(visible);
  }
}
