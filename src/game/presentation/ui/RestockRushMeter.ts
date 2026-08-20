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
  private readonly summaryText: Phaser.GameObjects.Text;
  private readonly statusText: Phaser.GameObjects.Text;
  private readonly progressFill: Phaser.GameObjects.Rectangle;
  private readonly progressTrackWidth = 246;
  private readonly defaultInstruction: string;
  private readonly anchorX: number;
  private previousStreak = 0;
  private lastSnapshot?: RestockRushSnapshot;
  private feedbackLocked = false;
  private feedbackReset?: Phaser.Time.TimerEvent;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly config: RestockRushMeterConfig
  ) {
    this.defaultInstruction = config.instruction ?? "FIND THE GLOWING SHELF";
    const isWorldRestockMeter = config.y > 600;
    this.anchorX = isWorldRestockMeter ? 1390 : Phaser.Math.Clamp(config.x, 155, 1445);
    const anchorY = isWorldRestockMeter ? 154 : config.y;
    const memoryMode = document.body.dataset.restockChallenge === "memory";

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

    const title = scene.add.text(-130, -36, memoryMode ? "RESTOCK GUIDE" : (config.title ?? "RESTOCK RUSH"), {
      fontFamily: "Arial",
      fontSize: "12px",
      color: "#cfe7d8",
      fontStyle: "bold",
      letterSpacing: 1.1
    });

    this.summaryText = scene.add.text(128, -37, "SHELVES 0/0", {
      fontFamily: "Arial",
      fontSize: "11px",
      color: `#${config.accentColor.toString(16).padStart(6, "0")}`,
      fontStyle: "bold",
      align: "right"
    }).setOrigin(1, 0);

    const progressTrack = scene.add.rectangle(-123, 2, this.progressTrackWidth, 13, 0x000000, 0.38)
      .setOrigin(0, 0.5)
      .setStrokeStyle(2, 0xffffff, 0.1);
    this.progressFill = scene.add.rectangle(-123, 2, 4, 9, 0x62c77d, 1)
      .setOrigin(0, 0.5);

    this.statusText = scene.add.text(0, 27, this.defaultInstruction, {
      fontFamily: "Arial",
      fontSize: "10px",
      color: "#ffffff",
      fontStyle: "bold",
      letterSpacing: 0.2,
      align: "center",
      fixedWidth: 270
    }).setOrigin(0.5);

    this.container = scene.add.container(this.anchorX, anchorY, [
      shadow,
      panel,
      title,
      this.summaryText,
      progressTrack,
      this.progressFill,
      this.statusText
    ])
      .setDepth(130)
      .setScrollFactor(0)
      .setVisible(false);
  }

  sync(snapshot: RestockRushSnapshot): void {
    this.lastSnapshot = snapshot;
    const visible = snapshot.started && !snapshot.complete;
    this.container.setVisible(visible);
    if (!visible) return;

    if (this.isMemoryMode()) {
      this.syncMemoryProgress(snapshot);
    } else {
      this.syncRushProgress(snapshot);
    }

    if (!this.feedbackLocked) this.renderStatus(snapshot);
  }

  showMistake(message = "STREAK LOST"): void {
    if (!this.container.visible) return;
    this.feedbackLocked = true;
    this.feedbackReset?.remove(false);
    this.statusText.setText(message).setColor("#ff928a");
    this.scene.tweens.add({
      targets: this.container,
      x: { from: this.anchorX - 8, to: this.anchorX + 8 },
      duration: 45,
      repeat: 3,
      yoyo: true,
      onComplete: () => this.container.setX(this.anchorX)
    });
    this.feedbackReset = this.scene.time.delayedCall(560, () => {
      this.feedbackLocked = false;
      if (this.lastSnapshot) this.renderStatus(this.lastSnapshot);
    });
  }

  destroy(): void {
    this.feedbackReset?.remove(false);
    this.container.destroy(true);
  }

  private isMemoryMode(): boolean {
    return document.body.dataset.restockChallenge === "memory";
  }

  private isWaveMemoryMode(): boolean {
    return document.body.dataset.restockChallenge === "wave-memory";
  }

  private syncMemoryProgress(snapshot: RestockRushSnapshot): void {
    const totalShelves = snapshot.rowItemCounts.length;
    const totalItems = Math.max(
      1,
      totalShelves * snapshot.itemsPerRow * snapshot.unitsPerInteraction
    );
    const completionRatio = Phaser.Math.Clamp(snapshot.totalItemsStocked / totalItems, 0, 1);
    const width = completionRatio <= 0
      ? 4
      : Math.max(8, this.progressTrackWidth * completionRatio);
    this.progressFill
      .setDisplaySize(width, 9)
      .setFillStyle(this.config.accentColor, 1);
    this.summaryText.setText(`SHELVES ${snapshot.filledRowIndexes.length}/${totalShelves}`);
  }

  private syncRushProgress(snapshot: RestockRushSnapshot): void {
    const width = Math.max(4, this.progressTrackWidth * snapshot.remainingRatio);
    const timerColor = snapshot.remainingRatio > 0.55
      ? 0x62c77d
      : snapshot.remainingRatio > 0.24
        ? this.config.accentColor
        : 0xe45d52;
    this.progressFill.setDisplaySize(width, 9).setFillStyle(timerColor, 1);

    if (this.isWaveMemoryMode()) {
      const wave = document.body.dataset.restockFinaleWave ?? "1/2";
      this.summaryText.setText(`WAVE ${wave}  ·  STREAK x${snapshot.currentStreak}`);
    } else {
      this.summaryText.setText(`STREAK x${snapshot.currentStreak}  BEST x${snapshot.bestStreak}`);
    }

    if (snapshot.currentStreak > this.previousStreak && snapshot.currentStreak > 1) {
      this.summaryText.setScale(1.18);
      this.scene.tweens.add({
        targets: this.summaryText,
        scaleX: 1,
        scaleY: 1,
        duration: 220,
        ease: "Back.Out"
      });
    }
    this.previousStreak = snapshot.currentStreak;
  }

  private renderStatus(snapshot: RestockRushSnapshot): void {
    if (this.isMemoryMode()) {
      const contextualAction = document.body.dataset.levelTwoContextAction;
      const instruction = contextualAction === "place-ready"
        ? "PLACE 3 WATER BOTTLES AT THE HIGHLIGHT"
        : contextualAction === "move-to-cooler"
          ? "TAKE THE BATCH TO THE HIGHLIGHTED SHELF"
          : "GO TO THE CART · AUTO-PICKUP 3 WATER";
      this.statusText.setText(instruction).setColor("#ffffff");
      return;
    }

    if (this.isWaveMemoryMode()) {
      const waveState = document.body.dataset.restockFinaleWaveState;
      this.statusText
        .setText(
          waveState === "preview"
            ? "MEMORIZE THIS 3-SHELF ROUTE"
            : "NO GLOW · FOLLOW THE MEMORIZED ROUTE"
        )
        .setColor("#ffffff");
      return;
    }

    const instruction = snapshot.itemsPerRow === 1 && snapshot.unitsPerInteraction === 3
      ? "TAP EACH SHELF ONCE · AUTO-PLACE 3 BOTTLES"
      : this.defaultInstruction;
    this.statusText.setText(instruction).setColor("#ffffff");
  }
}
