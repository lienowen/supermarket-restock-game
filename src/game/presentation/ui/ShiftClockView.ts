import Phaser from "phaser";
import type { ShiftClockSnapshot } from "../../application/ShiftClockController";

export interface ShiftClockViewConfig {
  readonly worldWidth: number;
  readonly worldHeight: number;
  readonly panelColor: number;
  readonly accentColor: number;
  readonly onRetry: () => void;
}

type ClockUrgency = "normal" | "warning" | "critical" | "complete";

export class ShiftClockView {
  private readonly objects: Phaser.GameObjects.GameObject[] = [];
  private readonly timerText: Phaser.GameObjects.Text;
  private readonly statusText: Phaser.GameObjects.Text;
  private urgency: ClockUrgency = "normal";
  private expiredOverlayVisible = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly config: ShiftClockViewConfig
  ) {
    const panelX = 275;
    const panelY = 18;
    const panelWidth = 220;
    const panelHeight = 70;

    const shadow = scene.add.graphics().setDepth(99);
    shadow.fillStyle(0x07110e, 0.28);
    shadow.fillRoundedRect(panelX + 4, panelY + 6, panelWidth, panelHeight, 18);
    this.objects.push(shadow);

    const panel = scene.add.graphics().setDepth(100);
    panel.fillStyle(config.panelColor, 0.92);
    panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 18);
    panel.lineStyle(2, 0xffffff, 0.12);
    panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 18);
    panel.fillStyle(0xffffff, 0.04);
    panel.fillRoundedRect(panelX + 5, panelY + 5, panelWidth - 10, 24, 14);
    this.objects.push(panel);

    const label = scene.add.text(panelX + 18, panelY + 10, "SHIFT TIME", {
      fontFamily: "Arial",
      fontSize: "10px",
      color: "#a9cfb7",
      fontStyle: "bold",
      letterSpacing: 1.5
    }).setDepth(103);
    this.objects.push(label);

    this.statusText = scene.add.text(panelX + panelWidth - 18, panelY + 10, "OPEN", {
      fontFamily: "Arial",
      fontSize: "10px",
      color: "#ffd95e",
      fontStyle: "bold",
      align: "right"
    }).setOrigin(1, 0).setDepth(103);
    this.objects.push(this.statusText);

    this.timerText = scene.add.text(panelX + panelWidth / 2, panelY + 47, "02:00", {
      fontFamily: "Arial",
      fontSize: "28px",
      color: "#ffffff",
      fontStyle: "bold",
      align: "center"
    }).setOrigin(0.5).setDepth(103);
    this.objects.push(this.timerText);
  }

  sync(snapshot: ShiftClockSnapshot): void {
    this.timerText.setText(snapshot.status === "completed" ? "DONE" : snapshot.formattedTime);
    this.statusText.setText(snapshot.status === "completed" ? "CLOSED" : "OPEN");

    const urgency = resolveUrgency(snapshot);
    if (urgency === this.urgency) return;
    this.urgency = urgency;
    this.scene.tweens.killTweensOf(this.timerText);
    this.timerText.setScale(1).setAlpha(1);

    switch (urgency) {
      case "normal":
        this.timerText.setColor("#ffffff");
        this.statusText.setColor("#ffd95e");
        return;
      case "warning":
        this.timerText.setColor("#ffcf66");
        this.statusText.setColor("#ffcf66");
        return;
      case "critical":
        this.timerText.setColor("#ff7b6f");
        this.statusText.setColor("#ff7b6f");
        this.scene.tweens.add({
          targets: this.timerText,
          scale: 1.08,
          alpha: 0.72,
          duration: 360,
          yoyo: true,
          repeat: -1,
          ease: "Sine.InOut"
        });
        return;
      case "complete":
        this.timerText.setColor("#9de6b7");
        this.statusText.setColor("#9de6b7");
        return;
    }
  }

  showExpired(): void {
    if (this.expiredOverlayVisible) return;
    this.expiredOverlayVisible = true;
    const { worldWidth, worldHeight, panelColor, accentColor } = this.config;

    const blocker = this.scene.add.rectangle(
      worldWidth / 2,
      worldHeight / 2,
      worldWidth,
      worldHeight,
      0x07110e,
      0.82
    ).setDepth(900).setInteractive();
    this.objects.push(blocker);

    const panelWidth = 570;
    const panelHeight = 290;
    const panelX = worldWidth / 2 - panelWidth / 2;
    const panelY = worldHeight / 2 - panelHeight / 2;
    const panel = this.scene.add.graphics().setDepth(901);
    panel.fillStyle(panelColor, 0.98);
    panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 28);
    panel.lineStyle(3, accentColor, 0.9);
    panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 28);
    this.objects.push(panel);

    const title = this.scene.add.text(worldWidth / 2, panelY + 62, "SHIFT OVER", {
      fontFamily: "Arial",
      fontSize: "42px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setOrigin(0.5).setDepth(902);
    this.objects.push(title);

    const explanation = this.scene.add.text(
      worldWidth / 2,
      panelY + 126,
      "The store closed before the current shift was completed.",
      {
        fontFamily: "Arial",
        fontSize: "18px",
        color: "#cfe7d8",
        align: "center",
        wordWrap: { width: 470, useAdvancedWrap: true }
      }
    ).setOrigin(0.5).setDepth(902);
    this.objects.push(explanation);

    const retryButton = this.scene.add.rectangle(
      worldWidth / 2,
      panelY + 222,
      250,
      54,
      accentColor,
      1
    )
      .setStrokeStyle(2, 0xffffff, 0.35)
      .setDepth(902)
      .setInteractive({ useHandCursor: true });
    retryButton.on("pointerdown", this.config.onRetry);
    retryButton.on("pointerover", () => retryButton.setScale(1.03));
    retryButton.on("pointerout", () => retryButton.setScale(1));
    this.objects.push(retryButton);

    const retryLabel = this.scene.add.text(worldWidth / 2, panelY + 222, "RETRY SHIFT", {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#26372e",
      fontStyle: "bold"
    }).setOrigin(0.5).setDepth(903);
    this.objects.push(retryLabel);
  }

  destroy(): void {
    this.scene.tweens.killTweensOf(this.timerText);
    this.objects.splice(0).forEach((object) => object.destroy());
  }
}

const resolveUrgency = (snapshot: ShiftClockSnapshot): ClockUrgency => {
  if (snapshot.status === "completed") return "complete";
  if (snapshot.remainingSeconds <= 10) return "critical";
  if (snapshot.remainingSeconds <= 30) return "warning";
  return "normal";
};
