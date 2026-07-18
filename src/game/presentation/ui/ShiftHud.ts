import Phaser from "phaser";
import { STARTER_MARKET_VISUAL_SPEC } from "../visual/StarterMarketVisualSpec";

export interface ShiftHudPalette {
  readonly hud: number;
  readonly green: number;
  readonly greenBright: number;
  readonly gold: number;
}

export interface ShiftHudConfig {
  readonly dayLabel: string;
  readonly timeLabel: string;
  readonly initialObjective: string;
  readonly palette: ShiftHudPalette;
}

export interface ShiftHudSnapshot {
  readonly step: string;
  readonly stockedRows: number;
  readonly totalRows: number;
  readonly coins: number;
  readonly stars: number;
}

export interface ShiftHudCopy {
  readonly objective: string;
  readonly instruction: string;
  readonly actionLabel: string;
}

export class ShiftHud {
  private readonly objectiveText: Phaser.GameObjects.Text;
  private readonly progressText: Phaser.GameObjects.Text;
  private readonly instructionText: Phaser.GameObjects.Text;
  private readonly actionLabel: Phaser.GameObjects.Text;
  private readonly actionButton: Phaser.GameObjects.Rectangle;
  private readonly coinText: Phaser.GameObjects.Text;
  private readonly starText: Phaser.GameObjects.Text;

  constructor(
    scene: Phaser.Scene,
    config: ShiftHudConfig,
    onAction: () => void
  ) {
    const { palette } = config;
    const { hud } = STARTER_MARKET_VISUAL_SPEC;

    const dayPanel = scene.add.rectangle(95, 62, hud.dayPanel.width, hud.dayPanel.height, palette.hud, 0.93)
      .setStrokeStyle(2, 0xffffff, 0.12)
      .setDepth(100)
      .setName("shift-hud-day");
    scene.add.text(hud.dayPanel.x + 11, hud.dayPanel.y + 5, config.dayLabel, {
      fontFamily: "Arial",
      fontSize: "25px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setDepth(101);
    scene.add.rectangle(95, 62, 126, 1, 0xffffff, 0.14).setDepth(101);
    scene.add.text(hud.dayPanel.x + 11, hud.dayPanel.y + 52, `☀  ${config.timeLabel}`, {
      fontFamily: "Arial",
      fontSize: "17px",
      color: "#f5f2e9"
    }).setDepth(101);
    dayPanel.setScrollFactor(0);

    scene.add.rectangle(1460, 48, hud.walletPanel.width, hud.walletPanel.height, palette.hud, 0.95)
      .setStrokeStyle(2, 0xffffff, 0.1)
      .setDepth(100)
      .setName("shift-hud-wallet");
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
    this.coinText = scene.add.text(1510, 30, "0", {
      fontFamily: "Arial",
      fontSize: "23px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setDepth(101);

    scene.add.rectangle(1405, 212, hud.objectivePanel.width, hud.objectivePanel.height, palette.hud, 0.95)
      .setStrokeStyle(2, 0xffffff, 0.11)
      .setDepth(100)
      .setName("shift-hud-objective");
    scene.add.text(1250, 169, "TASK OBJECTIVE", {
      fontFamily: "Arial",
      fontSize: "15px",
      color: "#f5c64d",
      fontStyle: "bold"
    }).setDepth(101);
    scene.add.rectangle(1405, 198, 300, 1, 0xffffff, 0.13).setDepth(101);
    scene.add.rectangle(1253, 219, 16, 16, 0x000000, 0)
      .setStrokeStyle(2, 0xffffff, 0.88)
      .setDepth(101);
    this.objectiveText = scene.add.text(1278, 207, config.initialObjective, {
      fontFamily: "Arial",
      fontSize: "15px",
      color: "#ffffff",
      wordWrap: { width: 190, useAdvancedWrap: true },
      lineSpacing: 3
    }).setDepth(101);
    this.progressText = scene.add.text(1560, 211, "0/0 ROWS", {
      fontFamily: "Arial",
      fontSize: "15px",
      color: "#ffffff",
      fontStyle: "bold",
      align: "right"
    }).setOrigin(1, 0).setDepth(101);

    scene.add.rectangle(800, 850, hud.instructionPanel.width, hud.instructionPanel.height, palette.hud, 0.91)
      .setStrokeStyle(2, palette.gold, 0.48)
      .setDepth(100)
      .setName("shift-hud-instruction");
    this.instructionText = scene.add.text(hud.instructionPanel.x + 40, hud.instructionPanel.y + 14, "", {
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

  update(snapshot: ShiftHudSnapshot, copy: ShiftHudCopy): void {
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
