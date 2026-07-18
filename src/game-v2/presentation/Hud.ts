import Phaser from "phaser";
import type { RestockSnapshot } from "../domain/restock";
import type { RestockViewCopy } from "../application/RestockController";
import { DAY_ONE_CONTENT } from "../content/day01";

export class ImmersiveHud {
  private readonly objectiveText: Phaser.GameObjects.Text;
  private readonly progressText: Phaser.GameObjects.Text;
  private readonly instructionText: Phaser.GameObjects.Text;
  private readonly actionLabel: Phaser.GameObjects.Text;
  private readonly actionButton: Phaser.GameObjects.Rectangle;
  private readonly coinText: Phaser.GameObjects.Text;
  private readonly starText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, onAction: () => void) {
    const { palette } = DAY_ONE_CONTENT;

    const dayPanel = scene.add.rectangle(95, 62, 150, 84, palette.hud, 0.93)
      .setStrokeStyle(2, 0xffffff, 0.12)
      .setDepth(100)
      .setName("v3-hud-day");
    scene.add.text(31, 25, DAY_ONE_CONTENT.title, {
      fontFamily: "Arial",
      fontSize: "25px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setDepth(101);
    scene.add.rectangle(95, 62, 126, 1, 0xffffff, 0.14).setDepth(101);
    scene.add.text(31, 72, `☀  ${DAY_ONE_CONTENT.timeLabel}`, {
      fontFamily: "Arial",
      fontSize: "17px",
      color: "#f5f2e9"
    }).setDepth(101);
    dayPanel.setScrollFactor(0);

    scene.add.rectangle(1460, 48, 240, 62, palette.hud, 0.95)
      .setStrokeStyle(2, 0xffffff, 0.1)
      .setDepth(100);
    scene.add.text(1362, 29, "★", {
      fontFamily: "Arial",
      fontSize: "29px",
      color: "#ffd64c"
    }).setDepth(101);
    this.starText = scene.add.text(1405, 30, "0", {
      fontFamily: "Arial",
      fontSize: "23px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setDepth(101);
    scene.add.rectangle(1454, 48, 2, 36, 0xffffff, 0.16).setDepth(101);
    scene.add.text(1473, 30, "●", {
      fontFamily: "Arial",
      fontSize: "25px",
      color: "#f7c641"
    }).setDepth(101);
    this.coinText = scene.add.text(1510, 30, "100", {
      fontFamily: "Arial",
      fontSize: "23px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setDepth(101);

    scene.add.rectangle(1380, 146, 400, 132, palette.hud, 0.96)
      .setStrokeStyle(2, 0xffffff, 0.11)
      .setDepth(100)
      .setName("v3-hud-objective");
    scene.add.text(1205, 98, "TASK OBJECTIVE", {
      fontFamily: "Arial",
      fontSize: "16px",
      color: "#f5c64d",
      fontStyle: "bold"
    }).setDepth(101);
    scene.add.rectangle(1380, 130, 350, 1, 0xffffff, 0.13).setDepth(101);
    scene.add.rectangle(1208, 157, 17, 17, 0x000000, 0)
      .setStrokeStyle(2, 0xffffff, 0.88)
      .setDepth(101);
    this.objectiveText = scene.add.text(1234, 143, DAY_ONE_CONTENT.objective, {
      fontFamily: "Arial",
      fontSize: "16px",
      color: "#ffffff",
      wordWrap: { width: 225, useAdvancedWrap: true },
      lineSpacing: 3
    }).setDepth(101);
    this.progressText = scene.add.text(1550, 146, "0/6 ROWS", {
      fontFamily: "Arial",
      fontSize: "16px",
      color: "#ffffff",
      fontStyle: "bold",
      align: "right"
    }).setOrigin(1, 0).setDepth(101);

    scene.add.rectangle(800, 850, 1260, 66, palette.hud, 0.91)
      .setStrokeStyle(2, palette.gold, 0.48)
      .setDepth(100);
    this.instructionText = scene.add.text(210, 831, "", {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#ffffff",
      fontStyle: "bold",
      wordWrap: { width: 900 }
    }).setDepth(101);

    this.actionButton = scene.add.rectangle(1310, 850, 220, 46, palette.green, 1)
      .setStrokeStyle(2, palette.gold, 0.88)
      .setInteractive({ useHandCursor: true })
      .setDepth(102);
    this.actionLabel = scene.add.text(1310, 850, "", {
      fontFamily: "Arial",
      fontSize: "16px",
      color: "#ffffff",
      fontStyle: "bold",
      align: "center"
    }).setOrigin(0.5).setDepth(103);

    this.actionButton.on("pointerover", () => this.actionButton.setFillStyle(palette.greenBright, 1));
    this.actionButton.on("pointerout", () => this.actionButton.setFillStyle(palette.green, 1));
    this.actionButton.on("pointerdown", onAction);
  }

  update(snapshot: RestockSnapshot, copy: RestockViewCopy): void {
    this.objectiveText.setText(copy.objective);
    this.progressText.setText(`${snapshot.stockedRows}/${snapshot.totalRows} ROWS`);
    this.instructionText.setText(copy.instruction);
    this.actionLabel.setText(copy.actionLabel);
    this.coinText.setText(String(snapshot.coins));
    this.starText.setText(String(snapshot.stars));

    const complete = snapshot.step === "complete";
    this.actionButton.setAlpha(complete ? 0.45 : 1);
    this.actionButton.disableInteractive();
    if (!complete) this.actionButton.setInteractive({ useHandCursor: true });
  }
}
