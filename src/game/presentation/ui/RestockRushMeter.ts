import Phaser from "phaser";
import type { RestockRushSnapshot } from "../../application/RestockRushController";

export interface RestockRushMeterConfig {
  readonly x: number;
  readonly y: number;
  readonly accentColor: number;
  readonly title?: string;
  readonly instruction?: string;
}

export class RestockRushMeter {
  private readonly container: Phaser.GameObjects.Container;
  private readonly streakText: Phaser.GameObjects.Text;
  private readonly statusText: Phaser.GameObjects.Text;
  private readonly timerFill: Phaser.GameObjects.Rectangle;
  private readonly timerTrackWidth = 246;
  private readonly defaultInstruction: string;
  private readonly anchorX: number;
  private previousStreak = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly config: RestockRushMeterConfig
  ) {
    this.defaultInstruction = config.instruction ?? "FIND THE GLOWING SHELF";
    const isWorldRestockMeter = config.y > 600;
    this.anchorX = isWorldRestockMeter ? 1390 : Phaser.Math.Clamp(config.x, 155, 1445);
    const anchorY = isWorldRestockMeter ? 154 : config.y;

    const shadow = scene.add.graphics();
    shadow.fillStyle(0x06110d, 0.35);
    shadow.fillRoundedRect(-149, -43, 298, 96, 20);

    const panel = scene.add.graphics();
    panel.fillStyle(0x0a1812, 0.94);
    panel.fillRoundedRect(-152, -47, 298, 96, 20);
    panel.lineStyle(3, config.accentColor, 0.76);
    panel.strokeRoundedRect(-152, -47, 298, 96, 20);
    panel.fillStyle(0xffffff, 0.04);
    panel.fillRoundedRect(-147, -42, 288, 24, 14);

    const title = scene.add.text(-130, -36, config.title ?? "RESTOCK RUSH", {
      fontFamily: "Arial",
      fontSize: "12px",
      color: "#cfe7d8",
      fontStyle: "bold",
      letterSpacing: 1.1
    });

    this.streakText = scene.add.text(128, -37, "STREAK x0", {
      fontFamily: "Arial",
      fontSize: "13px",
      color: `#${config.accentColor.toString(16).padStart(6, "0")}`,
      fontStyle: "bold"
    }).setOrigin(1, 0);

    const timerTrack = scene.add.rectangle(-123, 2, this.timerTrackWidth, 13, 0x000000, 0.38)
      .setOrigin(0, 0.5)
      .setStrokeStyle(2, 0xffffff, 0.1);
    this.timerFill = scene.add.rectangle(-123, 2, this.timerTrackWidth, 9, 0x62c77d, 1)
      .setOrigin(0, 0.5);

    this.statusText = scene.add.text(0, 27, this.defaultInstruction, {
      fontFamily: "Arial",
      fontSize: "10px",
      color: "#ffffff",
      fontStyle: "bold",
      letterSpacing: 0.45,
      align: "center",
      fixedWidth: 270
    }).setOrigin(0.5);

    this.container = scene.add.container(this.anchorX, anchorY, [
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
    this.timerFill.setDisplaySize(width, 9).setFillStyle(timerColor, 1);
    this.streakText.setText(`STREAK x${snapshot.currentStreak}  BEST x${snapshot.bestStreak}`);

    if (snapshot.currentStreak > this.previousStreak && snapshot.currentStreak > 1) {
      this.streakText.setScale(1.18);
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
      x: { from: this.anchorX - 8, to: this.anchorX + 8 },
      duration: 45,
      repeat: 3,
      yoyo: true,
      onComplete: () => {
        this.container.setX(this.anchorX);
        this.statusText.setText(this.defaultInstruction).setColor("#ffffff");
      }
    });
  }

  destroy(): void {
    this.container.destroy(true);
  }
}
