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
    scene.add.rectangle(context.world.width / 2, 110, context.world.width, 220, 0x244238, 1).setDepth(-30);
    scene.add.rectangle(context.world.width / 2, 245, context.world.width, 270, 0xf1e7d2, 1).setDepth(-29);
    scene.add.rectangle(context.world.width / 2, 357, context.world.width, 18, 0xd3b98e, 1).setDepth(-28);

    const wall = scene.add.graphics().setDepth(-27);
    wall.fillStyle(0xffffff, 0.22);
    wall.fillRoundedRect(34, 176, 455, 145, 26);
    wall.fillRoundedRect(525, 176, 455, 145, 26);
    wall.fillRoundedRect(1016, 176, 550, 145, 26);
    wall.lineStyle(3, 0xcbbd9e, 0.45);
    wall.strokeRoundedRect(34, 176, 455, 145, 26);
    wall.strokeRoundedRect(525, 176, 455, 145, 26);
    wall.strokeRoundedRect(1016, 176, 550, 145, 26);
  }

  private createFloor(): void {
    const { scene, context } = this;
    const { world, palette, visual } = context;
    const { vanishingPoint } = visual.camera;

    scene.add.rectangle(world.width / 2, 628, world.width, 544, palette.floor, 1).setDepth(-24);
    scene.add.polygon(world.width / 2, 622, [
      -250, -275,
      250, -275,
      650, 278,
      -650, 278
    ], palette.aisle, 0.72).setDepth(-23);

    const tiles = scene.add.graphics().setDepth(-22);
    tiles.lineStyle(2, 0x8d877a, 0.13);
    for (let x = -100; x <= world.width + 100; x += 180) {
      tiles.lineBetween(vanishingPoint.x, vanishingPoint.y, x, world.height);
    }
    [420, 510, 620, 750, 890].forEach((y) => {
      const progress = (y - vanishingPoint.y) / (world.height - vanishingPoint.y);
      const halfWidth = 280 + progress * 650;
      tiles.lineBetween(vanishingPoint.x - halfWidth, y, vanishingPoint.x + halfWidth, y);
    });

    scene.add.ellipse(790, 780, 500, 90, 0x284239, 0.07).setDepth(-21);
    scene.add.ellipse(250, 804, 520, 74, 0x62482e, 0.09).setDepth(-21);
    scene.add.ellipse(1325, 805, 470, 74, 0x244c46, 0.1).setDepth(-21);
  }

  private createCeiling(): void {
    const { scene, context } = this;
    const ceiling = scene.add.graphics().setDepth(-18);
    ceiling.fillStyle(0x19332b, 1);
    ceiling.fillRect(0, 0, context.world.width, 82);
    ceiling.fillStyle(0x2f594b, 0.9);
    ceiling.fillRect(0, 82, context.world.width, 18);

    [190, 500, 810, 1120, 1430].forEach((x) => {
      scene.add.ellipse(x, 126, 150, 24, 0xf6e6b8, 0.12).setDepth(-17);
      scene.add.rectangle(x, 112, 88, 10, 0xe8d8ae, 1).setDepth(-16);
      scene.add.rectangle(x, 116, 62, 5, 0xfff5d7, 0.96).setDepth(-15);
    });
  }

  private createBackroom(): void {
    const { scene, context } = this;
    const x = context.world.backroomFixture.x;
    const frame = scene.add.graphics().setDepth(-8);
    frame.fillStyle(0x9f7548, 1);
    frame.fillRoundedRect(x - 190, 210, 380, 390, 24);
    frame.lineStyle(6, 0x5f432b, 1);
    frame.strokeRoundedRect(x - 190, 210, 380, 390, 24);
    frame.fillStyle(0xf4ead8, 1);
    frame.fillRoundedRect(x - 166, 238, 332, 328, 16);

    const sign = scene.add.graphics().setDepth(4);
    sign.fillStyle(0x2f8a58, 1);
    sign.fillRoundedRect(x - 105, 168, 210, 48, 16);
    sign.lineStyle(2, 0xbce0c8, 0.45);
    sign.strokeRoundedRect(x - 105, 168, 210, 48, 16);
    scene.add.text(x, 192, context.labels.backroom, {
      fontFamily: "Arial",
      fontSize: "21px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setOrigin(0.5).setDepth(5);

    const rack = scene.add.graphics().setDepth(-4);
    rack.fillStyle(0x6d5038, 1);
    rack.fillRoundedRect(x - 136, 265, 272, 266, 12);
    rack.fillStyle(0x3f3025, 1);
    [324, 402, 480].forEach((shelfY) => rack.fillRoundedRect(x - 128, shelfY, 256, 12, 5));
    rack.fillRoundedRect(x - 128, 258, 12, 280, 5);
    rack.fillRoundedRect(x + 116, 258, 12, 280, 5);

    const boxColors = [0xe0a15d, 0xc48345, 0xf0bd74, 0x78a36d, 0xd39555];
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        const boxX = x - 92 + col * 60;
        const boxY = 295 + row * 78;
        scene.add.rectangle(boxX + 3, boxY + 4, 48, 48, 0x443124, 0.18).setDepth(-2);
        scene.add.rectangle(boxX, boxY, 48, 48, boxColors[(row + col) % boxColors.length], 1)
          .setStrokeStyle(3, 0x765031, 0.62)
          .setDepth(-1);
        scene.add.rectangle(boxX, boxY - 7, 26, 4, 0xf7d89e, 0.55).setDepth(0);
      }
    }
  }

  private createProduceIsland(): void {
    const { scene, context } = this;
    const sign = scene.add.graphics().setDepth(4);
    sign.fillStyle(0x2f8a58, 1);
    sign.fillRoundedRect(62, 168, 360, 58, 18);
    sign.lineStyle(2, 0xbce0c8, 0.42);
    sign.strokeRoundedRect(62, 168, 360, 58, 18);
    scene.add.text(242, 187, context.labels.produceDepartment, {
      fontFamily: "Arial",
      fontSize: "22px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setOrigin(0.5).setDepth(5);
    scene.add.text(242, 210, context.labels.produceSubtitle, {
      fontFamily: "Arial",
      fontSize: "12px",
      color: "#d8f1df",
      letterSpacing: 2
    }).setOrigin(0.5).setDepth(5);

    const fixtures = [
      { x: 210, y: 480, width: 390, height: 142, scale: 0.92 },
      { x: 235, y: 690, width: 460, height: 158, scale: 1.08 }
    ];
    const palettes = [
      [0x74b64c, 0x9dcc5b, 0x4d873a],
      [0xf06643, 0xe43f34, 0xff8a4b],
      [0xf2c94c, 0xffdc62, 0xd9a72c],
      [0x6ba94b, 0x4d8c3c, 0x91c85d]
    ];

    fixtures.forEach((fixture, fixtureIndex) => {
      scene.add.ellipse(fixture.x + 18, fixture.y + 78, fixture.width * 0.82, 44, 0x49372a, 0.16).setDepth(0);
      scene.add.polygon(fixture.x, fixture.y, [
        -fixture.width / 2, -fixture.height / 2,
        fixture.width / 2, -fixture.height / 2,
        fixture.width / 2 - 44, fixture.height / 2,
        -fixture.width / 2 + 44, fixture.height / 2
      ], 0x9b6c3f, 1).setStrokeStyle(5, 0x654429, 1).setDepth(1);
      scene.add.polygon(fixture.x, fixture.y - 18, [
        -fixture.width / 2 + 18, -fixture.height / 2 + 12,
        fixture.width / 2 - 18, -fixture.height / 2 + 12,
        fixture.width / 2 - 54, fixture.height / 2 - 12,
        -fixture.width / 2 + 54, fixture.height / 2 - 12
      ], 0xd8a663, 1).setDepth(2);

      for (let crate = 0; crate < 4; crate += 1) {
        const crateX = fixture.x - fixture.width * 0.31 + crate * fixture.width * 0.205;
        const colors = palettes[(fixtureIndex + crate) % palettes.length];
        scene.add.rectangle(crateX, fixture.y - 8, 82 * fixture.scale, 58 * fixture.scale, 0x6a4a31, 0.88)
          .setStrokeStyle(2, 0xe2ba82, 0.52)
          .setDepth(3);
        for (let item = 0; item < 7; item += 1) {
          const row = Math.floor(item / 4);
          const col = item % 4;
          const itemX = crateX - 25 * fixture.scale + col * 17 * fixture.scale;
          const itemY = fixture.y - 22 * fixture.scale + row * 24 * fixture.scale + (col % 2) * 3;
          scene.add.circle(itemX, itemY, 9 * fixture.scale, colors[item % colors.length], 1)
            .setStrokeStyle(2, 0xffffff, 0.2)
            .setDepth(4);
          scene.add.circle(itemX - 3, itemY - 3, 2 * fixture.scale, 0xffffff, 0.38).setDepth(5);
        }
      }
    });
  }

  private createFloorRoute(): void {
    const route = this.scene.add.graphics().setDepth(6);
    route.fillStyle(this.context.palette.gold, 0.16);
    [970, 1028, 1086].forEach((x, index) => {
      const y = 750 + index * 3;
      route.fillTriangle(x - 18, y - 10, x + 3, y, x - 18, y + 10);
    });
  }

  private createAtmosphere(): void {
    const { scene, context } = this;
    scene.add.rectangle(
      context.world.width / 2,
      context.world.height / 2,
      context.world.width,
      context.world.height,
      0xffe9b5,
      0.025
    ).setDepth(80);
    scene.add.rectangle(8, context.world.height / 2, 16, context.world.height, 0x17342c, 0.15).setDepth(81);
    scene.add.rectangle(
      context.world.width - 8,
      context.world.height / 2,
      16,
      context.world.height,
      0x17342c,
      0.15
    ).setDepth(81);
  }
}
