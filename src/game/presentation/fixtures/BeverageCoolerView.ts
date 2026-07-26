import Phaser from "phaser";

export interface BeverageCoolerViewConfig {
  readonly centreX: number;
  readonly baseY: number;
  readonly backgroundY: number;
  readonly frameWidth: number;
  readonly frameHeight: number;
  readonly displayWidth: number;
  readonly displayHeight: number;
  readonly departmentLabel: string;
  readonly subtitleLabel: string;
  readonly rowYs: readonly number[];
  readonly ambientPositions: readonly number[];
  readonly restockStartX: number;
  readonly restockStepX: number;
  readonly restockItemCount: number;
  readonly coolerAssetKey: string;
  readonly ambientProductKeys: readonly string[];
  readonly restockProductKey: string;
  readonly onRowSelected?: (rowIndex: number) => void;
}

export interface BeverageCoolerRushState {
  readonly filledRowIndexes: readonly number[];
  readonly activeRowIndex?: number;
  readonly remainingRatio: number;
  readonly interactionEnabled: boolean;
}

/**
 * Interactive stock rows layered over one glass-door bay in the photographed
 * cooler. Bottles sit on the real shelf lips and never cross a door mullion.
 */
export class BeverageCoolerView {
  private readonly rows: Phaser.GameObjects.Container[] = [];
  private readonly rowPlates: Phaser.GameObjects.Graphics[] = [];
  private readonly rowTargets: Phaser.GameObjects.Rectangle[] = [];
  private previousFilledRows = new Set<number>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly config: BeverageCoolerViewConfig
  ) {
    if (config.rowYs.length === 0) {
      throw new Error("Beverage cooler view requires at least one shelf row");
    }
  }

  create(): void {
    const rowHeight = this.rowHeight();
    this.config.rowYs.forEach((y, rowIndex) => {
      const shelfWidth = this.shelfWidth(rowIndex);
      const target = this.scene.add.rectangle(
        this.stockCentreX(),
        y,
        shelfWidth + 30,
        Math.max(50, rowHeight + 8),
        0xffffff,
        0.001
      )
        .setDepth(9)
        .setName(`beverage-cooler-row-target-${rowIndex}`);
      target.on("pointerdown", () => this.config.onRowSelected?.(rowIndex));
      this.rowTargets.push(target);
      this.rowPlates.push(this.createRowPlate(y, rowIndex, rowHeight));
      this.rows.push(this.createRestockRow(y, rowIndex, rowHeight));
    });

    this.syncRush({
      filledRowIndexes: [],
      activeRowIndex: undefined,
      remainingRatio: 1,
      interactionEnabled: false
    });
  }

  sync(stockedRows: number): void {
    this.syncRush({
      filledRowIndexes: Array.from(
        { length: Math.max(0, Math.min(stockedRows, this.rows.length)) },
        (_, index) => index
      ),
      activeRowIndex: undefined,
      remainingRatio: 1,
      interactionEnabled: false
    });
  }

  syncRush(state: BeverageCoolerRushState): void {
    const filledRows = new Set(state.filledRowIndexes);
    this.rows.forEach((row, index) => {
      const filled = filledRows.has(index);
      const active = state.activeRowIndex === index && !filled;
      row.setAlpha(filled ? 1 : active ? 0.2 : 0.035);
    });

    this.rowTargets.forEach((target, index) => {
      const enabled = state.interactionEnabled && !filledRows.has(index);
      target.setAlpha(0.001);
      if (enabled && !target.input?.enabled) {
        target.setInteractive({ useHandCursor: true });
      } else if (!enabled && target.input?.enabled) {
        target.disableInteractive();
      }
    });

    this.rowPlates.forEach((plate, index) => {
      const active = state.activeRowIndex === index && !filledRows.has(index);
      plate.setAlpha(active ? 0.42 + (1 - state.remainingRatio) * 0.48 : 0);
    });

    filledRows.forEach((rowIndex) => {
      if (!this.previousFilledRows.has(rowIndex)) this.animateFilledRow(rowIndex);
    });
    this.previousFilledRows = filledRows;
  }

  rowCentre(rowIndex: number): { readonly x: number; readonly y: number } {
    const y = this.config.rowYs[rowIndex];
    if (y === undefined) throw new Error(`Unknown cooler row ${rowIndex}`);
    return Object.freeze({ x: this.stockCentreX(), y });
  }

  showMistake(rowIndex: number): void {
    const y = this.config.rowYs[rowIndex];
    if (y === undefined) return;
    const width = this.shelfWidth(rowIndex) + 28;
    const height = this.rowHeight() + 6;
    const x = this.stockCentreX();
    const flash = this.scene.add.graphics().setDepth(14);
    flash.fillStyle(0xe45d52, 0.14);
    flash.fillRoundedRect(x - width / 2, y - height / 2, width, height, 8);
    flash.lineStyle(3, 0xff8f86, 0.9);
    flash.strokeRoundedRect(x - width / 2, y - height / 2, width, height, 8);
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 300,
      ease: "Quad.Out",
      onComplete: () => flash.destroy()
    });
  }

  destroy(): void {
    this.rows.forEach((row) => row.destroy(true));
    this.rowPlates.forEach((plate) => plate.destroy());
    this.rowTargets.forEach((target) => target.destroy());
  }

  private animateFilledRow(rowIndex: number): void {
    const row = this.rows[rowIndex];
    if (!row) return;
    row.setScale(0.84).setAlpha(1);
    this.scene.tweens.add({
      targets: row,
      scaleX: 1,
      scaleY: 1,
      duration: 250,
      ease: "Back.Out"
    });
    this.playRowSparkles(this.config.rowYs[rowIndex]);
  }

  private createRowPlate(
    y: number,
    rowIndex: number,
    rowHeight: number
  ): Phaser.GameObjects.Graphics {
    const width = this.shelfWidth(rowIndex) + 26;
    const height = rowHeight + 4;
    const x = this.stockCentreX();
    const plate = this.scene.add.graphics().setDepth(10).setAlpha(0);
    plate.fillStyle(0xffd95e, 0.07);
    plate.fillRoundedRect(x - width / 2, y - height / 2, width, height, 7);
    plate.lineStyle(3, 0xffd95e, 0.92);
    plate.strokeRoundedRect(x - width / 2, y - height / 2, width, height, 7);
    return plate;
  }

  private createRestockRow(
    y: number,
    rowIndex: number,
    rowHeight: number
  ): Phaser.GameObjects.Container {
    const count = Phaser.Math.Clamp(this.config.restockItemCount, 3, 3);
    const shelfWidth = this.shelfWidth(rowIndex);
    const spacing = shelfWidth / (count - 1);
    const startX = -shelfWidth / 2;
    const progress = this.rowProgress(rowIndex);
    const bottleHeight = Phaser.Math.Linear(52, 58, progress);
    const bottleWidth = bottleHeight * 0.62;
    const objects: Phaser.GameObjects.GameObject[] = [];

    for (let index = 0; index < count; index += 1) {
      objects.push(
        this.scene.add.image(
          startX + index * spacing,
          rowHeight / 2 - 1,
          this.config.restockProductKey
        )
          .setOrigin(0.5, 0.96)
          .setDisplaySize(bottleWidth, bottleHeight)
          .setDepth(5)
      );
    }

    return this.scene.add.container(this.stockCentreX(), y, objects)
      .setAlpha(0.035)
      .setDepth(5)
      .setName(`beverage-cooler-row-${rowIndex}`);
  }

  private stockCentreX(): number {
    return this.config.centreX - 15;
  }

  private shelfWidth(rowIndex: number): number {
    return Phaser.Math.Linear(48, 54, this.rowProgress(rowIndex));
  }

  private rowProgress(rowIndex: number): number {
    return this.config.rowYs.length <= 1
      ? 0
      : Phaser.Math.Clamp(rowIndex / (this.config.rowYs.length - 1), 0, 1);
  }

  private rowHeight(): number {
    const spacings = this.config.rowYs
      .slice(1)
      .map((y, index) => y - this.config.rowYs[index])
      .filter((spacing) => spacing > 0);
    const minimumSpacing = spacings.length > 0 ? Math.min(...spacings) : 60;
    return Phaser.Math.Clamp(minimumSpacing * 0.76, 42, 48);
  }

  private playRowSparkles(y: number): void {
    const x = this.stockCentreX();
    [-30, -15, 0, 15, 30].forEach((offset, index) => {
      const sparkle = this.scene.add.circle(
        x + offset,
        y - 3,
        3 + (index % 2),
        0xffe18a,
        0.82
      ).setDepth(15);
      this.scene.tweens.add({
        targets: sparkle,
        y: y - 24 - (index % 3) * 5,
        alpha: 0,
        scaleX: 0.4,
        scaleY: 0.4,
        duration: 330 + index * 26,
        ease: "Cubic.Out",
        onComplete: () => sparkle.destroy()
      });
    });
  }
}
