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
  readonly modeLabel?: string;
  readonly palette: ShiftHudPalette;
}

export interface ShiftHudSnapshot {
  readonly step: string;
  readonly stockedRows: number;
  readonly totalRows: number;
  readonly progressUnit?: string;
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
  private readonly progressFill: Phaser.GameObjects.Graphics;
  private readonly progressGlow: Phaser.GameObjects.Graphics;
  private readonly instructionText: Phaser.GameObjects.Text;
  private readonly actionLabel: Phaser.GameObjects.Text;
  private readonly actionButton: Phaser.GameObjects.Rectangle;
  private readonly actionSurface: Phaser.GameObjects.Graphics;
  private readonly coinText: Phaser.GameObjects.Text;
  private readonly starText: Phaser.GameObjects.Text;
  private complete = false;
  private actionEnabled = false;
  private actionHovered = false;
  private previousProgress = -1;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly config: ShiftHudConfig,
    onAction: () => void
  ) {
    const { palette } = config;
    const { hud } = STARTER_MARKET_VISUAL_SPEC;

    this.createPanel(hud.dayPanel.x, hud.dayPanel.y, hud.dayPanel.width, hud.dayPanel.height, 18);
    const modeWidth = 82;
    const modePill = scene.add.graphics().setDepth(102);
    modePill.fillStyle(palette.greenBright, 0.95);
    modePill.fillRoundedRect(hud.dayPanel.x + 14, hud.dayPanel.y + 10, modeWidth, 20, 10);
    scene.add.text(hud.dayPanel.x + 14 + modeWidth / 2, hud.dayPanel.y + 20, config.modeLabel ?? "STORE SHIFT", {
      fontFamily: "Arial",
      fontSize: "10px",
      color: "#ffffff",
      fontStyle: "bold",
      letterSpacing: 1
    }).setOrigin(0.5).setDepth(103);
    scene.add.text(hud.dayPanel.x + 108, hud.dayPanel.y + 11, config.dayLabel, {
      fontFamily: "Arial",
      fontSize: "16px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setDepth(103);
    scene.add.text(hud.dayPanel.x + 18, hud.dayPanel.y + 43, `☀  ${config.timeLabel}`, {
      fontFamily: "Arial",
      fontSize: "14px",
      color: "#cfe7d8"
    }).setDepth(103);

    this.createPanel(hud.walletPanel.x, hud.walletPanel.y, hud.walletPanel.width, hud.walletPanel.height, 18);
    scene.add.text(hud.walletPanel.x + 20, hud.walletPanel.y + 13, "★", {
      fontFamily: "Arial",
      fontSize: "27px",
      color: "#ffd95e"
    }).setDepth(103);
    this.starText = scene.add.text(hud.walletPanel.x + 58, hud.walletPanel.y + 16, "0", {
      fontFamily: "Arial",
      fontSize: "20px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setDepth(103);
    scene.add.rectangle(hud.walletPanel.x + 105, hud.walletPanel.y + 29, 2, 28, 0xffffff, 0.14).setDepth(103);
    scene.add.circle(hud.walletPanel.x + 132, hud.walletPanel.y + 29, 9, palette.gold, 1)
      .setStrokeStyle(2, 0xffec9d, 0.65)
      .setDepth(103);
    this.coinText = scene.add.text(hud.walletPanel.x + 153, hud.walletPanel.y + 16, "0", {
      fontFamily: "Arial",
      fontSize: "20px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setDepth(103);

    this.createPanel(
      hud.objectivePanel.x,
      hud.objectivePanel.y,
      hud.objectivePanel.width,
      hud.objectivePanel.height,
      20
    );
    scene.add.circle(hud.objectivePanel.x + 32, hud.objectivePanel.y + 36, 17, palette.gold, 1)
      .setStrokeStyle(3, 0xffedab, 0.75)
      .setDepth(103);
    scene.add.text(hud.objectivePanel.x + 32, hud.objectivePanel.y + 36, "✓", {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#2c3b2f",
      fontStyle: "bold"
    }).setOrigin(0.5).setDepth(104);
    scene.add.text(hud.objectivePanel.x + 62, hud.objectivePanel.y + 8, "CURRENT TASK", {
      fontFamily: "Arial",
      fontSize: "10px",
      color: "#a9cfb7",
      fontStyle: "bold",
      letterSpacing: 1.5
    }).setDepth(103);
    this.objectiveText = scene.add.text(
      hud.objectivePanel.x + 62,
      hud.objectivePanel.y + 24,
      config.initialObjective,
      {
        fontFamily: "Arial",
        fontSize: "17px",
        color: "#ffffff",
        fontStyle: "bold",
        wordWrap: { width: 325, useAdvancedWrap: true }
      }
    ).setDepth(103);
    this.progressText = scene.add.text(
      hud.objectivePanel.x + hud.objectivePanel.width - 20,
      hud.objectivePanel.y + 16,
      "0/0",
      {
        fontFamily: "Arial",
        fontSize: "18px",
        color: "#ffd95e",
        fontStyle: "bold",
        align: "right"
      }
    ).setOrigin(1, 0).setDepth(103);

    const progressTrack = scene.add.graphics().setDepth(102);
    progressTrack.fillStyle(0x000000, 0.22);
    progressTrack.fillRoundedRect(
      hud.objectivePanel.x + 62,
      hud.objectivePanel.y + 57,
      hud.objectivePanel.width - 92,
      11,
      6
    );
    progressTrack.lineStyle(1, 0xffffff, 0.12);
    progressTrack.strokeRoundedRect(
      hud.objectivePanel.x + 62,
      hud.objectivePanel.y + 57,
      hud.objectivePanel.width - 92,
      11,
      6
    );
    this.progressGlow = scene.add.graphics().setDepth(102);
    this.progressFill = scene.add.graphics().setDepth(103);

    this.createPanel(
      hud.instructionPanel.x,
      hud.instructionPanel.y,
      hud.instructionPanel.width,
      hud.instructionPanel.height,
      20,
      0.94
    );
    scene.add.circle(
      hud.instructionPanel.x + 32,
      hud.instructionPanel.y + hud.instructionPanel.height / 2,
      17,
      palette.greenBright,
      0.9
    ).setStrokeStyle(2, palette.gold, 0.42).setDepth(103);
    scene.add.text(
      hud.instructionPanel.x + 32,
      hud.instructionPanel.y + hud.instructionPanel.height / 2,
      "!",
      {
        fontFamily: "Arial",
        fontSize: "17px",
        color: "#ffffff",
        fontStyle: "bold"
      }
    ).setOrigin(0.5).setDepth(104);
    this.instructionText = scene.add.text(
      hud.instructionPanel.x + 58,
      hud.instructionPanel.y + 17,
      "",
      {
        fontFamily: "Arial",
        fontSize: "16px",
        color: "#ffffff",
        fontStyle: "bold",
        wordWrap: { width: 720 }
      }
    ).setDepth(103);

    const actionWidth = 220;
    const actionHeight = 42;
    const actionX = hud.instructionPanel.x + hud.instructionPanel.width - actionWidth / 2 - 12;
    const actionY = hud.instructionPanel.y + hud.instructionPanel.height / 2;
    this.actionSurface = scene.add.graphics().setDepth(103);
    this.actionButton = scene.add.rectangle(actionX, actionY, actionWidth, actionHeight, 0xffffff, 0.001)
      .setDepth(104)
      .setName("shift-hud-action");
    this.actionLabel = scene.add.text(actionX, actionY, "", {
      fontFamily: "Arial",
      fontSize: "15px",
      color: "#ffffff",
      fontStyle: "bold",
      align: "center"
    }).setOrigin(0.5).setDepth(105);

    this.actionButton.on("pointerover", () => {
      this.actionHovered = true;
      this.drawActionButton();
    });
    this.actionButton.on("pointerout", () => {
      this.actionHovered = false;
      this.drawActionButton();
    });
    this.actionButton.on("pointerdown", onAction);
    this.syncActionState();
  }

  update(snapshot: ShiftHudSnapshot, copy: ShiftHudCopy): void {
    this.objectiveText.setText(copy.objective);
    this.progressText.setText(
      `${snapshot.stockedRows}/${snapshot.totalRows} ${snapshot.progressUnit ?? "ROWS"}`
    );
    this.instructionText.setText(copy.instruction);
    this.actionLabel.setText(copy.actionLabel);
    this.coinText.setText(String(snapshot.coins));
    this.starText.setText(String(snapshot.stars));
    this.complete = snapshot.step === "complete";

    const { objectivePanel } = STARTER_MARKET_VISUAL_SPEC.hud;
    const maxWidth = objectivePanel.width - 92;
    const progress = snapshot.totalRows > 0
      ? Phaser.Math.Clamp(snapshot.stockedRows / snapshot.totalRows, 0, 1)
      : 0;
    const fillWidth = progress <= 0 ? 0 : Math.max(10, maxWidth * progress);

    this.progressGlow.clear();
    if (fillWidth > 0) {
      this.progressGlow.fillStyle(this.config.palette.gold, 0.2);
      this.progressGlow.fillRoundedRect(
        objectivePanel.x + 59,
        objectivePanel.y + 54,
        fillWidth + 6,
        17,
        9
      );
    }
    this.progressFill.clear();
    if (fillWidth > 0) {
      this.progressFill.fillStyle(this.config.palette.gold, 1);
      this.progressFill.fillRoundedRect(
        objectivePanel.x + 62,
        objectivePanel.y + 57,
        fillWidth,
        11,
        6
      );
      this.progressFill.fillStyle(0xffffff, 0.28);
      this.progressFill.fillRoundedRect(
        objectivePanel.x + 64,
        objectivePanel.y + 59,
        Math.max(0, fillWidth - 4),
        3,
        2
      );
    }

    if (snapshot.stockedRows !== this.previousProgress && this.previousProgress >= 0) {
      this.progressText.setScale(1.14);
      this.scene.tweens.add({
        targets: this.progressText,
        scaleX: 1,
        scaleY: 1,
        duration: 210,
        ease: "Back.Out"
      });
    }
    this.previousProgress = snapshot.stockedRows;
    this.syncActionState();
  }

  setActionEnabled(enabled: boolean): void {
    this.actionEnabled = enabled;
    this.syncActionState();
  }

  private createPanel(
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    alpha = 0.9
  ): Phaser.GameObjects.Graphics {
    const shadow = this.scene.add.graphics().setDepth(99);
    shadow.fillStyle(0x07110e, 0.28);
    shadow.fillRoundedRect(x + 4, y + 6, width, height, radius);

    const panel = this.scene.add.graphics().setDepth(100);
    panel.fillStyle(this.config.palette.hud, alpha);
    panel.fillRoundedRect(x, y, width, height, radius);
    panel.lineStyle(2, 0xffffff, 0.12);
    panel.strokeRoundedRect(x, y, width, height, radius);
    panel.fillStyle(0xffffff, 0.04);
    panel.fillRoundedRect(x + 5, y + 5, width - 10, Math.max(10, height * 0.34), radius - 4);
    return panel;
  }

  private syncActionState(): void {
    const active = this.actionEnabled && !this.complete;
    this.actionButton.disableInteractive();
    if (active) this.actionButton.setInteractive({ useHandCursor: true });
    this.actionLabel.setAlpha(active ? 1 : 0.48);
    this.drawActionButton();
  }

  private drawActionButton(): void {
    const { instructionPanel } = STARTER_MARKET_VISUAL_SPEC.hud;
    const width = 220;
    const height = 42;
    const x = instructionPanel.x + instructionPanel.width - width - 12;
    const y = instructionPanel.y + (instructionPanel.height - height) / 2;
    const active = this.actionEnabled && !this.complete;
    const fill = active
      ? this.actionHovered
        ? this.config.palette.greenBright
        : this.config.palette.green
      : 0x405049;

    this.actionSurface.clear();
    this.actionSurface.fillStyle(0x07110e, 0.32);
    this.actionSurface.fillRoundedRect(x + 3, y + 4, width, height, 15);
    this.actionSurface.fillStyle(fill, active ? 1 : 0.6);
    this.actionSurface.fillRoundedRect(x, y, width, height, 15);
    this.actionSurface.lineStyle(2, active ? this.config.palette.gold : 0xffffff, active ? 0.72 : 0.08);
    this.actionSurface.strokeRoundedRect(x, y, width, height, 15);
    if (active) {
      this.actionSurface.fillStyle(0xffffff, this.actionHovered ? 0.12 : 0.07);
      this.actionSurface.fillRoundedRect(x + 4, y + 4, width - 8, 12, 10);
    }
  }
}
