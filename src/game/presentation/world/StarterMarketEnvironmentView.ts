import Phaser from "phaser";
import type { StarterMarketPresentationContext } from "../context/StarterMarketPresentationContext";

export class StarterMarketEnvironmentView {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly context: StarterMarketPresentationContext
  ) {}

  create(): void {
    this.createBase();
    this.createFloor();
    this.createCeiling();
    this.createBackroom();
    this.createProduceDepartment();
    this.createFloorRoute();
    this.createAtmosphere();
  }

  private createBase(): void {
    const { scene, context } = this;
    scene.add.rectangle(context.world.width / 2, 112, context.world.width, 224, 0x18352c, 1).setDepth(-30);
    scene.add.rectangle(context.world.width / 2, 252, context.world.width, 280, 0xf1e5d2, 1).setDepth(-29);
    scene.add.rectangle(context.world.width / 2, 362, context.world.width, 18, 0xb88a57, 1).setDepth(-28);
    scene.add.rectangle(context.world.width / 2, 374, context.world.width, 8, 0x6e4b2f, 0.72).setDepth(-27);

    const wall = scene.add.graphics().setDepth(-26);
    wall.fillStyle(0xffffff, 0.17);
    wall.fillRoundedRect(28, 172, 470, 154, 28);
    wall.fillRoundedRect(515, 172, 470, 154, 28);
    wall.fillRoundedRect(1002, 172, 570, 154, 28);
    wall.lineStyle(3, 0xcbb99b, 0.38);
    wall.strokeRoundedRect(28, 172, 470, 154, 28);
    wall.strokeRoundedRect(515, 172, 470, 154, 28);
    wall.strokeRoundedRect(1002, 172, 570, 154, 28);
  }

  private createFloor(): void {
    const { scene, context } = this;
    const { world, palette, visual } = context;
    const { vanishingPoint } = visual.camera;

    scene.add.rectangle(world.width / 2, 630, world.width, 540, 0xc7baa6, 1).setDepth(-24);
    scene.add.polygon(world.width / 2, 622, [
      -250, -275,
      250, -275,
      650, 278,
      -650, 278
    ], palette.aisle, 0.76).setDepth(-23);

    const tiles = scene.add.graphics().setDepth(-22);
    tiles.lineStyle(2, 0x6f695f, 0.17);
    for (let x = -100; x <= world.width + 100; x += 170) {
      tiles.lineBetween(vanishingPoint.x, vanishingPoint.y, x, world.height);
    }
    [420, 505, 605, 720, 850].forEach((y) => {
      const progress = (y - vanishingPoint.y) / (world.height - vanishingPoint.y);
      const halfWidth = 280 + progress * 650;
      tiles.lineBetween(vanishingPoint.x - halfWidth, y, vanishingPoint.x + halfWidth, y);
    });

    scene.add.ellipse(780, 810, 520, 82, 0x263d35, 0.07).setDepth(-21);
    scene.add.ellipse(245, 812, 530, 74, 0x5c422d, 0.1).setDepth(-21);
    scene.add.ellipse(1320, 814, 500, 76, 0x23463e, 0.1).setDepth(-21);
  }

  private createCeiling(): void {
    const { scene, context } = this;
    scene.add.rectangle(context.world.width / 2, 42, context.world.width, 84, 0x0e211c, 1).setDepth(-18);
    scene.add.rectangle(context.world.width / 2, 91, context.world.width, 18, 0x24483c, 1).setDepth(-17);

    [160, 475, 790, 1105, 1420].forEach((x) => {
      scene.add.ellipse(x, 124, 170, 30, 0xffe9aa, 0.13).setDepth(-16);
      scene.add.rectangle(x, 111, 92, 11, 0xe9d3a3, 1).setDepth(-15);
      scene.add.rectangle(x, 115, 66, 5, 0xfff8dd, 1).setDepth(-14);
    });
  }

  private createBackroom(): void {
    const { scene, context } = this;
    const x = context.world.backroomFixture.x;

    scene.add.rectangle(x, 430, 418, 430, 0x7f5a38, 0.92)
      .setStrokeStyle(7, 0x4d3423, 1)
      .setDepth(-9);
    scene.add.rectangle(x, 432, 382, 394, 0xf3eadc, 1).setDepth(-8);
    scene.add.rectangle(x, 438, 356, 374, 0x2a2b25, 0.14).setDepth(-7);

    const rack = scene.add.image(x, 560, "fixture-backroom-rack-a")
      .setOrigin(0.5, 0.96)
      .setDisplaySize(360, 360)
      .setDepth(-4)
      .setName("production-backroom-rack");
    rack.setTint(0xfff9ee);

    this.createDepartmentSign(x, 190, 230, context.labels.backroom, undefined);

    scene.add.rectangle(x - 112, 300, 130, 9, 0xffd36a, 0.14).setDepth(-3);
    scene.add.rectangle(x + 88, 300, 86, 9, 0xffd36a, 0.1).setDepth(-3);
  }

  private createProduceDepartment(): void {
    const { scene, context } = this;

    const produce = scene.add.image(255, 708, "fixture-produce-display-a")
      .setOrigin(0.5, 0.96)
      .setDisplaySize(510, 510)
      .setDepth(1)
      .setName("production-produce-display");
    produce.setTint(0xfffbf4);

    this.createDepartmentSign(
      242,
      192,
      390,
      context.labels.produceDepartment,
      context.labels.produceSubtitle
    );

    const poster = scene.add.graphics().setDepth(-2);
    poster.fillStyle(0xf5ecd9, 1);
    poster.fillRoundedRect(424, 242, 82, 112, 12);
    poster.lineStyle(3, 0x8d6a43, 0.72);
    poster.strokeRoundedRect(424, 242, 82, 112, 12);
    scene.add.text(465, 270, "FRESH", {
      fontFamily: "Arial",
      fontSize: "15px",
      color: "#315f38",
      fontStyle: "bold"
    }).setOrigin(0.5).setDepth(-1);
    scene.add.text(465, 305, "QUALITY\nDAILY", {
      fontFamily: "Arial",
      fontSize: "13px",
      color: "#6a563e",
      align: "center",
      lineSpacing: 2
    }).setOrigin(0.5).setDepth(-1);
  }

  private createDepartmentSign(
    centreX: number,
    centreY: number,
    width: number,
    titleText: string,
    subtitleText?: string
  ): void {
    const sign = this.scene.add.graphics().setDepth(4);
    sign.fillStyle(0x276f42, 1);
    sign.fillRoundedRect(centreX - width / 2, centreY - 31, width, 62, 17);
    sign.lineStyle(3, 0x8fcaa1, 0.54);
    sign.strokeRoundedRect(centreX - width / 2, centreY - 31, width, 62, 17);
    this.scene.add.text(centreX, centreY - (subtitleText ? 9 : 0), titleText, {
      fontFamily: "Arial",
      fontSize: subtitleText ? "22px" : "21px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setOrigin(0.5).setDepth(5);
    if (subtitleText) {
      this.scene.add.text(centreX, centreY + 17, subtitleText, {
        fontFamily: "Arial",
        fontSize: "12px",
        color: "#d9f0df",
        letterSpacing: 2
      }).setOrigin(0.5).setDepth(5);
    }
  }

  private createFloorRoute(): void {
    const route = this.scene.add.graphics().setDepth(6);
    route.lineStyle(5, this.context.palette.gold, 0.42);
    route.beginPath();
    route.moveTo(930, 718);
    route.lineTo(1000, 735);
    route.lineTo(1075, 725);
    route.strokePath();
    route.fillStyle(this.context.palette.gold, 0.48);
    route.fillTriangle(1088, 725, 1058, 708, 1058, 742);
  }

  private createAtmosphere(): void {
    const { scene, context } = this;
    scene.add.rectangle(
      context.world.width / 2,
      context.world.height / 2,
      context.world.width,
      context.world.height,
      0xffe5ad,
      0.035
    ).setDepth(80);
    scene.add.rectangle(8, context.world.height / 2, 16, context.world.height, 0x17342c, 0.14).setDepth(81);
    scene.add.rectangle(
      context.world.width - 8,
      context.world.height / 2,
      16,
      context.world.height,
      0x17342c,
      0.14
    ).setDepth(81);
  }
}
