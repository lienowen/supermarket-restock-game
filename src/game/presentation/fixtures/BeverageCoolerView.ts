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

export class BeverageCoolerView {
  private readonly rows: Phaser.GameObjects.Container[] = [];
  private readonly rowPlates: Phaser.GameObjects.Graphics[] = [];
  private readonly rowMasks: Phaser.GameObjects.Rectangle[] = [];
  private previousFilledRows = new Set<number>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly config: BeverageCoolerViewConfig
  ) {
    if (config.rowYs.length === 0) {
      throw new Error("Beverage cooler view requires at least one shelf row");
    }
    if (config.ambientProductKeys.length === 0) {
      throw new Error("Beverage cooler view requires ambient product assets");
    }
  }

  create(): void {
    const { scene, config } = this;
    const productionBaseY = config.baseY + config.frameHeight / 2;
    const rowHeight = this.rowHeight();

    scene.add.ellipse(
      config.centreX + 12,
      productionBaseY + 8,
      430,
      58,
      0x10241f,
      0.24
    ).setDepth(-1);

    scene.add.image(config.centreX, productionBaseY, config.coolerAssetKey)
      .setOrigin(0.5, 0.96)
      .setDisplaySize(config.displayWidth, config.displayHeight)
      .setDepth(0)
      .setName("beverage-cooler-production");

    this.createAmbientStock();

    config.rowYs.forEach((y, rowIndex) => {
      const mask = scene.add.rectangle(
        config.centreX,
        y,
        config.frameWidth * 0.58,
        Math.max(62, rowHeight + 16),
        0x102126,
        0.8
      )
        .setStrokeStyle(2, 0x5c7479, 0.58)
        .setDepth(9)
        .setName(`beverage-cooler-row-target-${rowIndex}`);
      this.rowMasks.push(mask);

      const shelfLine = scene.add.rectangle(
        config.centreX,
        y + rowHeight / 2 - 2,
        config.frameWidth * 0.52,
        4,
        0x9eafb1,
        0.65
      ).setDepth(4);
      shelfLine.setName(`beverage-cooler-empty-shelf-${rowIndex}`);

      const plate = this.createRowPlate(y, rowHeight);
      this.rowPlates.push(plate);
      this.rows.push(this.createRestockRow(y, rowIndex, rowHeight));
    });

    const firstRow = config.rowYs[0];
    const lastRow = config.rowYs[config.rowYs.length - 1];
    const glass = scene.add.graphics().setDepth(7);
    glass.fillStyle(0xcfeeff, 0.045);
    glass.fillRoundedRect(
      config.centreX - config.frameWidth * 0.25,
      firstRow - rowHeight / 2 - 5,
      config.frameWidth * 0.5,
      lastRow - firstRow + rowHeight + 10,
      14
    );
    glass.lineStyle(3, 0xffffff, 0.08);
    glass.lineBetween(
      config.centreX - config.frameWidth * 0.19,
      firstRow - rowHeight / 2,
      config.centreX - config.frameWidth * 0.08,
      lastRow + rowHeight / 2
    );

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
      row.setAlpha(filled ? 1 : active ? 0.2 : 0.07);
    });
    this.rowMasks.forEach((mask, index) => {
      const filled = filledRows.has(index);
      const active = state.activeRowIndex === index && !filled;
      mask.setAlpha(filled ? 0 : active ? 0.22 : 0.78);
      const enabled = state.interactionEnabled && !filled;
      if (enabled && !mask.input?.enabled) {
        mask.setInteractive({ useHandCursor: true });
      } else if (!enabled && mask.input?.enabled) {
        mask.disableInteractive();
      }
    });
    this.rowPlates.forEach((plate, index) => {
      const active = state.activeRowIndex === index && !filledRows.has(index);
      plate.setAlpha(active ? 0.58 + (1 - state.remainingRatio) * 0.4 : 0);
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
    const width = this.config.frameWidth * 0.56;
    const height = this.rowHeight() + 12;
    const flash = this.scene.add.graphics().setDepth(14);
    flash.fillStyle(0xe45d52, 0.22);
    flash.fillRoundedRect(this.config.centreX - width / 2, y - height / 2, width, height, 11);
    flash.lineStyle(5, 0xff8f86, 0.95);
    flash.strokeRoundedRect(this.config.centreX - width / 2, y - height / 2, width, height, 11);
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 330,
      ease: "Quad.Out",
      onComplete: () => flash.destroy()
    });
  }

  destroy(): void {
    this.rows.forEach((row) => row.destroy(true));
    this.rowPlates.forEach((plate) => plate.destroy());
    this.rowMasks.forEach((mask) => mask.destroy());
  }

  private animateFilledRow(rowIndex: number): void {
    const row = this.rows[rowIndex];
    const mask = this.rowMasks[rowIndex];
    if (row) {
      row.setScale(0.72).setAlpha(1);
      this.scene.tweens.add({
        targets: row,
        scaleX: 1,
        scaleY: 1,
        duration: 330,
        ease: "Back.Out"
      });
      this.playRowSparkles(this.config.rowYs[rowIndex]);
    }
    if (mask) {
      this.scene.tweens.add({
        targets: mask,
        alpha: 0,
        duration: 230,
        ease: "Sine.Out"
      });
    }
  }

  private createAmbientStock(): void {
    const { scene, config } = this;
    config.ambientPositions.forEach((x, index) => {
      const productKey = config.ambientProductKeys[index % config.ambientProductKeys.length];
      const row = index % 3;
      const sideOffset = index < config.ambientPositions.length / 2 ? -1 : 1;
      scene.add.image(x, 420 + row * 105, productKey)
        .setOrigin(0.5, 0.96)
        .setDisplaySize(66, 88)
        .setAlpha(0.74)
        .setDepth(2)
        .setAngle(sideOffset * (2 + row));
    });
  }

  private createRowPlate(y: number, rowHeight: number): Phaser.GameObjects.Graphics {
    const { scene, config } = this;
    const width = config.frameWidth * 0.54;
    const height = rowHeight + 8;
    const plate = scene.add.graphics().setDepth(10).setAlpha(0);
    plate.fillStyle(0xffd95e, 0.16);
    plate.fillRoundedRect(config.centreX - width / 2, y - height / 2, width, height, 11);
    plate.lineStyle(5, 0xffd95e, 1);
    plate.strokeRoundedRect(config.centreX - width / 2, y - height / 2, width, height, 11);
    return plate;
  }

  private createRestockRow(
    y: number,
    rowIndex: number,
    rowHeight: number
  ): Phaser.GameObjects.Container {
    const count = Math.min(5, Math.max(4, this.config.restockItemCount));
    const spacing = 42;
    const startX = this.config.centreX - ((count - 1) * spacing) / 2;
    const bottleHeight = Phaser.Math.Clamp(rowHeight * 1.55, 76, 92);
    const bottleWidth = bottleHeight * 0.72;
    const objects: Phaser.GameObjects.GameObject[] = [];

    for (let index = 0; index < count; index += 1) {
      const bottle = this.scene.add.image(
        startX + index * spacing,
        y + rowHeight / 2 - 2,
        this.config.restockProductKey
      )
        .setOrigin(0.5, 0.96)
        .setDisplaySize(bottleWidth, bottleHeight)
        .setDepth(5);
      objects.push(bottle);
    }

    return this.scene.add.container(0, 0, objects)
      .setAlpha(0.07)
      .setDepth(5)
      .setName(`beverage-cooler-row-${rowIndex}`);
  }

  private rowHeight(): number {
    const spacings = this.config.rowYs
      .slice(1)
      .map((y, index) => y - this.config.rowYs[index])
      .filter((spacing) => spacing > 0);
    const minimumSpacing = spacings.length > 0 ? Math.min(...spacings) : 60;
    return Phaser.Math.Clamp(minimumSpacing * 0.82, 44, 62);
  }

  private playRowSparkles(y: number): void {
    [-82, -42, 0, 42, 82].forEach((offset, index) => {
      const sparkle = this.scene.add.circle(
        this.config.centreX + offset,
        y - 5,
        4 + (index % 2),
        0xffe18a,
        0.9
      ).setDepth(15);
      this.scene.tweens.add({
        targets: sparkle,
        y: y - 42 - (index % 3) * 8,
        alpha: 0,
        scaleX: 0.35,
        scaleY: 0.35,
        duration: 420 + index * 35,
        ease: "Cubic.Out",
        onComplete: () => sparkle.destroy()
      });
    });
  }
}
