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
    this.createProduceIsland();
    this.createFloorRoute();
    this.createAtmosphere();
  }

  private createBase(): void {
    const { scene, context } = this;
    const backgroundKey = context.levelAssets.environment.key;
    if (scene.textures.exists(backgroundKey)) {
      scene.add.image(context.world.width / 2, context.world.height / 2, backgroundKey)
        .setDisplaySize(context.world.width, context.world.height)
        .setAlpha(0.1)
        .setTint(0xb9ad96)
        .setDepth(-30);
    }

    scene.add.rectangle(context.world.width / 2, 120, context.world.width, 240, 0x3b3933, 1).setDepth(-25);
    scene.add.rectangle(context.world.width / 2, 276, context.world.width, 312, 0x8f897d, 1).setDepth(-24);
  }

  private createFloor(): void {
    const { scene, context } = this;
    const { world, palette, visual } = context;
    const { vanishingPoint } = visual.camera;

    scene.add.polygon(world.width / 2, 600, [
      -world.width / 2, -302,
      world.width / 2, -302,
      world.width / 2, world.height - 600,
      -world.width / 2, world.height - 600
    ], palette.floor, 1).setDepth(-23);

    scene.add.polygon(world.width / 2, 605, [
      -205, -305,
      205, -305,
      555, 295,
      -555, 295
    ], palette.aisle, 0.58).setDepth(-22);

    const grid = scene.add.graphics().setDepth(-21);
    grid.lineStyle(2, 0xffffff, 0.12);
    for (let x = -160; x <= world.width + 160; x += 105) {
      grid.lineBetween(vanishingPoint.x, vanishingPoint.y, x, world.height);
    }
    [365, 430, 505, 590, 690, 805, 895].forEach((y) => {
      const progress = (y - vanishingPoint.y) / (world.height - vanishingPoint.y);
      const halfWidth = 240 + progress * 720;
      grid.lineBetween(vanishingPoint.x - halfWidth, y, vanishingPoint.x + halfWidth, y);
    });

    scene.add.polygon(1420, 610, [-260, -315, 220, -315, 180, 290, -450, 290], 0x101512, 0.25)
      .setDepth(-20);
    scene.add.polygon(170, 615, [-280, -315, 250, -315, 420, 285, -180, 285], 0x2a251d, 0.18)
      .setDepth(-20);
  }

  private createCeiling(): void {
    const { scene, context } = this;
    const beams = scene.add.graphics().setDepth(-18);
    beams.lineStyle(10, 0x25241f, 0.88);
    [34, 92, 150].forEach((y) => beams.lineBetween(0, y, context.world.width, y));
    beams.lineStyle(4, 0xbab09d, 0.34);
    for (let x = 60; x < context.world.width; x += 190) beams.lineBetween(x, 0, x + 55, 220);

    [280, 520, 800, 1060, 1335].forEach((x, index) => {
      const y = 137 + (index % 2) * 16;
      scene.add.rectangle(x, y, 44, 7, 0x151515, 1).setDepth(-16);
      scene.add.circle(x, y + 11, 10, 0xfff5d7, 0.96).setDepth(-15);
      scene.add.circle(x, y + 13, 42, 0xfff0c0, 0.045).setDepth(-17);
    });
  }

  private createBackroom(): void {
    const { scene, context } = this;
    const x = context.world.backroomFixture.x;
    scene.add.rectangle(x + 8, 386, 414, 382, 0x141512, 0.3).setDepth(-9);
    scene.add.rectangle(x, 382, 395, 370, 0x3a3933, 1)
      .setStrokeStyle(10, 0x605d55, 1)
      .setDepth(-8);
    scene.add.rectangle(x, 392, 345, 326, 0x24251f, 1).setDepth(-7);
    scene.add.polygon(x, 400, [-170, -160, 170, -160, 124, 158, -124, 158], 0x37372f, 1)
      .setDepth(-6);

    scene.add.rectangle(x, 183, 250, 52, 0x295c36, 1)
      .setStrokeStyle(2, 0xffffff, 0.12)
      .setDepth(4);
    scene.add.text(x, 183, context.labels.backroom, {
      fontFamily: "Arial",
      fontSize: "24px",
      color: "#f1ead8",
      fontStyle: "bold"
    }).setOrigin(0.5).setDepth(5);

    const rack = scene.add.graphics().setDepth(-4);
    rack.lineStyle(7, 0x333a36, 1);
    [650, 720, 800, 870].forEach((rackX) => rack.lineBetween(rackX, 282, rackX, 552));
    [328, 408, 488, 552].forEach((rackY) => rack.lineBetween(625, rackY, 895, rackY));

    const boxColors = [0xb27d45, 0x8c6138, 0xc1945b, 0x75824b, 0x9b6e40];
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 5; col += 1) {
        const boxX = 650 + col * 54;
        const boxY = 303 + row * 80;
        scene.add.rectangle(boxX + 4, boxY + 5, 45, 48, 0x000000, 0.18).setDepth(-3);
        scene.add.rectangle(boxX, boxY, 45, 48, boxColors[(row + col) % boxColors.length], 1)
          .setStrokeStyle(2, 0x4c3828, 0.82)
          .setDepth(-2);
        scene.add.rectangle(boxX, boxY - 8, 26, 3, 0xe0ba82, 0.34).setDepth(-1);
      }
    }
    scene.add.rectangle(x, 565, 310, 22, 0x161713, 0.75).setDepth(-2);
  }

  private createProduceIsland(): void {
    const { scene, context } = this;
    scene.add.rectangle(258, 177, 370, 66, 0x315f38, 1)
      .setStrokeStyle(2, 0xffffff, 0.1)
      .setDepth(4);
    scene.add.text(258, 164, context.labels.produceDepartment, {
      fontFamily: "Arial",
      fontSize: "25px",
      color: "#f3ead7",
      fontStyle: "bold"
    }).setOrigin(0.5).setDepth(5);
    scene.add.text(258, 195, context.labels.produceSubtitle, {
      fontFamily: "Arial",
      fontSize: "14px",
      color: "#ded6c5",
      letterSpacing: 2
    }).setOrigin(0.5).setDepth(5);

    const fixtures = [
      { x: 175, y: 395, width: 430, height: 118, scale: 0.78 },
      { x: 190, y: 550, width: 485, height: 132, scale: 0.9 },
      { x: 210, y: 725, width: 545, height: 148, scale: 1 }
    ];
    const palettes = [
      [0x6da747, 0x8ac653, 0x496f39],
      [0xd94c36, 0xf47a37, 0xa9342e],
      [0xe4b83e, 0xf3d45d, 0xba8a24],
      [0x5c9741, 0x78b846, 0x3f6d32]
    ];

    fixtures.forEach((fixture, fixtureIndex) => {
      scene.add.ellipse(fixture.x + 30, fixture.y + 65, fixture.width * 0.78, 42, 0x000000, 0.24)
        .setDepth(0);
      scene.add.polygon(fixture.x, fixture.y, [
        -fixture.width / 2, -fixture.height / 2,
        fixture.width / 2, -fixture.height / 2,
        fixture.width / 2 - 42, fixture.height / 2,
        -fixture.width / 2 + 42, fixture.height / 2
      ], 0x4c3928, 1).setStrokeStyle(5, 0x25231f, 1).setDepth(1);
      scene.add.polygon(fixture.x, fixture.y - 18, [
        -fixture.width / 2 + 20, -fixture.height / 2 + 12,
        fixture.width / 2 - 20, -fixture.height / 2 + 12,
        fixture.width / 2 - 55, fixture.height / 2 - 12,
        -fixture.width / 2 + 55, fixture.height / 2 - 12
      ], 0x6b4c30, 1).setDepth(2);

      for (let crate = 0; crate < 4; crate += 1) {
        const crateX = fixture.x - fixture.width * 0.31 + crate * fixture.width * 0.205;
        const colors = palettes[(fixtureIndex + crate) % palettes.length];
        scene.add.rectangle(crateX, fixture.y - 7, 88 * fixture.scale, 62 * fixture.scale, 0x2a2119, 0.72)
          .setStrokeStyle(2, 0xa77d4c, 0.6)
          .setDepth(3);
        for (let item = 0; item < 10; item += 1) {
          const row = Math.floor(item / 5);
          const col = item % 5;
          const itemX = crateX - 31 * fixture.scale + col * 15 * fixture.scale;
          const itemY = fixture.y - 20 * fixture.scale + row * 22 * fixture.scale + (col % 2) * 3;
          scene.add.ellipse(itemX, itemY, 18 * fixture.scale, 14 * fixture.scale, colors[item % colors.length], 1)
            .setStrokeStyle(1, 0xffffff, 0.16)
            .setDepth(4);
          scene.add.circle(itemX - 3, itemY - 3, 2 * fixture.scale, 0xffffff, 0.18).setDepth(5);
        }
      }
    });
  }

  private createFloorRoute(): void {
    const route = this.scene.add.graphics().setDepth(6);
    route.fillStyle(this.context.palette.gold, 0.22);
    [970, 1030, 1090].forEach((x, index) => {
      const y = 738 + index * 5;
      route.fillTriangle(x - 26, y - 13, x + 5, y, x - 26, y + 13);
    });
  }

  private createAtmosphere(): void {
    const { scene, context } = this;
    scene.add.rectangle(context.world.width / 2, context.world.height / 2, context.world.width, context.world.height, 0x17150f, 0.04)
      .setDepth(80);
    scene.add.rectangle(16, context.world.height / 2, 32, context.world.height, 0x000000, 0.18).setDepth(81);
    scene.add.rectangle(context.world.width - 16, context.world.height / 2, 32, context.world.height, 0x000000, 0.18)
      .setDepth(81);
  }
}
