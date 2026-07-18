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
    scene.add.rectangle(
      config.centreX + 10,
      config.backgroundY + 23,
      config.frameWidth + 15,
      config.frameHeight + 30,
      0x050807,
      0.38
    ).setDepth(-1);
    scene.add.rectangle(
      config.centreX,
      config.backgroundY,
      config.frameWidth,
      config.frameHeight,
      0x1d2729,
      1
    )
      .setStrokeStyle(8, 0x596366, 1)
      .setDepth(0);

    if (scene.textures.exists(config.coolerAssetKey)) {
      scene.add.image(config.centreX, config.baseY, config.coolerAssetKey)
        .setDisplaySize(config.displayWidth, config.displayHeight)
        .setDepth(1)
        .setName("beverage-cooler-base");
    }

    scene.add.rectangle(config.centreX, 117, 430, 62, 0x315f38, 1)
      .setStrokeStyle(2, 0xffffff, 0.1)
      .setDepth(4);
    scene.add.text(config.centreX, 106, config.departmentLabel, {
      fontFamily: "Arial",
      fontSize: "32px",
      color: "#f3ead7",
      fontStyle: "bold"
    }).setOrigin(0.5).setDepth(5);
    scene.add.text(config.centreX, 136, config.subtitleLabel, {
      fontFamily: "Arial",
      fontSize: "14px",
      color: "#ded6c5",
      letterSpacing: 2
    }).setOrigin(0.5).setDepth(5);

    config.rowYs.forEach((y, rowIndex) => {
      this.createAmbientStock(y, rowIndex);
      this.rows.push(this.createRestockRow(y, rowIndex));
    });

    scene.add.rectangle(config.centreX, 478, 205, 470, 0x0c1414, 0.11)
      .setStrokeStyle(2, 0xeaf6f5, 0.16)
      .setDepth(3);
  }

  sync(stockedRows: number): void {
    this.rows.forEach((row, index) => row.setAlpha(index < stockedRows ? 1 : 0.08));
    if (stockedRows <= this.previousStockedRows) {
      this.previousStockedRows = stockedRows;
      return;
    }

    const row = this.rows[stockedRows - 1];
    if (row) {
      row.setScale(0.84).setAlpha(1);
      this.scene.tweens.add({
        targets: row,
        scaleX: 1,
        scaleY: 1,
        duration: 280,
        ease: "Back.Out"
      });
    }
    this.previousStockedRows = stockedRows;
  }

  private createAmbientStock(y: number, rowIndex: number): void {
    const { scene, config } = this;
    config.ambientPositions.forEach((x, index) => {
      scene.add.image(
        x,
        y,
        config.ambientProductKeys[(rowIndex + index) % config.ambientProductKeys.length]
      )
        .setDisplaySize(24, 61)
        .setDepth(3);
    });
  }

  private createRestockRow(y: number, rowIndex: number): Phaser.GameObjects.Container {
    const objects: Phaser.GameObjects.GameObject[] = [];
    for (let index = 0; index < this.config.restockItemCount; index += 1) {
      const x = this.config.restockStartX + index * this.config.restockStepX;
      objects.push(
        this.scene.add.image(x, y, this.config.restockProductKey).setDisplaySize(25, 63)
      );
    }

    return this.scene.add.container(0, 0, objects)
      .setAlpha(0.08)
      .setDepth(5)
      .setName(`beverage-cooler-row-${rowIndex}`);
  }
}
