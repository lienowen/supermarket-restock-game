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
    const productionBaseY = config.baseY + config.frameHeight / 2;

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
        config.frameWidth * 0.52,
        65,
        0x102126,
        0.8
      ).setStrokeStyle(2, 0x5c7479, 0.58).setDepth(3);
      this.rowMasks.push(mask);

      const shelfLine = scene.add.rectangle(
        config.centreX,
        y + 31,
        config.frameWidth * 0.52,
        4,
        0x9eafb1,
        0.65
      ).setDepth(4);
      shelfLine.setName(`beverage-cooler-empty-shelf-${rowIndex}`);

      const plate = this.createRowPlate(y);
      this.rowPlates.push(plate);
      this.rows.push(this.createRestockRow(y, rowIndex));
    });

    const glass = scene.add.graphics().setDepth(7);
    glass.fillStyle(0xcfeeff, 0.045);
    glass.fillRoundedRect(
      config.centreX - config.frameWidth * 0.25,
      config.rowYs[0] - 42,
      config.frameWidth * 0.5,
      config.rowYs[config.rowYs.length - 1] - config.rowYs[0] + 84,
      14
    );
    glass.lineStyle(3, 0xffffff, 0.08);
    glass.lineBetween(
      config.centreX - config.frameWidth * 0.19,
      config.rowYs[0] - 30,
      config.centreX - config.frameWidth * 0.08,
      config.rowYs[config.rowYs.length - 1] + 30
    );
  }

  sync(stockedRows: number): void {
    this.rows.forEach((row, index) => row.setAlpha(index < stockedRows ? 1 : 0.09));
    this.rowMasks.forEach((mask, index) => mask.setAlpha(index < stockedRows ? 0 : 0.8));
    this.rowPlates.forEach((plate, index) => plate.setAlpha(index === stockedRows ? 0.96 : 0));

    if (stockedRows <= this.previousStockedRows) {
      this.previousStockedRows = stockedRows;
      return;
    }

    const rowIndex = stockedRows - 1;
    const row = this.rows[rowIndex];
    const mask = this.rowMasks[rowIndex];
    if (row) {
      row.setScale(0.76).setAlpha(1);
      this.scene.tweens.add({
        targets: row,
        scaleX: 1,
        scaleY: 1,
        duration: 360,
        ease: "Back.Out"
      });
      this.playRowSparkles(this.config.rowYs[rowIndex]);
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

  private createAmbientStock(): void {
    const { scene, config } = this;
    config.ambientPositions.forEach((x, index) => {
      const productKey = config.ambientProductKeys[index % config.ambientProductKeys.length];
      const row = index % 3;
      const sideOffset = index < config.ambientPositions.length / 2 ? -1 : 1;
      scene.add.image(x, 345 + row * 128, productKey)
        .setOrigin(0.5, 0.96)
        .setDisplaySize(76, 102)
        .setAlpha(0.78)
        .setDepth(2)
        .setAngle(sideOffset * (2 + row));
    });
  }

  private createRowPlate(y: number): Phaser.GameObjects.Graphics {
    const { scene, config } = this;
    const width = config.frameWidth * 0.54;
    const plate = scene.add.graphics().setDepth(6).setAlpha(0);
    plate.fillStyle(0xffd95e, 0.12);
    plate.fillRoundedRect(config.centreX - width / 2, y - 37, width, 74, 11);
    plate.lineStyle(4, 0xffd95e, 0.92);
    plate.strokeRoundedRect(config.centreX - width / 2, y - 37, width, 74, 11);
    return plate;
  }

  private createRestockRow(y: number, rowIndex: number): Phaser.GameObjects.Container {
    const count = Math.min(5, Math.max(4, this.config.restockItemCount));
    const spacing = 46;
    const startX = this.config.centreX - ((count - 1) * spacing) / 2;
    const objects: Phaser.GameObjects.GameObject[] = [];

    for (let index = 0; index < count; index += 1) {
      const bottle = this.scene.add.image(
        startX + index * spacing,
        y + 29,
        this.config.restockProductKey
      )
        .setOrigin(0.5, 0.96)
        .setDisplaySize(92, 118)
        .setDepth(5);
      objects.push(bottle);
    }

    return this.scene.add.container(0, 0, objects)
      .setAlpha(0.09)
      .setDepth(5)
      .setName(`beverage-cooler-row-${rowIndex}`);
  }

  private playRowSparkles(y: number): void {
    [-82, -42, 0, 42, 82].forEach((offset, index) => {
      const sparkle = this.scene.add.circle(
        this.config.centreX + offset,
        y - 5,
        4 + (index % 2),
        0xffe18a,
        0.9
      ).setDepth(8);
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
