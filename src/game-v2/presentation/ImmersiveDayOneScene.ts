import Phaser from "phaser";
import { RestockController, type RestockViewCopy } from "../application/RestockController";
import { DAY_ONE_CONTENT } from "../content/day01";
import type { RestockSnapshot, RestockStep } from "../domain/restock";
import { V2_ASSET_LIST, V2_ASSETS } from "../assets/manifest";
import { ImmersiveHud } from "./Hud";
import { crazyGamesPlatform } from "../../platform/crazyGamesPlatform";
import { STARTER_MARKET_LAYOUT } from "../../game/world/starterMarketLayout";
import { STARTER_MARKET_VISUAL_SPEC } from "../../game/presentation/visual/StarterMarketVisualSpec";

const COOLER_ROW_Y = STARTER_MARKET_VISUAL_SPEC.cooler.rowYs;

export class ImmersiveDayOneScene extends Phaser.Scene {
  private readonly controller = new RestockController(DAY_ONE_CONTENT.totalRows);
  private hud?: ImmersiveHud;
  private worker?: Phaser.GameObjects.Image;
  private cart?: Phaser.GameObjects.Image;
  private caseBox?: Phaser.GameObjects.Image;
  private workerShadow?: Phaser.GameObjects.Ellipse;
  private cartShadow?: Phaser.GameObjects.Ellipse;
  private target?: Phaser.GameObjects.Rectangle;
  private targetArrow?: Phaser.GameObjects.Text;
  private targetTween?: Phaser.Tweens.Tween;
  private movementUnlockTimer?: Phaser.Time.TimerEvent;
  private coolerRows: Phaser.GameObjects.Container[] = [];
  private inputLocked = false;
  private cartMoved = false;
  private previousStep?: RestockStep;
  private previousStockedRows = 0;

  constructor() {
    super("immersive-day-one");
  }

  preload(): void {
    V2_ASSET_LIST.forEach((asset) => this.load.image(asset.key, asset.path));
  }

  create(): void {
    document.body.dataset.gameScene = "game-v2";
    document.body.dataset.gameArchitecture = "architecture-v3";
    this.cameras.main.setBackgroundColor("#171712");

    this.createEnvironment();
    this.createActors();
    this.createTargeting();
    this.hud = new ImmersiveHud(this, () => this.performCurrentAction());

    this.controller.subscribe((snapshot, copy) => this.sync(snapshot, copy));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.targetTween?.stop();
      this.movementUnlockTimer?.remove(false);
    });

    crazyGamesPlatform.loadingStop();
    crazyGamesPlatform.gameplayStart();
    crazyGamesPlatform.setGameContext({
      game: "supermarket-restock",
      version: "architecture-v3",
      day: "day01",
      task: "beverage-cooler"
    });
  }

  private createEnvironment(): void {
    const { width, height } = DAY_ONE_CONTENT.world;
    const backgroundKey = V2_ASSETS.environment.salesFloor.key;

    if (this.textures.exists(backgroundKey)) {
      this.add.image(width / 2, height / 2, backgroundKey)
        .setDisplaySize(width, height)
        .setAlpha(0.1)
        .setTint(0xb9ad96)
        .setDepth(-30);
    }

    this.add.rectangle(width / 2, 120, width, 240, 0x3b3933, 1).setDepth(-25);
    this.add.rectangle(width / 2, 276, width, 312, 0x8f897d, 1).setDepth(-24);
    this.createFloor();
    this.createCeiling();
    this.createBackroom();
    this.createProduceIsland();
    this.createCoolerWall();
    this.createFloorRoute();
    this.createAtmosphere();
  }

  private createFloor(): void {
    const { width, height, palette } = {
      width: DAY_ONE_CONTENT.world.width,
      height: DAY_ONE_CONTENT.world.height,
      palette: DAY_ONE_CONTENT.palette
    };
    const vanishingX = STARTER_MARKET_VISUAL_SPEC.camera.vanishingPoint.x;
    const vanishingY = STARTER_MARKET_VISUAL_SPEC.camera.vanishingPoint.y;

    this.add.polygon(width / 2, 600, [
      -width / 2, -302,
      width / 2, -302,
      width / 2, height - 600,
      -width / 2, height - 600
    ], palette.floor, 1).setDepth(-23);

    this.add.polygon(width / 2, 605, [
      -205, -305,
      205, -305,
      555, 295,
      -555, 295
    ], palette.aisle, 0.58).setDepth(-22);

    const grid = this.add.graphics().setDepth(-21);
    grid.lineStyle(2, 0xffffff, 0.12);
    for (let x = -160; x <= width + 160; x += 105) {
      grid.lineBetween(vanishingX, vanishingY, x, height);
    }
    [365, 430, 505, 590, 690, 805, 895].forEach((y) => {
      const progress = (y - vanishingY) / (height - vanishingY);
      const halfWidth = 240 + progress * 720;
      grid.lineBetween(vanishingX - halfWidth, y, vanishingX + halfWidth, y);
    });

    this.add.polygon(1420, 610, [
      -260, -315,
      220, -315,
      180, 290,
      -450, 290
    ], 0x101512, 0.25).setDepth(-20);
    this.add.polygon(170, 615, [
      -280, -315,
      250, -315,
      420, 285,
      -180, 285
    ], 0x2a251d, 0.18).setDepth(-20);
  }

  private createCeiling(): void {
    const width = DAY_ONE_CONTENT.world.width;
    const beams = this.add.graphics().setDepth(-18);
    beams.lineStyle(10, 0x25241f, 0.88);
    [34, 92, 150].forEach((y) => beams.lineBetween(0, y, width, y));
    beams.lineStyle(4, 0xbab09d, 0.34);
    for (let x = 60; x < width; x += 190) beams.lineBetween(x, 0, x + 55, 220);

    [280, 520, 800, 1060, 1335].forEach((x, index) => {
      this.add.rectangle(x, 137 + (index % 2) * 16, 44, 7, 0x151515, 1).setDepth(-16);
      this.add.circle(x, 148 + (index % 2) * 16, 10, 0xfff5d7, 0.96).setDepth(-15);
      this.add.circle(x, 150 + (index % 2) * 16, 42, 0xfff0c0, 0.045).setDepth(-17);
    });
  }

  private createBackroom(): void {
    const placement = this.fixturePosition("backroom-rack-a");
    const x = placement.x;

    this.add.rectangle(x + 8, 386, 414, 382, 0x141512, 0.3).setDepth(-9);
    this.add.rectangle(x, 382, 395, 370, 0x3a3933, 1)
      .setStrokeStyle(10, 0x605d55, 1)
      .setDepth(-8);
    this.add.rectangle(x, 392, 345, 326, 0x24251f, 1).setDepth(-7);
    this.add.polygon(x, 400, [
      -170, -160,
      170, -160,
      124, 158,
      -124, 158
    ], 0x37372f, 1).setDepth(-6);

    this.add.rectangle(x, 183, 250, 52, 0x295c36, 1)
      .setStrokeStyle(2, 0xffffff, 0.12)
      .setDepth(4);
    this.add.text(x, 183, "STAFF ONLY", {
      fontFamily: "Arial",
      fontSize: "24px",
      color: "#f1ead8",
      fontStyle: "bold"
    }).setOrigin(0.5).setDepth(5);

    const rack = this.add.graphics().setDepth(-4);
    rack.lineStyle(7, 0x333a36, 1);
    [650, 720, 800, 870].forEach((rackX) => rack.lineBetween(rackX, 282, rackX, 552));
    [328, 408, 488, 552].forEach((rackY) => rack.lineBetween(625, rackY, 895, rackY));

    const boxColors = [0xb27d45, 0x8c6138, 0xc1945b, 0x75824b, 0x9b6e40];
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 5; col += 1) {
        const boxX = 650 + col * 54;
        const boxY = 303 + row * 80;
        this.add.rectangle(boxX + 4, boxY + 5, 45, 48, 0x000000, 0.18).setDepth(-3);
        this.add.rectangle(boxX, boxY, 45, 48, boxColors[(row + col) % boxColors.length], 1)
          .setStrokeStyle(2, 0x4c3828, 0.82)
          .setDepth(-2);
        this.add.rectangle(boxX, boxY - 8, 26, 3, 0xe0ba82, 0.34).setDepth(-1);
      }
    }

    this.add.rectangle(x, 565, 310, 22, 0x161713, 0.75).setDepth(-2);
  }

  private createProduceIsland(): void {
    this.add.rectangle(258, 177, 370, 66, 0x315f38, 1)
      .setStrokeStyle(2, 0xffffff, 0.1)
      .setDepth(4);
    this.add.text(258, 164, "FRUITS & VEGETABLES", {
      fontFamily: "Arial",
      fontSize: "25px",
      color: "#f3ead7",
      fontStyle: "bold",
      align: "center"
    }).setOrigin(0.5).setDepth(5);
    this.add.text(258, 195, "FRESH MARKET", {
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
    const producePalettes = [
      [0x6da747, 0x8ac653, 0x496f39],
      [0xd94c36, 0xf47a37, 0xa9342e],
      [0xe4b83e, 0xf3d45d, 0xba8a24],
      [0x5c9741, 0x78b846, 0x3f6d32]
    ];

    fixtures.forEach((fixture, fixtureIndex) => {
      this.add.ellipse(fixture.x + 30, fixture.y + 65, fixture.width * 0.78, 42, 0x000000, 0.24).setDepth(0);
      this.add.polygon(fixture.x, fixture.y, [
        -fixture.width / 2, -fixture.height / 2,
        fixture.width / 2, -fixture.height / 2,
        fixture.width / 2 - 42, fixture.height / 2,
        -fixture.width / 2 + 42, fixture.height / 2
      ], 0x4c3928, 1).setStrokeStyle(5, 0x25231f, 1).setDepth(1);
      this.add.polygon(fixture.x, fixture.y - 18, [
        -fixture.width / 2 + 20, -fixture.height / 2 + 12,
        fixture.width / 2 - 20, -fixture.height / 2 + 12,
        fixture.width / 2 - 55, fixture.height / 2 - 12,
        -fixture.width / 2 + 55, fixture.height / 2 - 12
      ], 0x6b4c30, 1).setDepth(2);

      for (let crate = 0; crate < 4; crate += 1) {
        const crateX = fixture.x - fixture.width * 0.31 + crate * fixture.width * 0.205;
        const colors = producePalettes[(fixtureIndex + crate) % producePalettes.length];
        this.add.rectangle(crateX, fixture.y - 7, 88 * fixture.scale, 62 * fixture.scale, 0x2a2119, 0.72)
          .setStrokeStyle(2, 0xa77d4c, 0.6)
          .setDepth(3);
        for (let item = 0; item < 10; item += 1) {
          const row = Math.floor(item / 5);
          const col = item % 5;
          const itemX = crateX - 31 * fixture.scale + col * 15 * fixture.scale;
          const itemY = fixture.y - 20 * fixture.scale + row * 22 * fixture.scale + (col % 2) * 3;
          const color = colors[item % colors.length];
          this.add.ellipse(itemX, itemY, 18 * fixture.scale, 14 * fixture.scale, color, 1)
            .setStrokeStyle(1, 0xffffff, 0.16)
            .setDepth(4);
          this.add.circle(itemX - 3, itemY - 3, 2 * fixture.scale, 0xffffff, 0.18).setDepth(5);
        }
      }
    });
  }

  private createCoolerWall(): void {
    const placement = this.fixturePosition("beverage-cooler-a");
    const coolerKey = V2_ASSETS.fixtures.beverageCooler.key;
    const coolerX = placement.x;

    this.add.rectangle(coolerX + 10, 510, 570, 690, 0x050807, 0.38).setDepth(-1);
    this.add.rectangle(coolerX, 487, 555, 660, 0x1d2729, 1)
      .setStrokeStyle(8, 0x596366, 1)
      .setDepth(0);

    if (this.textures.exists(coolerKey)) {
      this.add.image(coolerX, 495, coolerKey)
        .setDisplaySize(535, 640)
        .setDepth(1)
        .setName("v3-beverage-cooler-prototype");
    }

    this.add.rectangle(coolerX, 117, 430, 62, 0x315f38, 1)
      .setStrokeStyle(2, 0xffffff, 0.1)
      .setDepth(4);
    this.add.text(coolerX, 106, "BEVERAGES", {
      fontFamily: "Arial",
      fontSize: "32px",
      color: "#f3ead7",
      fontStyle: "bold"
    }).setOrigin(0.5).setDepth(5);
    this.add.text(coolerX, 136, "COLD DRINKS", {
      fontFamily: "Arial",
      fontSize: "14px",
      color: "#ded6c5",
      letterSpacing: 2
    }).setOrigin(0.5).setDepth(5);

    COOLER_ROW_Y.forEach((y, rowIndex) => {
      this.createAmbientCoolerStock(y, rowIndex);
      this.coolerRows.push(this.createRestockRow(y, rowIndex));
    });

    this.add.rectangle(1325, 478, 205, 470, 0x0c1414, 0.11)
      .setStrokeStyle(2, 0xeaf6f5, 0.16)
      .setDepth(3);
  }

  private createAmbientCoolerStock(y: number, rowIndex: number): void {
    const productKeys = [
      V2_ASSETS.products.colaBottle.key,
      V2_ASSETS.products.milkBottle.key,
      V2_ASSETS.products.waterBottle.key
    ];
    const positions = [
      ...STARTER_MARKET_VISUAL_SPEC.cooler.ambientLeftXs,
      ...STARTER_MARKET_VISUAL_SPEC.cooler.ambientRightXs
    ];

    positions.forEach((x, index) => {
      this.add.image(x, y, productKeys[(rowIndex + index) % productKeys.length])
        .setDisplaySize(24, 61)
        .setDepth(3);
    });
  }

  private createRestockRow(y: number, rowIndex: number): Phaser.GameObjects.Container {
    const objects: Phaser.GameObjects.GameObject[] = [];
    for (let index = 0; index < STARTER_MARKET_VISUAL_SPEC.cooler.restockItemCount; index += 1) {
      const x = STARTER_MARKET_VISUAL_SPEC.cooler.restockStartX + index * STARTER_MARKET_VISUAL_SPEC.cooler.restockStepX;
      objects.push(this.add.image(x, y, V2_ASSETS.products.colaBottle.key).setDisplaySize(25, 63));
    }
    return this.add.container(0, 0, objects)
      .setAlpha(0.08)
      .setDepth(5)
      .setName(`v3-cooler-row-${rowIndex}`);
  }

  private createFloorRoute(): void {
    const route = this.add.graphics().setDepth(6);
    route.fillStyle(STARTER_MARKET_VISUAL_SPEC.targeting.color, 0.22);
    [970, 1030, 1090].forEach((x, index) => {
      const y = 738 + index * 5;
      route.fillTriangle(x - 26, y - 13, x + 5, y, x - 26, y + 13);
    });
  }

  private createAtmosphere(): void {
    this.add.rectangle(800, 448, 1600, 900, 0x17150f, 0.04).setDepth(80).setInteractive(false);
    this.add.rectangle(16, 450, 32, 900, 0x000000, 0.18).setDepth(81).setInteractive(false);
    this.add.rectangle(1584, 450, 32, 900, 0x000000, 0.18).setDepth(81).setInteractive(false);
  }

  private createActors(): void {
    const world = DAY_ONE_CONTENT.world;
    const { actor } = STARTER_MARKET_VISUAL_SPEC;

    this.workerShadow = this.add.ellipse(
      world.workerStart.x + actor.shadowOffset.x,
      world.workerStart.y + actor.shadowOffset.y,
      210,
      48,
      0x000000,
      0.3
    ).setDepth(20);
    this.cartShadow = this.add.ellipse(world.cartStart.x, world.cartStart.y + 52, 225, 45, 0x000000, 0.24)
      .setDepth(20)
      .setVisible(false);

    this.cart = this.add.image(world.cartStart.x, world.cartStart.y, V2_ASSETS.props.cart.key)
      .setDisplaySize(270, 205)
      .setDepth(22)
      .setVisible(false)
      .setName("v3-restock-cart");

    this.worker = this.add.image(world.workerStart.x, world.workerStart.y, V2_ASSETS.characters.workerPush.key)
      .setDisplaySize(actor.pushSize.width, actor.pushSize.height)
      .setDepth(24)
      .setName("v3-worker");

    this.caseBox = this.add.image(world.backroomBox.x, world.backroomBox.y, V2_ASSETS.props.colaCase.key)
      .setDisplaySize(132, 98)
      .setDepth(23)
      .setName("v3-cola-case");
  }

  private createTargeting(): void {
    const targetColor = STARTER_MARKET_VISUAL_SPEC.targeting.color;
    this.target = this.add.rectangle(0, 0, 120, 90, targetColor, 0.055)
      .setStrokeStyle(4, targetColor, 0.96)
      .setInteractive({ useHandCursor: true })
      .setDepth(60)
      .setName("v3-interaction-target");
    this.targetArrow = this.add.text(0, 0, "▼", {
      fontFamily: "Arial",
      fontSize: "38px",
      color: "#f1c441",
      fontStyle: "bold",
      stroke: "#2f2815",
      strokeThickness: 6
    }).setOrigin(0.5).setDepth(61);

    this.target.on("pointerdown", () => this.performCurrentAction());
    this.targetTween = this.tweens.add({
      targets: [this.target, this.targetArrow],
      alpha: { from: 0.56, to: 1 },
      scaleX: { from: 0.97, to: 1.025 },
      scaleY: { from: 0.97, to: 1.025 },
      duration: 720,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut"
    });
  }

  private performCurrentAction(): void {
    if (this.inputLocked) return;
    const action = this.controller.actionForCurrentStep();
    if (!action) return;
    this.controller.dispatch(action);
  }

  private lockInputFor(maxDurationMs: number): void {
    this.inputLocked = true;
    this.movementUnlockTimer?.remove(false);
    this.movementUnlockTimer = this.time.delayedCall(maxDurationMs, () => this.unlockInput());
  }

  private unlockInput(): void {
    if (!this.inputLocked) return;
    this.inputLocked = false;
    this.movementUnlockTimer?.remove(false);
    this.movementUnlockTimer = undefined;
    this.syncTarget(this.controller.snapshot());
  }

  private sync(snapshot: RestockSnapshot, copy: RestockViewCopy): void {
    this.hud?.update(snapshot, copy);
    this.syncActors(snapshot);
    this.syncRows(snapshot);
    this.syncTarget(snapshot);

    if (snapshot.step === "complete" && this.previousStep !== "complete") {
      this.playCompletionFeedback();
      crazyGamesPlatform.reportProgress(20);
      crazyGamesPlatform.gameplayStop();
    }

    this.previousStep = snapshot.step;
    this.previousStockedRows = snapshot.stockedRows;
  }

  private syncActors(snapshot: RestockSnapshot): void {
    if (!this.worker || !this.cart || !this.caseBox || !this.workerShadow || !this.cartShadow) return;
    const world = DAY_ONE_CONTENT.world;
    const { actor } = STARTER_MARKET_VISUAL_SPEC;

    if (snapshot.step === "collect") {
      this.worker.setTexture(V2_ASSETS.characters.workerPush.key)
        .setDisplaySize(actor.pushSize.width, actor.pushSize.height)
        .setPosition(world.workerStart.x, world.workerStart.y)
        .setVisible(true);
      this.workerShadow.setPosition(
        world.workerStart.x + actor.shadowOffset.x,
        world.workerStart.y + actor.shadowOffset.y
      ).setVisible(true);
      this.cart.setVisible(false);
      this.cartShadow.setVisible(false);
      this.caseBox.setVisible(true)
        .setPosition(world.backroomBox.x, world.backroomBox.y)
        .setDisplaySize(132, 98)
        .setAngle(0);
      return;
    }

    if (snapshot.step === "load") {
      this.worker.setTexture(V2_ASSETS.characters.workerCarry.key)
        .setDisplaySize(actor.carrySize.width, actor.carrySize.height)
        .setPosition(790, 675)
        .setVisible(true);
      this.workerShadow.setPosition(795, 758).setScale(0.85).setVisible(true);
      this.cart.setTexture(V2_ASSETS.props.cart.key)
        .setDisplaySize(270, 205)
        .setPosition(world.cartStart.x + 70, world.cartStart.y + 8)
        .setVisible(true);
      this.cartShadow.setPosition(world.cartStart.x + 70, world.cartStart.y + 60).setVisible(true);
      this.caseBox.setVisible(false);
      return;
    }

    if (snapshot.step === "push") {
      this.worker.setTexture(V2_ASSETS.characters.workerPush.key)
        .setDisplaySize(actor.pushSize.width, actor.pushSize.height)
        .setPosition(world.workerStart.x, world.workerStart.y)
        .setVisible(true);
      this.workerShadow.setPosition(
        world.workerStart.x + actor.shadowOffset.x,
        world.workerStart.y + actor.shadowOffset.y
      ).setScale(1).setVisible(true);
      this.cart.setVisible(false);
      this.cartShadow.setVisible(false);
      this.caseBox.setVisible(false);
      return;
    }

    if (snapshot.step === "park" && !this.cartMoved) {
      this.cartMoved = true;
      this.lockInputFor(1350);
      this.worker.setTexture(V2_ASSETS.characters.workerPush.key)
        .setDisplaySize(actor.pushSize.width, actor.pushSize.height);
      this.cart.setVisible(false);
      this.cartShadow.setVisible(false);
      this.caseBox.setVisible(false);

      this.tweens.add({
        targets: this.worker,
        x: world.workerCooler.x,
        y: world.workerCooler.y,
        duration: 1150,
        ease: "Sine.InOut",
        onComplete: () => this.unlockInput()
      });
      this.tweens.add({
        targets: this.workerShadow,
        x: world.workerCooler.x + actor.shadowOffset.x,
        y: world.workerCooler.y + actor.shadowOffset.y,
        duration: 1150,
        ease: "Sine.InOut"
      });
      return;
    }

    if (["open", "restock", "complete"].includes(snapshot.step)) {
      this.unlockInput();
      this.worker.setPosition(world.workerCooler.x, world.workerCooler.y)
        .setTexture(V2_ASSETS.characters.workerPush.key)
        .setDisplaySize(240, 360)
        .setVisible(true);
      this.workerShadow.setPosition(world.workerCooler.x + 8, world.workerCooler.y + 82).setScale(0.95).setVisible(true);
      this.cart.setVisible(false);
      this.cartShadow.setVisible(false);
      this.caseBox.setVisible(snapshot.step !== "complete")
        .setPosition(world.cartCooler.x + 18, world.cartCooler.y - 84)
        .setDisplaySize(112, 82)
        .setAngle(snapshot.boxOpened ? -8 : 0);
    }
  }

  private syncRows(snapshot: RestockSnapshot): void {
    this.coolerRows.forEach((row, index) => row.setAlpha(index < snapshot.stockedRows ? 1 : 0.08));

    if (snapshot.stockedRows > this.previousStockedRows) {
      const row = this.coolerRows[snapshot.stockedRows - 1];
      if (row) {
        row.setScale(0.84).setAlpha(1);
        this.tweens.add({
          targets: row,
          scaleX: 1,
          scaleY: 1,
          duration: 280,
          ease: "Back.Out"
        });
      }
    }
  }

  private syncTarget(snapshot: RestockSnapshot): void {
    if (!this.target || !this.targetArrow) return;
    if (snapshot.step === "complete") {
      this.target.setVisible(false).disableInteractive();
      this.targetArrow.setVisible(false);
      return;
    }

    this.target.setVisible(true);
    this.targetArrow.setVisible(true);
    const world = DAY_ONE_CONTENT.world;
    let x = world.backroomBox.x;
    let y = world.backroomBox.y;
    let width = 150;
    let height = 112;

    switch (snapshot.step) {
      case "collect":
        break;
      case "load":
      case "push":
        x = world.cartStart.x + 35;
        y = world.cartStart.y;
        width = 270;
        height = 230;
        break;
      case "park":
        x = world.cartCooler.x;
        y = world.cartCooler.y;
        width = 280;
        height = 230;
        break;
      case "open":
        x = world.cartCooler.x + 18;
        y = world.cartCooler.y - 84;
        width = 150;
        height = 108;
        break;
      case "restock": {
        const rowIndex = Math.min(snapshot.stockedRows, snapshot.totalRows - 1);
        x = STARTER_MARKET_VISUAL_SPEC.cooler.centre.x;
        y = COOLER_ROW_Y[rowIndex];
        width = STARTER_MARKET_VISUAL_SPEC.cooler.activeStockBounds.width;
        height = 68;
        break;
      }
    }

    this.target.setPosition(x, y).setSize(width, height).setDisplaySize(width, height);
    this.targetArrow.setPosition(x, y - height / 2 - STARTER_MARKET_VISUAL_SPEC.targeting.arrowOffsetY);
    this.target.disableInteractive();
    if (!this.inputLocked) this.target.setInteractive({ useHandCursor: true });
  }

  private playCompletionFeedback(): void {
    const { palette } = DAY_ONE_CONTENT;
    const banner = this.add.rectangle(800, 430, 610, 142, 0x09100c, 0.95)
      .setStrokeStyle(4, palette.gold, 1)
      .setDepth(120)
      .setScale(0.82);
    const title = this.add.text(800, 407, "COOLER FULLY STOCKED", {
      fontFamily: "Arial",
      fontSize: "32px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setOrigin(0.5).setDepth(121);
    const reward = this.add.text(800, 457, "+1 STAR   +100 COINS", {
      fontFamily: "Arial",
      fontSize: "21px",
      color: "#f1c441",
      fontStyle: "bold"
    }).setOrigin(0.5).setDepth(121);

    [banner, title, reward].forEach((object) => object.setAlpha(0));
    this.tweens.add({
      targets: [banner, title, reward],
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 420,
      ease: "Back.Out"
    });

    for (let i = 0; i < 22; i += 1) {
      const sparkle = this.add.circle(1325, 490, 3 + (i % 4), i % 2 === 0 ? palette.gold : 0xffffff, 1)
        .setDepth(90);
      this.tweens.add({
        targets: sparkle,
        x: 1130 + Math.random() * 390,
        y: 220 + Math.random() * 500,
        alpha: 0,
        duration: 850 + Math.random() * 650,
        ease: "Cubic.Out",
        onComplete: () => sparkle.destroy()
      });
    }
  }

  private fixturePosition(fixtureId: string): { x: number; y: number } {
    const fixture = STARTER_MARKET_LAYOUT.fixtures.find((entry) => entry.fixtureId === fixtureId);
    if (!fixture) throw new Error(`Missing starter market fixture placement: ${fixtureId}`);
    return fixture.position;
  }
}
