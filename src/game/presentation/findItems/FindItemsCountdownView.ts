import Phaser from "phaser";

export interface FindItemsCountdownViewConfig {
  readonly x: number;
  readonly y: number;
  readonly panelColor: number;
  readonly accentColor: number;
  readonly initialSeconds: number;
}

/** Compact timer feedback for timed shelf-search gameplay. */
export class FindItemsCountdownView {
  private container?: Phaser.GameObjects.Container;
  private timeText?: Phaser.GameObjects.Text;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly config: FindItemsCountdownViewConfig
  ) {}

  create(): void {
    if (this.container) return;
    const panel = this.scene.add.graphics();
    panel.fillStyle(this.config.panelColor, 0.96);
    panel.fillRoundedRect(-92, -18, 184, 36, 18);
    panel.lineStyle(3, this.config.accentColor, 0.9);
    panel.strokeRoundedRect(-92, -18, 184, 36, 18);

    const label = this.scene.add.text(-72, 0, "ORDER TIME", {
      fontFamily: "Arial",
      fontSize: "11px",
      color: "#d9e8df",
      fontStyle: "bold",
      letterSpacing: 1
    }).setOrigin(0, 0.5);

    this.timeText = this.scene.add.text(70, 0, this.formatTime(this.config.initialSeconds), {
      fontFamily: "Arial",
      fontSize: "16px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setOrigin(1, 0.5);

    this.container = this.scene.add.container(
      this.config.x,
      this.config.y,
      [panel, label, this.timeText]
    ).setDepth(19).setName("find-items-countdown");
  }

  sync(remainingSeconds: number): void {
    if (!this.timeText) return;
    this.timeText
      .setText(this.formatTime(remainingSeconds))
      .setColor(remainingSeconds <= 10 ? "#ff8f86" : remainingSeconds <= 20 ? "#ffd95e" : "#ffffff");
  }

  showPenalty(seconds: number): void {
    if (!this.timeText) return;
    this.timeText.setText(`-${seconds}s`).setColor("#ff8f86").setScale(1.28);
    this.scene.tweens.add({
      targets: this.timeText,
      scaleX: 1,
      scaleY: 1,
      duration: 260,
      ease: "Back.Out"
    });
  }

  destroy(): void {
    this.container?.destroy(true);
    this.container = undefined;
    this.timeText = undefined;
  }

  private formatTime(seconds: number): string {
    const rounded = Math.max(0, Math.ceil(seconds));
    const minutes = Math.floor(rounded / 60);
    const remainder = rounded % 60;
    return `${minutes}:${String(remainder).padStart(2, "0")}`;
  }
}
