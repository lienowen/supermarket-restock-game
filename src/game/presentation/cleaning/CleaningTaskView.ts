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
const SCRUB_DISTANCE_REQUIRED = 220;
const MAX_SCRUB_STEP = 64;
const MOBILE_SPILL_TOUCH_WIDTH = 280;
const MOBILE_SPILL_TOUCH_HEIGHT = 220;
const CLEANING_ARRIVAL_RADIUS = 42;
const MIN_RELEASE_SCRUB_DISTANCE = 48;

interface CleanNavigationPort {
  setDestination(point: NavigationPoint): void;
  position?(): NavigationPoint;
}

interface CleanScenePort extends Phaser.Scene {
  isInteractionReady?: () => boolean;
  readonly player?: CleanNavigationPort;
}

/**
 * Mature cleaning presentation. The cleaning cart and active spill are direct
 * world controls: tap either target to walk into working range, then scrub the
 * spill itself. Pointer travel fades the production spill art and only a fully
 * cleaned spill commits CLEAN_SPOT.
 */
export class CleaningTaskView {
  private readonly staticObjects: Phaser.GameObjects.GameObject[] = [];
  private readonly toolObjects: Phaser.GameObjects.Image[] = [];
  private readonly spills: Phaser.GameObjects.Container[] = [];
  private readonly spillTouchZones: Phaser.GameObjects.Zone[] = [];
  private readonly scrubHint: Phaser.GameObjects.Text;
  private toolTouchZone?: Phaser.GameObjects.Zone;
  private previousPhase: CleaningTaskViewState["phase"] = "tools";
  private currentPhase: CleaningTaskViewState["phase"] = "tools";
  private previousCompletedSpills = 0;
  private activeSpillIndex = -1;
  private scrubDistance = 0;
  private scrubPointerId?: number;
  private scrubLastPoint?: { readonly x: number; readonly y: number };
  private pendingToolWalk = false;
  private pendingSpillWalkIndex = -1;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly config: CleaningTaskViewConfig
  ) {
    this.scrubHint = scene.add.text(0, 0, "DRAG TO SCRUB", {
      fontFamily: "Arial, sans-serif",
      fontSize: "13px",
      fontStyle: "bold",
      color: "#e8fff8",
      backgroundColor: "rgba(11, 31, 25, 0.84)",
      padding: { x: 11, y: 6 }
    })
      .setOrigin(0.5)
      .setDepth(31)
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

    const toolTouchWidth = Math.max(220, visual.toolsTargetSize.width * 1.16);
    const toolTouchHeight = Math.max(170, visual.toolsTargetSize.height * 1.18);
    this.toolTouchZone = scene.add.zone(
      config.toolPoint.x,
      config.toolPoint.y - Math.max(18, visual.cartSize.height * 0.18),
      toolTouchWidth,
      toolTouchHeight
    )
      .setDepth(29)
      .setName("cleaning-cart-touch-zone")
      .setInteractive({ useHandCursor: true })
      .on(
        "pointerdown",
        (
          _pointer: Phaser.Input.Pointer,
          _localX: number,
          _localY: number,
          event: Phaser.Types.Input.EventData
        ) => {
          event.stopPropagation();
          this.requestToolWalk();
        }
      );

    this.staticObjects.push(cartShadow, cart, this.toolTouchZone);
    this.toolObjects.push(cart);

    config.spotPositions.forEach((point, index) => {
      this.spills.push(this.createSpill(point, index));
    });
    scene.input.on("pointermove", this.handleScrubMove, this);
    scene.input.on("pointerup", this.handleScrubEnd, this);
    scene.input.on("pointerupoutside", this.handleScrubEnd, this);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.handleSceneUpdate, this);

    this.showToolsPhase(false);
    document.body.dataset.cleaningPresentation = "mature-clean-v4-mobile-reliable-scrub";
    document.body.dataset.cleaningSpillArt = "water-juice-dirt-production";
    document.body.dataset.cleaningControl = "tap-target-auto-walk-then-drag";
    document.body.dataset.cleanScrubProgress = "0";
    return Object.freeze([...this.spills]);
  }

  sync(state: CleaningTaskViewState): void {
    this.currentPhase = state.phase;
    if (state.phase === "tools") {
      this.showToolsPhase(this.previousPhase !== "tools");
      this.setHudActionVisible(false);
    } else if (state.phase === "spills") {
      this.pendingToolWalk = false;
      this.showSpillPhase(
        state.completedSpills,
        this.previousPhase !== "spills" || state.completedSpills !== this.previousCompletedSpills
      );
      this.setHudActionVisible(false);
    } else {
      this.pendingToolWalk = false;
      this.pendingSpillWalkIndex = -1;
      this.showCompletePhase();
      this.setHudActionVisible(false);
    }

    this.syncToolInteractivity();
    this.previousPhase = state.phase;
    this.previousCompletedSpills = state.completedSpills;
  }

  destroy(): void {
    this.scene.input.off("pointermove", this.handleScrubMove, this);
    this.scene.input.off("pointerup", this.handleScrubEnd, this);
    this.scene.input.off("pointerupoutside", this.handleScrubEnd, this);
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.handleSceneUpdate, this);
    this.staticObjects.splice(0).forEach((object) => object.destroy());
    this.toolObjects.length = 0;
    this.spills.splice(0).forEach((spill) => spill.destroy(true));
    this.spillTouchZones.splice(0).forEach((zone) => zone.destroy());
    this.scrubHint.destroy();
    delete document.body.dataset.cleanScrubProgress;
    delete document.body.dataset.cleaningControl;
    delete document.body.dataset.cleaningPendingWalk;
  }

  private showToolsPhase(animate: boolean): void {
    this.activeSpillIndex = -1;
    this.pendingSpillWalkIndex = -1;
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
        scaleX: 1.035,
        scaleY: 1.035,
        yoyo: true,
        duration: 210,
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
      this.pendingSpillWalkIndex = -1;
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
            duration: 300,
            ease: "Cubic.In",
            onComplete: () => spill.setVisible(false)
          });
        } else {
          spill.setVisible(false).setAlpha(0).setScale(0.58);
        }
        return;
      }

      const active = index === completedSpills;
      const targetAlpha = active ? 1 : 0.36;
      const targetScale = active ? 1.04 : 0.92;
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
        duration: 240,
        delay: enteringSpillPhase ? Math.max(0, index - completedSpills) * 55 : 0,
        ease: active ? "Back.Out" : "Sine.Out"
      });
    });

    const active = this.spills[completedSpills];
    if (active) {
      this.scrubHint
        .setPosition(active.x, active.y - 76)
        .setText("TAP · THEN SCRUB")
        .setVisible(true);
    } else {
      this.scrubHint.setVisible(false);
    }
    this.syncSpillInteractivity();
  }

  private showCompletePhase(): void {
    const { visual } = this.config;
    this.activeSpillIndex = -1;
    this.pendingSpillWalkIndex = -1;
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
      .setName(`clean-spill-${index + 1}`);

    const touchWidth = Math.max(MOBILE_SPILL_TOUCH_WIDTH, maxWidth * 1.55);
    const touchHeight = Math.max(MOBILE_SPILL_TOUCH_HEIGHT, maxHeight * 1.9);
    const touchZone = scene.add.zone(point.x, point.y, touchWidth, touchHeight)
      .setDepth(28)
      .setName(`clean-spill-touch-${index + 1}`)
      .setData("clean-spill-index", index)
      .setInteractive({ useHandCursor: true })
      .on(
        "pointerdown",
        (
          pointer: Phaser.Input.Pointer,
          _localX: number,
          _localY: number,
          event: Phaser.Types.Input.EventData
        ) => {
          event.stopPropagation();
          this.beginScrub(index, pointer);
        }
      );
    touchZone.disableInteractive();
    this.spillTouchZones.push(touchZone);
    return spill;
  }

  private requestToolWalk(): void {
    if (this.currentPhase !== "tools") return;
    const scene = this.scene as CleanScenePort;
    if (scene.isInteractionReady?.() === true) {
      this.commitWorldAction();
      return;
    }
    scene.player?.setDestination(this.config.toolPoint);
    this.pendingToolWalk = true;
    document.body.dataset.cleaningPendingWalk = "tools";
  }

  private playerNearPoint(point: NavigationPoint): boolean {
    const position = (this.scene as CleanScenePort).player?.position?.();
    if (!position) return false;
    return Math.hypot(position.x - point.x, position.y - point.y) <= CLEANING_ARRIVAL_RADIUS;
  }

  private beginScrub(index: number, pointer: Phaser.Input.Pointer): void {
    if (index !== this.activeSpillIndex || this.currentPhase !== "spills") return;
    const scene = this.scene as CleanScenePort;
    const point = this.config.spotPositions[index] ?? this.config.toolPoint;
    if (!this.playerNearPoint(point)) {
      scene.player?.setDestination(point);
      this.pendingSpillWalkIndex = index;
      this.scrubHint.setText("MOVING TO SPILL");
      document.body.dataset.cleaningPendingWalk = `spill-${index + 1}`;
      return;
    }
    this.pendingSpillWalkIndex = -1;
    delete document.body.dataset.cleaningPendingWalk;
    this.scrubPointerId = pointer.id;
    this.scrubLastPoint = Object.freeze({ x: pointer.worldX, y: pointer.worldY });
    this.scrubHint.setText("SCRUB 0%");
    document.body.dataset.cleanScrubProgress = String(Math.round(this.scrubRatio() * 100));
  }

  private readonly handleSceneUpdate = (): void => {
    const scene = this.scene as CleanScenePort;

    if (this.pendingToolWalk && this.currentPhase === "tools" && scene.isInteractionReady?.() === true) {
      this.pendingToolWalk = false;
      delete document.body.dataset.cleaningPendingWalk;
      this.commitWorldAction();
      return;
    }

    if (
      this.currentPhase === "spills" &&
      this.pendingSpillWalkIndex === this.activeSpillIndex
    ) {
      const point = this.config.spotPositions[this.activeSpillIndex];
      if (!point) return;
      if (!this.playerNearPoint(point)) {
        scene.player?.setDestination(point);
        return;
      }
      this.pendingSpillWalkIndex = -1;
      delete document.body.dataset.cleaningPendingWalk;
      this.scrubHint.setText("DRAG TO SCRUB");
      const spill = this.spills[this.activeSpillIndex];
      if (spill) {
        this.scene.tweens.killTweensOf(spill);
        this.scene.tweens.add({
          targets: spill,
          scaleX: 1.08,
          scaleY: 1.08,
          duration: 120,
          yoyo: true,
          ease: "Sine.Out"
        });
      }
    }
  };

  private handleScrubMove(pointer: Phaser.Input.Pointer): void {
    if (this.scrubPointerId !== pointer.id || !pointer.isDown || !this.scrubLastPoint) return;
    const spill = this.spills[this.activeSpillIndex];
    if (!spill) return;
    const rawDistance = Math.hypot(
      pointer.worldX - this.scrubLastPoint.x,
      pointer.worldY - this.scrubLastPoint.y
    );
    if (rawDistance < 2) return;
    const distance = Math.min(MAX_SCRUB_STEP, rawDistance);
    this.scrubDistance = Math.min(SCRUB_DISTANCE_REQUIRED, this.scrubDistance + distance);
    this.scrubLastPoint = Object.freeze({ x: pointer.worldX, y: pointer.worldY });
    const ratio = this.scrubRatio();
    spill.setAlpha(1 - ratio * 0.78).setScale(1.04 - ratio * 0.1);
    this.scrubHint.setText(`SCRUB ${Math.round(ratio * 100)}%`);
    document.body.dataset.cleanScrubProgress = String(Math.round(ratio * 100));
    if (ratio >= 1) this.commitScrub();
  }

  private handleScrubEnd(pointer: Phaser.Input.Pointer): void {
    if (this.scrubPointerId !== pointer.id) return;
    this.scrubPointerId = undefined;
    this.scrubLastPoint = undefined;
    if (this.scrubDistance >= MIN_RELEASE_SCRUB_DISTANCE) {
      this.scrubDistance = SCRUB_DISTANCE_REQUIRED;
      this.commitScrub();
      return;
    }
    if (this.scrubRatio() < 1) {
      this.scrubHint.setText(`KEEP SCRUBBING · ${Math.round(this.scrubRatio() * 100)}%`);
    }
  }

  private commitScrub(): void {
    const cleanedIndex = this.activeSpillIndex;
    this.scrubPointerId = undefined;
    this.scrubLastPoint = undefined;
    this.scrubHint.setText("CLEAN!");
    document.body.dataset.cleanScrubProgress = "100";
    if (cleanedIndex >= 0) this.showCleanFeedback(cleanedIndex);
    this.commitWorldAction();
  }

  private commitWorldAction(): void {
    const action = this.scene.children.getByName("shift-hud-action");
    action?.emit("pointerdown");
  }

  private showCleanFeedback(index: number): void {
    const spill = this.spills[index];
    if (!spill) return;
    const label = this.scene.add.text(
      spill.x,
      spill.y - 112,
      `CLEAN! ${index + 1}/${this.spills.length}`,
      {
        fontFamily: "Arial, sans-serif",
        fontSize: "18px",
        fontStyle: "bold",
        color: "#efffea",
        backgroundColor: "rgba(20, 76, 42, 0.9)",
        padding: { x: 12, y: 7 }
      }
    ).setOrigin(0.5).setDepth(34);
    this.scene.tweens.add({
      targets: label,
      y: label.y - 24,
      alpha: 0,
      duration: 620,
      ease: "Sine.Out",
      onComplete: () => label.destroy()
    });
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
    this.spillTouchZones.forEach((zone, index) => {
      const spill = this.spills[index];
      const enabled = Boolean(
        this.currentPhase === "spills" &&
        index === this.activeSpillIndex &&
        spill?.visible
      );
      if (enabled) {
        if (!zone.input?.enabled) zone.setInteractive({ useHandCursor: true });
      } else if (zone.input?.enabled) {
        zone.disableInteractive();
      }
    });
  }

  private syncToolInteractivity(): void {
    const zone = this.toolTouchZone;
    if (!zone) return;
    if (this.currentPhase === "tools") {
      if (!zone.input?.enabled) zone.setInteractive({ useHandCursor: true });
    } else if (zone.input?.enabled) {
      zone.disableInteractive();
    }
  }

  private setHudActionVisible(visible: boolean): void {
    const action = this.scene.children.getByName("shift-hud-action") as Phaser.GameObjects.GameObject & {
      setVisible?: (value: boolean) => unknown;
    } | null;
    action?.setVisible?.(visible);
  }
}
