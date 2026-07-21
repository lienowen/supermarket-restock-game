import Phaser from "phaser";
import type { RestockRushSnapshot } from "../../application/RestockRushController";

export interface RestockRushMeterConfig {
  readonly x: number;
  readonly y: number;
  readonly accentColor: number;
}

export class RestockRushMeter {
  private readonly container: Phaser.GameObjects.Container;
  private readonly streakText: Phaser.GameObjects.Text;
  private readonly statusText: Phaser.GameObjects.Text;
  private readonly timerFill: Phaser.GameObjects.Rectangle;
  private readonly timerTrackWidth = 232;
  private previousStreak = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly config: RestockRushMeterConfig
  ) {
    const shadow = scene.add.graphics();
    shadow.fillStyle(0x06110d, 0.35);
    shadow.fillRoundedRect(-137, -36, 274, 82, 20);

    const panel = scene.add.graphics();
    panel.fillStyle(0x0a1812, 0.94);
    panel.fillRoundedRect(-140, -40, 274, 82, 20);
    panel.lineStyle(3, config.accentColor, 0.76);
    panel.strokeRoundedRect(-140, -40, 274, 82, 20);
    panel.fillStyle(0xffffff, 0.04);
    panel.fillRoundedRect(-135, -35, 264, 22, 14);

    const title = scene.add.text(-118, -30, "RESTOCK RUSH", {
      fontFamily: "Arial",
      fontSize: "13px",
      color: "#cfe7d8",
      fontStyle: "bold",
      letterSpacing: 1.4
    });

    this.streakText = scene.add.text(116, -33, "STREAK x0", {
      fontFamily: "Arial",
      fontSize: "16px",
      color: `#${config.accentColor.toString(16).padStart(6, "0")}`,
      fontStyle: "bold"
    }).setOrigin(1, 0);

    const timerTrack = scene.add.rectangle(-116, 16, this.timerTrackWidth, 14, 0x000000, 0.36)
      .setOrigin(0, 0.5)
      .setStrokeStyle(2, 0xffffff, 0.1);
    this.timerFill = scene.add.rectangle(-116, 16, this.timerTrackWidth, 10, 0x62c77d, 1)
      .setOrigin(0, 0.5);

    this.statusText = scene.add.text(0, 16, "FIND THE GLOWING SHELF", {
      fontFamily: "Arial",
      fontSize: "11px",
      color: "#ffffff",
      fontStyle: "bold",
      letterSpacing: 0.8
    }).setOrigin(0.5);

    this.container = scene.add.container(config.x, config.y, [
      shadow,
      panel,
      title,
      this.streakText,
      timerTrack,
      this.timerFill,
      this.statusText
    ]).setDepth(130).setVisible(false);
  }

  sync(snapshot: RestockRushSnapshot): void {
    const visible = snapshot.started && !snapshot.complete;
    this.container.setVisible(visible);
    if (!visible) return;

    const width = Math.max(4, this.timerTrackWidth * snapshot.remainingRatio);
    const timerColor = snapshot.remainingRatio > 0.55
      ? 0x62c77d
      : snapshot.remainingRatio > 0.24
        ? this.config.accentColor
        : 0xe45d52;
    this.timerFill.setDisplaySize(width, 10).setFillStyle(timerColor, 1);
    this.streakText.setText(`STREAK x${snapshot.currentStreak}  BEST x${snapshot.bestStreak}`);

    if (snapshot.currentStreak > this.previousStreak && snapshot.currentStreak > 1) {
      this.streakText.setScale(1.28);
      this.scene.tweens.add({
        targets: this.streakText,
        scaleX: 1,
        scaleY: 1,
        duration: 220,
        ease: "Back.Out"
      });
    }
    this.previousStreak = snapshot.currentStreak;
  }

  showMistake(message = "STREAK LOST"): void {
    if (!this.container.visible) return;
    this.statusText.setText(message).setColor("#ff928a");
    this.scene.tweens.add({
      targets: this.container,
      x: { from: this.config.x - 8, to: this.config.x + 8 },
      duration: 45,
      repeat: 3,
      yoyo: true,
      onComplete: () => {
        this.container.setX(this.config.x);
        this.statusText.setText("FIND THE GLOWING SHELF").setColor("#ffffff");
      }
    });
  }

  destroy(): void {
    this.container.destroy(true);
  }
}
