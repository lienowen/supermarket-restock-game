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
  private readonly instructionText: Phaser.GameObjects.Text;
  private readonly actionLabel: Phaser.GameObjects.Text;
  private readonly actionButton: Phaser.GameObjects.Rectangle;
  private readonly actionSurface: Phaser.GameObjects.Graphics;
  private readonly coinText: Phaser.GameObjects.Text;
  private readonly starText: Phaser.GameObjects.Text;
  private complete = false;
  private actionEnabled = false;
  private actionHovered = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly config: ShiftHudConfig,
    onAction: () => void
  ) {
    const { palette } = config;
    const { hud } = STARTER_MARKET_VISUAL_SPEC;

    this.createPanel(hud.dayPanel.x, hud.dayPanel.y, hud.dayPanel.width, hud.dayPanel.height, 18);
    scene.add.text(hud.dayPanel.x + 18, hud.dayPanel.y + 12, config.dayLabel, {
      fontFamily: "Arial",
      fontSize: "19px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setDepth(101);
    scene.add.text(hud.dayPanel.x + 18, hud.dayPanel.y + 40, `☀  ${config.timeLabel}`, {
      fontFamily: "Arial",
      fontSize: "14px",
      color: "#cfe7d8"
    }).setDepth(101);

    this.createPanel(hud.walletPanel.x, hud.walletPanel.y, hud.walletPanel.width, hud.walletPanel.height, 18);
    scene.add.text(hud.walletPanel.x + 20, hud.walletPanel.y + 13, "★", {
      fontFamily: "Arial",
      fontSize: "27px",
      color: "#ffd95e"
    }).setDepth(101);
    this.starText = scene.add.text(hud.walletPanel.x + 58, hud.walletPanel.y + 16, "0", {
      fontFamily: "Arial",
      fontSize: "20px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setDepth(101);
    scene.add.rectangle(hud.walletPanel.x + 105, hud.walletPanel.y + 29, 2, 28, 0xffffff, 0.14).setDepth(101);
    scene.add.circle(hud.walletPanel.x + 132, hud.walletPanel.y + 29, 9, palette.gold, 1)
      .setStrokeStyle(2, 0xffec9d, 0.65)
      .setDepth(101);
    this.coinText = scene.add.text(hud.walletPanel.x + 153, hud.walletPanel.y + 16, "0", {
      fontFamily: "Arial",
      fontSize: "20px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setDepth(101);

    this.createPanel(
      hud.objectivePanel.x,
      hud.objectivePanel.y,
      hud.objectivePanel.width,
      hud.objectivePanel.height,
      20
    );
    scene.add.circle(hud.objectivePanel.x + 32, hud.objectivePanel.y + 31, 16, palette.gold, 1)
      .setStrokeStyle(3, 0xffedab, 0.75)
      .setDepth(101);
    scene.add.text(hud.objectivePanel.x + 32, hud.objectivePanel.y + 31, "✓", {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#2c3b2f",
      fontStyle: "bold"
    }).setOrigin(0.5).setDepth(102);
    this.objectiveText = scene.add.text(
      hud.objectivePanel.x + 62,
      hud.objectivePanel.y + 13,
      config.initialObjective,
      {
        fontFamily: "Arial",
        fontSize: "17px",
        color: "#ffffff",
        fontStyle: "bold",
        wordWrap: { width: 310, useAdvancedWrap: true }
      }
    ).setDepth(101);
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
    ).setOrigin(1, 0).setDepth(101);

    const progressTrack = scene.add.graphics().setDepth(101);
    progressTrack.fillStyle(0xffffff, 0.1);
    progressTrack.fillRoundedRect(
      hud.objectivePanel.x + 62,
      hud.objectivePanel.y + 53,
      hud.objectivePanel.width - 92,
      9,
      5
    );
    this.progressFill = scene.add.graphics().setDepth(102);

    this.createPanel(
      hud.instructionPanel.x,
      hud.instructionPanel.y,
      hud.instructionPanel.width,
      hud.instructionPanel.height,
      20,
      0.92
    );
    this.instructionText = scene.add.text(
      hud.instructionPanel.x + 24,
      hud.instructionPanel.y + 17,
      "",
      {
        fontFamily: "Arial",
        fontSize: "17px",
        color: "#ffffff",
        fontStyle: "bold",
        wordWrap: { width: 760 }
      }
    ).setDepth(101);

    const actionWidth = 220;
    const actionHeight = 42;
    const actionX = hud.instructionPanel.x + hud.instructionPanel.width - actionWidth / 2 - 12;
    const actionY = hud.instructionPanel.y + hud.instructionPanel.height / 2;
    this.actionSurface = scene.add.graphics().setDepth(102);
    this.actionButton = scene.add.rectangle(actionX, actionY, actionWidth, actionHeight, 0xffffff, 0.001)
      .setDepth(103)
      .setName("shift-hud-action");
    this.actionLabel = scene.add.text(actionX, actionY, "", {
      fontFamily: "Arial",
      fontSize: "15px",
      color: "#ffffff",
      fontStyle: "bold",
      align: "center"
    }).setOrigin(0.5).setDepth(104);

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
    this.progressFill.clear();
    this.progressFill.fillStyle(this.config.palette.gold, 1);
    this.progressFill.fillRoundedRect(
      objectivePanel.x + 62,
      objectivePanel.y + 53,
      Math.max(8, maxWidth * progress),
      9,
      5
    );

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
    alpha = 0.88
  ): Phaser.GameObjects.Graphics {
    const panel = this.scene.add.graphics().setDepth(100);
    panel.fillStyle(this.config.palette.hud, alpha);
    panel.fillRoundedRect(x, y, width, height, radius);
    panel.lineStyle(2, 0xffffff, 0.12);
    panel.strokeRoundedRect(x, y, width, height, radius);
    panel.fillStyle(0xffffff, 0.035);
    panel.fillRoundedRect(x + 5, y + 5, width - 10, Math.max(10, height * 0.38), radius - 4);
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
    this.actionSurface.fillStyle(fill, active ? 1 : 0.6);
    this.actionSurface.fillRoundedRect(x, y, width, height, 15);
    this.actionSurface.lineStyle(2, active ? this.config.palette.gold : 0xffffff, active ? 0.72 : 0.08);
    this.actionSurface.strokeRoundedRect(x, y, width, height, 15);
  }
}
