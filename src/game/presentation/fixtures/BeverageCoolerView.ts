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
}

export class BeverageCoolerView {
  private readonly rows: Phaser.GameObjects.Container[] = [];
  private readonly rowPlates: Phaser.GameObjects.Graphics[] = [];
  private readonly rowMasks: Phaser.GameObjects.Rectangle[] = [];
  private previousStockedRows = 0;

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
    const productionBaseY = 820;

    scene.add.ellipse(
      config.centreX + 12,
      productionBaseY + 8,
      430,
      58,
      0x10241f,
      0.22
    ).setDepth(-1);

    scene.add.image(config.centreX, productionBaseY, config.coolerAssetKey)
      .setOrigin(0.5, 0.96)
      .setDisplaySize(config.displayWidth, config.displayHeight)
      .setDepth(0)
      .setName("beverage-cooler-production");

    config.rowYs.forEach((y, rowIndex) => {
      const mask = scene.add.rectangle(
        config.centreX,
        y,
        config.frameWidth * 0.47,
        66,
        0x14282c,
        0.93
      ).setStrokeStyle(2, 0x456064, 0.72).setDepth(3);
      this.rowMasks.push(mask);

      const shelfLine = scene.add.rectangle(
        config.centreX,
        y + 31,
        config.frameWidth * 0.47,
        4,
        0x8aa0a3,
        0.72
      ).setDepth(4);
      shelfLine.setName(`beverage-cooler-empty-shelf-${rowIndex}`);

      const plate = this.createRowPlate(y);
      this.rowPlates.push(plate);
      this.rows.push(this.createRestockRow(y, rowIndex));
    });
  }

  sync(stockedRows: number): void {
    this.rows.forEach((row, index) => row.setAlpha(index < stockedRows ? 1 : 0.12));
    this.rowMasks.forEach((mask, index) => mask.setAlpha(index < stockedRows ? 0 : 0.93));
    this.rowPlates.forEach((plate, index) => plate.setAlpha(index === stockedRows ? 0.96 : 0));

    if (stockedRows <= this.previousStockedRows) {
      this.previousStockedRows = stockedRows;
      return;
    }

    const row = this.rows[stockedRows - 1];
    const mask = this.rowMasks[stockedRows - 1];
    if (row) {
      row.setScale(0.76).setAlpha(1);
      this.scene.tweens.add({
        targets: row,
        scaleX: 1,
        scaleY: 1,
        duration: 360,
        ease: "Back.Out"
      });
    }
    if (mask) {
      this.scene.tweens.add({
        targets: mask,
        alpha: 0,
        duration: 260,
        ease: "Sine.Out"
      });
    }
    this.previousStockedRows = stockedRows;
  }

  private createRowPlate(y: number): Phaser.GameObjects.Graphics {
    const { scene, config } = this;
    const width = config.frameWidth * 0.49;
    const plate = scene.add.graphics().setDepth(6).setAlpha(0);
    plate.fillStyle(0xffd95e, 0.12);
    plate.fillRoundedRect(config.centreX - width / 2, y - 37, width, 74, 11);
    plate.lineStyle(4, 0xffd95e, 0.92);
    plate.strokeRoundedRect(config.centreX - width / 2, y - 37, width, 74, 11);
    return plate;
  }

  private createRestockRow(y: number, rowIndex: number): Phaser.GameObjects.Container {
    const count = Math.min(5, Math.max(4, this.config.restockItemCount));
    const spacing = 43;
    const startX = this.config.centreX - ((count - 1) * spacing) / 2;
    const objects: Phaser.GameObjects.GameObject[] = [];

    for (let index = 0; index < count; index += 1) {
      const bottle = this.scene.add.image(
        startX + index * spacing,
        y + 30,
        this.config.restockProductKey
      )
        .setOrigin(0.5, 0.96)
        .setDisplaySize(120, 136)
        .setDepth(5);
      objects.push(bottle);
    }

    return this.scene.add.container(0, 0, objects)
      .setAlpha(0.12)
      .setDepth(5)
      .setName(`beverage-cooler-row-${rowIndex}`);
  }
}
