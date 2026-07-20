import Phaser from "phaser";
import type { InteractionTargetBounds } from "./RestockTargetResolver";

export interface InteractionTargetViewConfig {
  readonly color: number;
  readonly arrowOffsetY: number;
  readonly name?: string;
}

export class InteractionTargetView {
  private readonly target: Phaser.GameObjects.Rectangle;
  private readonly arrow: Phaser.GameObjects.Text;
  private readonly pulse: Phaser.Tweens.Tween;

  constructor(
    scene: Phaser.Scene,
    config: InteractionTargetViewConfig,
    onAction: () => void
  ) {
    this.target = scene.add.rectangle(0, 0, 120, 90, config.color, 0.055)
      .setStrokeStyle(4, config.color, 0.96)
      .setInteractive({ useHandCursor: true })
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

    this.target.on("pointerdown", onAction);
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
      this.target.setVisible(false).disableInteractive();
      this.arrow.setVisible(false);
      return;
    }

    this.target.setVisible(true)
      .setPosition(bounds.x, bounds.y)
      .setSize(bounds.width, bounds.height)
      .setDisplaySize(bounds.width, bounds.height)
      .setData("actionEnabled", enabled)
      .setStrokeStyle(4, this.target.fillColor, enabled ? 0.96 : 0.58)
      .setInteractive({ useHandCursor: true });
    this.arrow.setVisible(true)
      .setAlpha(enabled ? 1 : 0.68)
      .setPosition(
        bounds.x,
        bounds.y - bounds.height / 2 - Number(this.arrow.getData("arrowOffsetY"))
      );
  }

  destroy(): void {
    this.pulse.stop();
    this.target.destroy();
    this.arrow.destroy();
  }
}
