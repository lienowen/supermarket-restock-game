import Phaser from "phaser";
import type { NavigationPoint } from "../../application/PlayerNavigationController";
import type { CleanLevelVisualPreset } from "../visual/MarketLevelVisualPreset";
import { createTrimmedTexture, fitImageIntoBox } from "../visual/TrimmedTexture";

export interface ClosingSafetyCleaningTaskViewConfig {
  readonly cleaningCartAssetKey: string;
  readonly wetFloorSignAssetKey: string;
  readonly spillAssetKeys: readonly string[];
  readonly warningRequiredSpillIndexes: readonly number[];
  readonly toolPoint: NavigationPoint;
  readonly spotPositions: readonly NavigationPoint[];
  readonly visual: CleanLevelVisualPreset;
}

export interface ClosingSafetyCleaningTaskViewState {
  readonly phase: "tools" | "spills" | "complete";
  readonly completedSpills: number;
}

interface CleanNavigationPort {
  setDestination(point: NavigationPoint): void;
}

interface CleanScenePort extends Phaser.Scene {
  isInteractionReady?: () => boolean;
  readonly player?: CleanNavigationPort;
}

const SCRUB_DISTANCE_REQUIRED = 260;
const MAX_SCRUB_STEP = 46;
const MOBILE_SPILL_TOUCH_WIDTH = 230;
const MOBILE_SPILL_TOUCH_HEIGHT = 170;
const SPILL_SIZE_MULTIPLIERS = Object.freeze([
  Object.freeze({ width: 1.0, height: 0.9 }),
  Object.freeze({ width: 1.08, height: 0.94 }),
  Object.freeze({ width: 1.16, height: 0.98 })
]);

/**
 * L8 closing shift mechanic. Liquid hazards require a visible wet-floor sign
 * before scrubbing can begin. Dry dirt / footprints / trash can be scrubbed
 * immediately after the worker reaches the target.
 */
export class ClosingSafetyCleaningTaskView {
  private readonly staticObjects: Phaser.GameObjects.GameObject[] = [];
  private readonly toolObjects: Phaser.GameObjects.Image[] = [];
  private readonly spills: Phaser.GameObjects.Container[] = [];
  private readonly spillTouchZones: Phaser.GameObjects.Zone[] = [];
  private readonly warningSigns = new Map<number, Phaser.GameObjects.Image>();
  private readonly warningRequired = new Set<number>();
  private readonly warningPlaced = new Set<number>();
  private readonly scrubHint: Phaser.GameObjects.Text;
  private toolTouchZone?: Phaser.GameObjects.Zone;
  private previousPhase: ClosingSafetyCleaningTaskViewState["phase"] = "tools";
  private currentPhase: ClosingSafetyCleaningTaskViewState["phase"] = "tools";
  private previousCompletedSpills = 0;
  private activeSpillIndex = -1;
  private scrubDistance = 0;
  private scrubPointerId?: number;
  private scrubLastPoint?: { readonly x: number; readonly y: number };
  private pendingToolWalk = false;
  private pendingSpillWalkIndex = -1;
  private pendingWarningWalkIndex = -1;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly config: ClosingSafetyCleaningTaskViewConfig
  ) {
    config.warningRequiredSpillIndexes.forEach((index) => this.warningRequired.add(index));
    this.scrubHint = scene.add.text(0, 0, "", {
      fontFamily: "Arial, sans-serif",
      fontSize: "14px",
      fontStyle: "bold",
      color: "#f5fff1",
      backgroundColor: "rgba(11, 31, 25, 0.88)",
      padding: { x: 12, y: 7 }
    })
      .setOrigin(0.5)
      .setDepth(35)
      .setVisible(false)
      .setName("closing-clean-hint");
  }

  create(): readonly Phaser.GameObjects.Container[] {
    if (this.staticObjects.length > 0 || this.spills.length > 0) {
      return Object.freeze([...this.spills]);
    }

    if (this.config.spillAssetKeys.length !== this.config.spotPositions.length) {
      throw new Error(
        `Closing cleanup requires one spill asset per stop: ${this.config.spillAssetKeys.length} assets for ${this.config.spotPositions.length} stops`
      );
    }

    const cartTexture = createTrimmedTexture(this.scene, this.config.cleaningCartAssetKey, {
      alphaThreshold: 10,
      suffix: "--closing-clean-trimmed",
      padding: 2
    });
    const signTexture = createTrimmedTexture(this.scene, this.config.wetFloorSignAssetKey, {
      alphaThreshold: 10,
      suffix: "--closing-sign-trimmed",
      padding: 2
    });

    const cartShadow = this.scene.add.ellipse(
      this.config.toolPoint.x + 5,
      this.config.toolPoint.y + 4,
      this.config.visual.cartSize.width * 0.72,
      Math.max(16, this.config.visual.cartSize.height * 0.12),
      0x16231f,
      0.2
    ).setDepth(18);
    const cart = this.scene.add.image(
      this.config.toolPoint.x,
      this.config.toolPoint.y,
      cartTexture
    )
      .setOrigin(0.5, 0.96)
      .setDisplaySize(this.config.visual.cartSize.width, this.config.visual.cartSize.height)
      .setDepth(20)
      .setName("cleaning-cart-tool");

    const toolTouchWidth = Math.max(220, this.config.visual.toolsTargetSize.width * 1.16);
    const toolTouchHeight = Math.max(170, this.config.visual.toolsTargetSize.height * 1.18);
    this.toolTouchZone = this.scene.add.zone(
      this.config.toolPoint.x,
      this.config.toolPoint.y - Math.max(18, this.config.visual.cartSize.height * 0.18),
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

    this.config.spotPositions.forEach((point, index) => {
      this.spills.push(this.createSpill(point, index));
      if (this.warningRequired.has(index)) {
        const sign = this.scene.add.image(point.x + 68, point.y + 14, signTexture)
          .setOrigin(0.5, 0.96)
          .setDisplaySize(58, 82)
          .setDepth(24 + point.y / 1000)
          .setVisible(false)
          .setAlpha(0)
          .setName(`closing-safety-sign-${index + 1}`);
        this.warningSigns.set(index, sign);
        this.staticObjects.push(sign);
      }
    });

    this.scene.input.on("pointermove", this.handleScrubMove, this);
    this.scene.input.on("pointerup", this.handleScrubEnd, this);
    this.scene.input.on("pointerupoutside", this.handleScrubEnd, this);
    this.scene.events.on(Phaser.Scenes.Events.UPDATE, this.handleSceneUpdate, this);

    this.showToolsPhase(false);
    document.body.dataset.cleaningPresentation = "closing-clean-v1-safety-sign-scrub";
    document.body.dataset.cleaningSpillArt = this.config.spillAssetKeys.join("|");
    document.body.dataset.cleaningControl = "tap-walk-sign-then-scrub";
    document.body.dataset.cleaningSafetyRequired = [...this.warningRequired]
      .sort((a, b) => a - b)
      .map((index) => String(index + 1))
      .join(",");
    this.syncSafetyDataset();
    document.body.dataset.cleanScrubProgress = "0";
    return Object.freeze([...this.spills]);
  }

  sync(state: ClosingSafetyCleaningTaskViewState): void {
    this.currentPhase = state.phase;
    if (state.phase === "tools") {
      this.showToolsPhase(this.previousPhase !== "tools");
    } else if (state.phase === "spills") {
      this.pendingToolWalk = false;
      this.showSpillPhase(
        state.completedSpills,
        this.previousPhase !== "spills" || state.completedSpills !== this.previousCompletedSpills
      );
    } else {
      this.pendingToolWalk = false;
      this.pendingSpillWalkIndex = -1;
      this.pendingWarningWalkIndex = -1;
      this.showCompletePhase();
    }
    this.setHudActionVisible(false);
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
    this.warningSigns.clear();
    this.scrubHint.destroy();
    delete document.body.dataset.cleanScrubProgress;
    delete document.body.dataset.cleaningControl;
    delete document.body.dataset.cleaningPendingWalk;
    delete document.body.dataset.cleaningSafetyRequired;
    delete document.body.dataset.cleaningSafetyPlaced;
  }

  private showToolsPhase(animate: boolean): void {
    this.activeSpillIndex = -1;
    this.pendingSpillWalkIndex = -1;
    this.pendingWarningWalkIndex = -1;
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
    this.spills.forEach((spill) => spill.setVisible(false).setAlpha(0).setScale(0.82));
    this.warningSigns.forEach((sign) => sign.setVisible(false).setAlpha(0));
  }

  private showSpillPhase(completedSpills: number, animate: boolean): void {
    if (completedSpills !== this.activeSpillIndex) {
      this.activeSpillIndex = completedSpills;
      this.pendingSpillWalkIndex = -1;
      this.pendingWarningWalkIndex = -1;
      this.resetScrubProgress();
    }

    this.toolObjects.forEach((tool) => {
      this.scene.tweens.killTweensOf(tool);
      tool.setAlpha(this.config.visual.collectedToolsAlpha);
    });

    this.spills.forEach((spill, index) => {
      this.scene.tweens.killTweensOf(spill);
      if (index < completedSpills) {
        spill.setVisible(false).setAlpha(0).setScale(0.58);
        const completedSign = this.warningSigns.get(index);
        completedSign?.setVisible(false).setAlpha(0);
        return;
      }
      const active = index === completedSpills;
      spill.setVisible(true);
      if (!animate) {
        spill.setAlpha(active ? 1 : 0.32).setScale(active ? 1.04 : 0.91);
        return;
      }
      if (this.previousPhase !== "spills") spill.setAlpha(0).setScale(0.82);
      this.scene.tweens.add({
        targets: spill,
        alpha: active ? 1 : 0.32,
        scaleX: active ? 1.04 : 0.91,
        scaleY: active ? 1.04 : 0.91,
        duration: 230,
        delay: this.previousPhase !== "spills" ? Math.max(0, index - completedSpills) * 45 : 0,
        ease: active ? "Back.Out" : "Sine.Out"
      });
    });

    const active = this.spills[completedSpills];
    if (active) {
      this.scrubHint
        .setPosition(active.x, active.y - 78)
        .setText(this.hintForActiveSpill())
        .setVisible(true);
    } else {
      this.scrubHint.setVisible(false);
    }
    this.syncSpillInteractivity();
  }

  private showCompletePhase(): void {
    this.activeSpillIndex = -1;
    this.pendingSpillWalkIndex = -1;
    this.pendingWarningWalkIndex = -1;
    this.resetScrubProgress();
    this.scrubHint.setVisible(false);
    this.spills.forEach((spill) => spill.setVisible(false).setAlpha(0));
    this.warningSigns.forEach((sign) => sign.setVisible(false).setAlpha(0));
    this.syncSpillInteractivity();
  }

  private createSpill(point: NavigationPoint, index: number): Phaser.GameObjects.Container {
    const sourceKey = this.config.spillAssetKeys[index];
    if (!sourceKey) throw new Error(`Missing closing cleanup spill asset ${index + 1}`);
    const textureKey = createTrimmedTexture(this.scene, sourceKey, {
      alphaThreshold: 8,
      suffix: "--closing-clean-spill",
      padding: 2
    });
    const multiplier = SPILL_SIZE_MULTIPLIERS[index % SPILL_SIZE_MULTIPLIERS.length] ?? SPILL_SIZE_MULTIPLIERS[0];
    const maxWidth = this.config.visual.spillTargetSize.width * multiplier.width;
    const maxHeight = this.config.visual.spillTargetSize.height * multiplier.height;
    const shadow = this.scene.add.ellipse(3, 5, maxWidth * 0.88, Math.max(14, maxHeight * 0.42), 0x17211d, 0.14);
    const art = this.scene.add.image(0, 0, textureKey)
      .setOrigin(0.5)
      .setName(`clean-spill-art-${index + 1}`);
    fitImageIntoBox(art, maxWidth, maxHeight);

    const spill = this.scene.add.container(point.x, point.y, [shadow, art])
      .setSize(maxWidth, maxHeight)
      .setDepth(9 + point.y / 1000)
      .setAngle([-4, 3, -2, 5, -3, 2][index % 6] ?? 0)
      .setVisible(false)
      .setAlpha(0)
      .setScale(0.82)
      .setData("spill-source-key", sourceKey)
      .setData("safety-required", this.warningRequired.has(index))
      .setName(`clean-spill-${index + 1}`);

    const touchWidth = Math.max(MOBILE_SPILL_TOUCH_WIDTH, maxWidth * 1.42);
    const touchHeight = Math.max(MOBILE_SPILL_TOUCH_HEIGHT, maxHeight * 1.65);
    const touchZone = this.scene.add.zone(point.x, point.y, touchWidth, touchHeight)
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
          this.beginSpillInteraction(index, pointer);
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

  private beginSpillInteraction(index: number, pointer: Phaser.Input.Pointer): void {
    if (index !== this.activeSpillIndex || this.currentPhase !== "spills") return;
    const scene = this.scene as CleanScenePort;
    const ready = scene.isInteractionReady?.() === true;

    if (this.warningRequired.has(index) && !this.warningPlaced.has(index)) {
      if (!ready) {
        scene.player?.setDestination(this.config.spotPositions[index] ?? this.config.toolPoint);
        this.pendingWarningWalkIndex = index;
        this.pendingSpillWalkIndex = -1;
        this.scrubHint.setText("MOVING · PLACE SAFETY SIGN");
        document.body.dataset.cleaningPendingWalk = `sign-${index + 1}`;
        return;
      }
      this.placeWarningSign(index);
      return;
    }

    if (!ready) {
      scene.player?.setDestination(this.config.spotPositions[index] ?? this.config.toolPoint);
      this.pendingSpillWalkIndex = index;
      this.pendingWarningWalkIndex = -1;
      this.scrubHint.setText("MOVING TO SPILL");
      document.body.dataset.cleaningPendingWalk = `spill-${index + 1}`;
      return;
    }

    this.startScrub(pointer);
  }

  private placeWarningSign(index: number): void {
    if (!this.warningRequired.has(index) || this.warningPlaced.has(index)) return;
    this.warningPlaced.add(index);
    this.pendingWarningWalkIndex = -1;
    delete document.body.dataset.cleaningPendingWalk;
    const sign = this.warningSigns.get(index);
    if (sign) {
      sign.setVisible(true).setAlpha(0).setScale(0.72);
      this.scene.tweens.add({
        targets: sign,
        alpha: 1,
        scaleX: 1,
        scaleY: 1,
        duration: 220,
        ease: "Back.Out"
      });
    }
    this.scrubHint.setText("SAFETY SIGN SET · DRAG TO SCRUB");
    this.syncSafetyDataset();
    this.showSafetyFeedback(index);
  }

  private startScrub(pointer: Phaser.Input.Pointer): void {
    this.pendingSpillWalkIndex = -1;
    delete document.body.dataset.cleaningPendingWalk;
    this.scrubPointerId = pointer.id;
    this.scrubLastPoint = Object.freeze({ x: pointer.worldX, y: pointer.worldY });
    this.scrubHint.setText(`SCRUB ${Math.round(this.scrubRatio() * 100)}%`);
    document.body.dataset.cleanScrubProgress = String(Math.round(this.scrubRatio() * 100));
  }

  private readonly handleSceneUpdate = (): void => {
    const scene = this.scene as CleanScenePort;
    if (scene.isInteractionReady?.() !== true) return;

    if (this.pendingToolWalk && this.currentPhase === "tools") {
      this.pendingToolWalk = false;
      delete document.body.dataset.cleaningPendingWalk;
      this.commitWorldAction();
      return;
    }

    if (
      this.currentPhase === "spills" &&
      this.pendingWarningWalkIndex === this.activeSpillIndex
    ) {
      this.placeWarningSign(this.activeSpillIndex);
      return;
    }

    if (
      this.currentPhase === "spills" &&
      this.pendingSpillWalkIndex === this.activeSpillIndex
    ) {
      this.pendingSpillWalkIndex = -1;
      delete document.body.dataset.cleaningPendingWalk;
      this.scrubHint.setText(this.hintForActiveSpill());
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

  private showSafetyFeedback(index: number): void {
    const spill = this.spills[index];
    if (!spill) return;
    const label = this.scene.add.text(spill.x, spill.y - 126, "SAFETY SIGN PLACED", {
      fontFamily: "Arial, sans-serif",
      fontSize: "17px",
      fontStyle: "bold",
      color: "#fff7b8",
      backgroundColor: "rgba(76, 62, 12, 0.92)",
      padding: { x: 12, y: 7 }
    }).setOrigin(0.5).setDepth(36);
    this.scene.tweens.add({
      targets: label,
      y: label.y - 22,
      alpha: 0,
      duration: 720,
      ease: "Sine.Out",
      onComplete: () => label.destroy()
    });
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

  private hintForActiveSpill(): string {
    if (this.warningRequired.has(this.activeSpillIndex) && !this.warningPlaced.has(this.activeSpillIndex)) {
      return "TAP · PLACE SAFETY SIGN";
    }
    return "TAP · THEN SCRUB";
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

  private syncSafetyDataset(): void {
    document.body.dataset.cleaningSafetyPlaced = [...this.warningPlaced]
      .sort((a, b) => a - b)
      .map((index) => String(index + 1))
      .join(",");
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
