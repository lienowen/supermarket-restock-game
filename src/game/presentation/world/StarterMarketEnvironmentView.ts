import Phaser from "phaser";
import type { StarterMarketPresentationContext } from "../context/StarterMarketPresentationContext";
import { resolveLevelVisualPreset } from "../visual/LevelVisualPresetResolver";
import type { MarketLevelVisualPreset } from "../visual/MarketLevelVisualPreset";

export class StarterMarketEnvironmentView {
  private readonly visualPreset: MarketLevelVisualPreset;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly context: StarterMarketPresentationContext
  ) {
    this.visualPreset = resolveLevelVisualPreset(context.campaignLevel.level);
  }

  create(): void {
    if (this.context.mode === "restock") {
      this.createRestockAisle();
      this.createFloorRoute();
      this.createAtmosphere();
      return;
    }

    this.createBase();
    this.createFloor();
    this.createCeiling();
    this.createBackroom();
    this.createProduceDepartment();
    this.createModeFocus();
    this.createFloorRoute();
    this.createAtmosphere();
  }

  private createRestockAisle(): void {
    const { scene, context } = this;
    scene.add.image(
      context.world.width / 2,
      context.world.height / 2,
      context.levelAssets.environment.key
    )
      .setDisplaySize(context.world.width, context.world.height)
      .setDepth(-30)
      .setName("restock-aisle-v2-background");

    scene.add.rectangle(
      context.world.width / 2,
      context.world.height - 48,
      context.world.width,
      96,
      0x0c1713,
      0.08
    ).setDepth(-29);
  }

  private createBase(): void {
    const { scene, context } = this;
    scene.add.rectangle(context.world.width / 2, 112, context.world.width, 224, 0x17362c, 1).setDepth(-30);
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

    const trim = scene.add.graphics().setDepth(-25);
    trim.lineStyle(2, 0x8c724f, 0.2);
    [82, 545, 975, 1540].forEach((x) => trim.lineBetween(x, 166, x, 354));
    trim.fillStyle(0x284d40, 0.12);
    trim.fillRoundedRect(62, 214, 392, 86, 18);
    trim.fillRoundedRect(1045, 214, 474, 86, 18);
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

    const aisleEdges = scene.add.graphics().setDepth(-20);
    aisleEdges.lineStyle(3, 0xffffff, 0.12);
    aisleEdges.lineBetween(535, 390, 312, 900);
    aisleEdges.lineBetween(1038, 390, 1330, 900);
    aisleEdges.lineStyle(2, 0x315f38, 0.1);
    aisleEdges.lineBetween(610, 390, 495, 900);
    aisleEdges.lineBetween(965, 390, 1148, 900);
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

    const beams = scene.add.graphics().setDepth(-16);
    beams.lineStyle(5, 0x112820, 0.55);
    [320, 640, 960, 1280].forEach((x) => beams.lineBetween(x, 0, x, 92));
  }

  private createBackroom(): void {
    const { scene, context } = this;
    const x = context.world.backroomFixture.x;

    scene.add.rectangle(x, 430, 418, 430, 0x7f5a38, 0.92)
      .setStrokeStyle(7, 0x4d3423, 1)
      .setDepth(-9);
    scene.add.rectangle(x, 432, 382, 394, 0xf3eadc, 1).setDepth(-8);
    scene.add.rectangle(x, 438, 356, 374, 0x2a2b25, 0.14).setDepth(-7);

    scene.add.image(x, 590, "fixture-backroom-rack-a")
      .setOrigin(0.5, 0.96)
      .setDisplaySize(860, 760)
      .setDepth(-4)
      .setName("production-backroom-rack");

    this.createDepartmentSign(x, 190, 230, context.labels.backroom, undefined);
  }

  private createProduceDepartment(): void {
    const { scene, context } = this;

    scene.add.image(255, 735, "fixture-produce-display-a")
      .setOrigin(0.5, 0.96)
      .setDisplaySize(1000, 760)
      .setDepth(1)
      .setName("production-produce-display");

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

  private createModeFocus(): void {
    const { focus, focusSize, inactiveWashAlpha } = this.visualPreset.environment;
    const accent = this.context.mode === "checkout" ? this.context.palette.greenBright : this.context.palette.gold;

    const focusShadow = this.scene.add.ellipse(
      focus.x,
      focus.y + 45,
      focusSize.width,
      focusSize.height,
      0x1a3129,
      0.08
    ).setDepth(-12);
    focusShadow.setBlendMode(Phaser.BlendModes.MULTIPLY);

    const focusGlow = this.scene.add.ellipse(
      focus.x,
      focus.y,
      focusSize.width * 0.78,
      focusSize.height * 0.62,
      accent,
      0.055
    ).setDepth(7);
    focusGlow.setBlendMode(Phaser.BlendModes.ADD);

    const edgeWash = this.scene.add.graphics().setDepth(75);
    edgeWash.fillStyle(0x0b1713, inactiveWashAlpha);
    const leftWidth = Math.max(0, focus.x - focusSize.width / 2);
    const rightStart = Math.min(this.context.world.width, focus.x + focusSize.width / 2);
    edgeWash.fillRect(0, 118, leftWidth, this.context.world.height - 118);
    edgeWash.fillRect(rightStart, 118, this.context.world.width - rightStart, this.context.world.height - 118);
  }

  private createFloorRoute(): void {
    const route = this.scene.add.graphics().setDepth(6);
    const start = this.context.world.workerStart;
    const end = this.visualPreset.environment.focus;
    const control = {
      x: Phaser.Math.Linear(start.x, end.x, 0.5),
      y: Math.max(start.y, end.y) + 82
    };
    const dotCount = 11;

    for (let index = 0; index < dotCount; index += 1) {
      const t = index / (dotCount - 1);
      const inverse = 1 - t;
      const x = inverse * inverse * start.x + 2 * inverse * t * control.x + t * t * end.x;
      const y = inverse * inverse * start.y + 2 * inverse * t * control.y + t * t * end.y;
      const radius = 4 + t * 2;
      route.fillStyle(this.context.palette.gold, this.visualPreset.environment.routeAlpha * (0.55 + t * 0.45));
      route.fillCircle(x, y, radius);
    }

    route.fillStyle(this.context.palette.gold, this.visualPreset.environment.routeAlpha + 0.12);
    route.fillTriangle(end.x + 14, end.y, end.x - 14, end.y - 12, end.x - 14, end.y + 12);
  }

  private createAtmosphere(): void {
    const { scene, context } = this;
    scene.add.rectangle(
      context.world.width / 2,
      context.world.height / 2,
      context.world.width,
      context.world.height,
      0xffe5ad,
      0.018
    ).setDepth(80);

    const vignetteAlpha = this.visualPreset.environment.vignetteAlpha;
    scene.add.rectangle(8, context.world.height / 2, 16, context.world.height, 0x0c1a16, vignetteAlpha).setDepth(81);
    scene.add.rectangle(
      context.world.width - 8,
      context.world.height / 2,
      16,
      context.world.height,
      0x0c1a16,
      vignetteAlpha
    ).setDepth(81);
    scene.add.rectangle(context.world.width / 2, 112, context.world.width, 20, 0x07110e, vignetteAlpha * 0.7).setDepth(81);
  }
}
