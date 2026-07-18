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

    const dayPanel = scene.add.rectangle(92, 67, 160, 94, palette.hud, 0.92)
      .setStrokeStyle(2, 0xffffff, 0.12)
      .setDepth(100);
    scene.add.text(32, 24, DAY_ONE_CONTENT.title, {
      fontFamily: "Arial",
      fontSize: "28px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setDepth(101);
    scene.add.rectangle(92, 66, 132, 1, 0xffffff, 0.16).setDepth(101);
    scene.add.text(31, 77, `☀  ${DAY_ONE_CONTENT.timeLabel}`, {
      fontFamily: "Arial",
      fontSize: "20px",
      color: "#ffffff"
    }).setDepth(101);
    dayPanel.setName("v2-hud-day");

    scene.add.rectangle(1380, 46, 280, 66, palette.hud, 0.94)
      .setStrokeStyle(2, 0xffffff, 0.1)
      .setDepth(100);
    scene.add.text(1273, 28, "★", {
      fontFamily: "Arial",
      fontSize: "32px",
      color: "#ffd64c"
    }).setDepth(101);
    this.starText = scene.add.text(1320, 28, "0", {
      fontFamily: "Arial",
      fontSize: "26px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setDepth(101);
    scene.add.rectangle(1370, 46, 2, 38, 0xffffff, 0.18).setDepth(101);
    scene.add.text(1390, 28, "●", {
      fontFamily: "Arial",
      fontSize: "29px",
      color: "#f7c641"
    }).setDepth(101);
    this.coinText = scene.add.text(1431, 28, "100", {
      fontFamily: "Arial",
      fontSize: "26px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setDepth(101);

    scene.add.rectangle(1360, 147, 320, 118, palette.hud, 0.94)
      .setStrokeStyle(2, 0xffffff, 0.11)
      .setDepth(100);
    scene.add.text(1217, 101, "TASK OBJECTIVE", {
      fontFamily: "Arial",
      fontSize: "17px",
      color: "#f5c64d",
      fontStyle: "bold"
    }).setDepth(101);
    scene.add.rectangle(1360, 137, 284, 1, 0xffffff, 0.14).setDepth(101);
    this.objectiveText = scene.add.text(1248, 154, DAY_ONE_CONTENT.objective, {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#ffffff"
    }).setDepth(101);
    this.progressText = scene.add.text(1445, 153, "0/6 ROWS", {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setOrigin(1, 0).setDepth(101);
    scene.add.rectangle(1226, 170, 18, 18, 0x000000, 0)
      .setStrokeStyle(2, 0xffffff, 0.9)
      .setDepth(101);

    scene.add.rectangle(768, 974, 940, 76, palette.hud, 0.9)
      .setStrokeStyle(2, palette.gold, 0.5)
      .setDepth(100);
    this.instructionText = scene.add.text(338, 955, "", {
      fontFamily: "Arial",
      fontSize: "20px",
      color: "#ffffff",
      fontStyle: "bold",
      wordWrap: { width: 690 }
    }).setDepth(101);

    this.actionButton = scene.add.rectangle(1185, 974, 230, 50, palette.green, 1)
      .setStrokeStyle(2, palette.gold, 0.9)
      .setInteractive({ useHandCursor: true })
      .setDepth(102);
    this.actionLabel = scene.add.text(1185, 974, "", {
      fontFamily: "Arial",
      fontSize: "17px",
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
