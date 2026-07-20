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
    const top = config.backgroundY - config.frameHeight / 2;
    const left = config.centreX - config.frameWidth / 2;

    scene.add.ellipse(
      config.centreX + 12,
      config.backgroundY + config.frameHeight / 2 + 24,
      config.frameWidth * 0.94,
      54,
      0x10241f,
      0.2
    ).setDepth(-1);

    const frame = scene.add.graphics().setDepth(0).setName("beverage-cooler-base");
    frame.fillStyle(0x173b38, 1);
    frame.fillRoundedRect(left, top, config.frameWidth, config.frameHeight, 30);
    frame.lineStyle(6, 0x0f2826, 1);
    frame.strokeRoundedRect(left, top, config.frameWidth, config.frameHeight, 30);
    frame.fillStyle(0xeaf7ef, 1);
    frame.fillRoundedRect(left + 16, top + 82, config.frameWidth - 32, config.frameHeight - 108, 20);
    frame.fillStyle(0xcde9e4, 0.55);
    frame.fillRoundedRect(left + 25, top + 92, config.frameWidth - 50, config.frameHeight - 128, 16);

    const header = scene.add.graphics().setDepth(3);
    header.fillStyle(0x2f8a58, 1);
    header.fillRoundedRect(left + 18, top + 16, config.frameWidth - 36, 58, 18);
    header.lineStyle(2, 0x83c79c, 0.55);
    header.strokeRoundedRect(left + 18, top + 16, config.frameWidth - 36, 58, 18);

    scene.add.text(config.centreX, top + 37, config.departmentLabel, {
      fontFamily: "Arial",
      fontSize: "25px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setOrigin(0.5).setDepth(4);
    scene.add.text(config.centreX, top + 61, config.subtitleLabel, {
      fontFamily: "Arial",
      fontSize: "12px",
      color: "#d8f1df",
      letterSpacing: 2
    }).setOrigin(0.5).setDepth(4);

    config.rowYs.forEach((y, rowIndex) => {
      this.createShelf(y);
      this.createAmbientStock(y, rowIndex);
      const plate = this.createRowPlate(y);
      this.rowPlates.push(plate);
      this.rows.push(this.createRestockRow(y, rowIndex));
    });

    const footer = scene.add.graphics().setDepth(2);
    footer.fillStyle(0x102a28, 1);
    footer.fillRoundedRect(left + 20, top + config.frameHeight - 42, config.frameWidth - 40, 25, 10);
    [0, 1, 2, 3, 4].forEach((index) => {
      footer.fillStyle(0x50706b, 0.65);
      footer.fillRoundedRect(left + 62 + index * 64, top + config.frameHeight - 34, 42, 5, 3);
    });
  }

  sync(stockedRows: number): void {
    this.rows.forEach((row, index) => row.setAlpha(index < stockedRows ? 1 : 0.05));
    this.rowPlates.forEach((plate, index) => plate.setAlpha(index === stockedRows ? 0.95 : 0));

    if (stockedRows <= this.previousStockedRows) {
      this.previousStockedRows = stockedRows;
      return;
    }

    const row = this.rows[stockedRows - 1];
    if (row) {
      row.setScale(0.78).setAlpha(1);
      this.scene.tweens.add({
        targets: row,
        scaleX: 1,
        scaleY: 1,
        duration: 320,
        ease: "Back.Out"
      });
    }
    this.previousStockedRows = stockedRows;
  }

  private createShelf(y: number): void {
    const { scene, config } = this;
    const shelf = scene.add.graphics().setDepth(2);
    shelf.fillStyle(0x73958f, 0.34);
    shelf.fillRoundedRect(config.centreX - config.frameWidth * 0.41, y + 31, config.frameWidth * 0.82, 10, 5);
    shelf.fillStyle(0xffffff, 0.42);
    shelf.fillRoundedRect(config.centreX - config.frameWidth * 0.39, y + 29, config.frameWidth * 0.78, 3, 2);
  }

  private createRowPlate(y: number): Phaser.GameObjects.Graphics {
    const { scene, config } = this;
    const width = config.frameWidth * 0.42;
    const plate = scene.add.graphics().setDepth(3).setAlpha(0);
    plate.fillStyle(0xffd95e, 0.12);
    plate.fillRoundedRect(config.centreX - width / 2, y - 37, width, 73, 12);
    plate.lineStyle(3, 0xffd95e, 0.8);
    plate.strokeRoundedRect(config.centreX - width / 2, y - 37, width, 73, 12);
    return plate;
  }

  private createAmbientStock(y: number, rowIndex: number): void {
    const { scene, config } = this;
    const spacing = 42;
    const positions = [
      config.centreX - 156,
      config.centreX - 114,
      config.centreX - 72,
      config.centreX + 72,
      config.centreX + 114,
      config.centreX + 156
    ];

    positions.forEach((x, index) => {
      const key = config.ambientProductKeys[(rowIndex + index) % config.ambientProductKeys.length];
      this.createBottle(x, y, key, 0.88).setDepth(3);
    });

    void spacing;
  }

  private createRestockRow(y: number, rowIndex: number): Phaser.GameObjects.Container {
    const count = Math.min(5, Math.max(4, this.config.restockItemCount));
    const spacing = 38;
    const startX = this.config.centreX - ((count - 1) * spacing) / 2;
    const objects: Phaser.GameObjects.GameObject[] = [];

    for (let index = 0; index < count; index += 1) {
      const bottle = this.createBottle(startX + index * spacing, y, this.config.restockProductKey, 0.98);
      objects.push(bottle);
    }

    return this.scene.add.container(0, 0, objects)
      .setAlpha(0.05)
      .setDepth(5)
      .setName(`beverage-cooler-row-${rowIndex}`);
  }

  private createBottle(
    x: number,
    y: number,
    assetKey: string,
    scale: number
  ): Phaser.GameObjects.Container {
    const palette = this.productPalette(assetKey);
    const graphics = this.scene.add.graphics();
    graphics.fillStyle(palette.body, 1);
    graphics.fillRoundedRect(-13, -29, 26, 54, 9);
    graphics.fillStyle(palette.cap, 1);
    graphics.fillRoundedRect(-7, -38, 14, 12, 4);
    graphics.fillStyle(0xffffff, 0.92);
    graphics.fillRoundedRect(-11, -8, 22, 18, 5);
    graphics.fillStyle(palette.label, 1);
    graphics.fillRoundedRect(-7, -4, 14, 10, 3);
    graphics.fillStyle(0xffffff, 0.35);
    graphics.fillRoundedRect(-8, -24, 5, 34, 3);
    graphics.lineStyle(2, palette.outline, 0.7);
    graphics.strokeRoundedRect(-13, -29, 26, 54, 9);

    return this.scene.add.container(x, y, [graphics]).setScale(scale);
  }

  private productPalette(assetKey: string): {
    readonly body: number;
    readonly cap: number;
    readonly label: number;
    readonly outline: number;
  } {
    if (assetKey.includes("cola")) {
      return { body: 0xb92d32, cap: 0x6e171b, label: 0xf1d4b2, outline: 0x6f171b };
    }
    if (assetKey.includes("milk")) {
      return { body: 0xf1ead9, cap: 0x86a8c9, label: 0x5684ad, outline: 0xa2a69f };
    }
    return { body: 0x72c7e8, cap: 0x287ba5, label: 0xe9f8ff, outline: 0x2a7598 };
  }
}
