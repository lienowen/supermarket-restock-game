import Phaser from "phaser";
import type { InteractionTargetBounds } from "./RestockTargetResolver";

export interface InteractionTargetViewConfig {
  readonly color: number;
  readonly arrowOffsetY: number;
  readonly name?: string;
}

export class InteractionTargetView {
  private readonly target: Phaser.GameObjects.Rectangle;
  private readonly hitTarget: Phaser.GameObjects.Rectangle;
  private readonly arrow: Phaser.GameObjects.Text;
  private readonly pulse: Phaser.Tweens.Tween;

  constructor(
    scene: Phaser.Scene,
    config: InteractionTargetViewConfig,
    onAction: () => void
  ) {
    this.hitTarget = scene.add.rectangle(0, 0, 120, 90, config.color, 0.001)
      .setDepth(59)
      .setName(`${config.name ?? "interaction-target"}-hit-area`);
    this.target = scene.add.rectangle(0, 0, 120, 90, config.color, 0.055)
      .setStrokeStyle(4, config.color, 0.96)
      .setDepth(60)
      .setName(config.name ?? "interaction-target");
    this.arrow = scene.add.text(0, 0, "▼", {
      fontFamily: "Arial",
      fontSize: "38px",
      color: `#${config.color.toString(16).padStart(6, "0")}`,
      fontStyle: "bold",
      stroke: "#2f2815",
      strokeThickness: 6
    }).setOrigin(0.5).setDepth(61);

    this.hitTarget.on("pointerdown", onAction);
    this.pulse = scene.tweens.add({
      targets: [this.target, this.arrow],
      alpha: { from: 0.56, to: 1 },
      scaleX: { from: 0.97, to: 1.025 },
      scaleY: { from: 0.97, to: 1.025 },
      duration: 720,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut"
    });
    this.arrow.setData("arrowOffsetY", config.arrowOffsetY);
  }

  sync(bounds: InteractionTargetBounds | undefined, enabled: boolean): void {
    if (!bounds) {
      this.hitTarget.setVisible(false).disableInteractive();
      this.target.setVisible(false);
      this.arrow.setVisible(false);
      return;
    }

    const hitPadding = this.hitPadding(bounds);
    const hitWidth = bounds.width + hitPadding.left + hitPadding.right;
    const hitHeight = bounds.height + hitPadding.top + hitPadding.bottom;
    this.hitTarget.setVisible(true)
      .setPosition(
        bounds.x + (hitPadding.right - hitPadding.left) / 2,
        bounds.y + (hitPadding.bottom - hitPadding.top) / 2
      )
      .setSize(hitWidth, hitHeight)
      .setDisplaySize(hitWidth, hitHeight)
      .setData("actionEnabled", enabled)
      .setInteractive({ useHandCursor: true });

    this.target.setVisible(true)
      .setPosition(bounds.x, bounds.y)
      .setSize(bounds.width, bounds.height)
      .setDisplaySize(bounds.width, bounds.height)
      .setData("actionEnabled", enabled)
      .setStrokeStyle(4, this.target.fillColor, enabled ? 0.96 : 0.58);
    this.arrow.setVisible(true)
      .setAlpha(enabled ? 1 : 0.68)
      .setPosition(
        bounds.x,
        bounds.y - bounds.height / 2 - Number(this.arrow.getData("arrowOffsetY"))
      );
  }

  destroy(): void {
    this.pulse.stop();
    this.hitTarget.destroy();
    this.target.destroy();
    this.arrow.destroy();
  }

  private hitPadding(bounds: InteractionTargetBounds): {
    readonly top: number;
    readonly right: number;
    readonly bottom: number;
    readonly left: number;
  } {
    if (bounds.height < 80) {
      return Object.freeze({ top: 110, right: 24, bottom: 24, left: 24 });
    }
    return Object.freeze({ top: 18, right: 18, bottom: 18, left: 18 });
  }
}
