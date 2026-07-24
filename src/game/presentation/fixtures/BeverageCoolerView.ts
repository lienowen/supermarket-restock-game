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
 * Interactive stock rows layered over the cooler already present in the
 * commercial salesfloor. It deliberately does not draw a second refrigerator
 * or opaque shelf masks, which previously made the scene look assembled from
 * unrelated assets.
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
      const target = this.scene.add.rectangle(
        this.config.centreX,
        y,
        this.config.frameWidth * 0.68,
        Math.max(58, rowHeight + 14),
        0xffffff,
        0.001
      )
        .setDepth(9)
        .setName(`beverage-cooler-row-target-${rowIndex}`);
      target.on("pointerdown", () => this.config.onRowSelected?.(rowIndex));
      this.rowTargets.push(target);
      this.rowPlates.push(this.createRowPlate(y, rowHeight));
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
    return Object.freeze({ x: this.config.centreX, y });
  }

  showMistake(rowIndex: number): void {
    const y = this.config.rowYs[rowIndex];
    if (y === undefined) return;
    const width = this.config.frameWidth * 0.66;
    const height = this.rowHeight() + 12;
    const flash = this.scene.add.graphics().setDepth(14);
    flash.fillStyle(0xe45d52, 0.14);
    flash.fillRoundedRect(this.config.centreX - width / 2, y - height / 2, width, height, 10);
    flash.lineStyle(4, 0xff8f86, 0.9);
    flash.strokeRoundedRect(this.config.centreX - width / 2, y - height / 2, width, height, 10);
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
    row.setScale(0.78).setAlpha(1);
    this.scene.tweens.add({
      targets: row,
      scaleX: 1,
      scaleY: 1,
      duration: 280,
      ease: "Back.Out"
    });
    this.playRowSparkles(this.config.rowYs[rowIndex]);
  }

  private createRowPlate(y: number, rowHeight: number): Phaser.GameObjects.Graphics {
    const width = this.config.frameWidth * 0.64;
    const height = rowHeight + 7;
    const plate = this.scene.add.graphics().setDepth(10).setAlpha(0);
    plate.fillStyle(0xffd95e, 0.07);
    plate.fillRoundedRect(this.config.centreX - width / 2, y - height / 2, width, height, 9);
    plate.lineStyle(4, 0xffd95e, 0.92);
    plate.strokeRoundedRect(this.config.centreX - width / 2, y - height / 2, width, height, 9);
    return plate;
  }

  private createRestockRow(
    y: number,
    rowIndex: number,
    rowHeight: number
  ): Phaser.GameObjects.Container {
    const count = Math.min(5, Math.max(4, this.config.restockItemCount));
    const spacing = 36;
    const startX = this.config.centreX - ((count - 1) * spacing) / 2;
    const bottleHeight = Phaser.Math.Clamp(rowHeight * 1.18, 54, 68);
    const bottleWidth = bottleHeight * 0.7;
    const objects: Phaser.GameObjects.GameObject[] = [];

    for (let index = 0; index < count; index += 1) {
      objects.push(
        this.scene.add.image(
          startX + index * spacing,
          y + rowHeight / 2 - 1,
          this.config.restockProductKey
        )
          .setOrigin(0.5, 0.96)
          .setDisplaySize(bottleWidth, bottleHeight)
          .setDepth(5)
      );
    }

    return this.scene.add.container(0, 0, objects)
      .setAlpha(0.035)
      .setDepth(5)
      .setName(`beverage-cooler-row-${rowIndex}`);
  }

  private rowHeight(): number {
    const spacings = this.config.rowYs
      .slice(1)
      .map((y, index) => y - this.config.rowYs[index])
      .filter((spacing) => spacing > 0);
    const minimumSpacing = spacings.length > 0 ? Math.min(...spacings) : 60;
    return Phaser.Math.Clamp(minimumSpacing * 0.76, 42, 58);
  }

  private playRowSparkles(y: number): void {
    [-64, -32, 0, 32, 64].forEach((offset, index) => {
      const sparkle = this.scene.add.circle(
        this.config.centreX + offset,
        y - 3,
        3 + (index % 2),
        0xffe18a,
        0.82
      ).setDepth(15);
      this.scene.tweens.add({
        targets: sparkle,
        y: y - 30 - (index % 3) * 6,
        alpha: 0,
        scaleX: 0.4,
        scaleY: 0.4,
        duration: 360 + index * 30,
        ease: "Cubic.Out",
        onComplete: () => sparkle.destroy()
      });
    });
  }
}
