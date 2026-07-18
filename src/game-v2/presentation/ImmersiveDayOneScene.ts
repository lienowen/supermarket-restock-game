import Phaser from "phaser";
import { RestockController, type RestockViewCopy } from "../application/RestockController";
import { DAY_ONE_CONTENT } from "../content/day01";
import type { RestockSnapshot, RestockStep } from "../domain/restock";
import { V2_ASSET_LIST, V2_ASSETS } from "../assets/manifest";
import { ImmersiveHud } from "./Hud";
import { crazyGamesPlatform } from "../../platform/crazyGamesPlatform";

export class ImmersiveDayOneScene extends Phaser.Scene {
  private readonly controller = new RestockController(DAY_ONE_CONTENT.totalRows);
  private hud?: ImmersiveHud;
  private worker?: Phaser.GameObjects.Image;
  private cart?: Phaser.GameObjects.Image;
  private caseBox?: Phaser.GameObjects.Image;
  private target?: Phaser.GameObjects.Rectangle;
  private targetArrow?: Phaser.GameObjects.Text;
  private targetTween?: Phaser.Tweens.Tween;
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
    document.body.dataset.gameArchitecture = "immersive-v2";
    this.cameras.main.setBackgroundColor("#171712");

    this.createEnvironment();
    this.createActors();
    this.createTargeting();
    this.hud = new ImmersiveHud(this, () => this.performCurrentAction());

    this.controller.subscribe((snapshot, copy) => this.sync(snapshot, copy));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.targetTween?.stop());

    crazyGamesPlatform.loadingStop();
    crazyGamesPlatform.gameplayStart();
    crazyGamesPlatform.setGameContext({
      game: "supermarket-restock",
      version: "immersive-v2",
      day: "day01",
      task: "beverage-cooler"
    });
  }

  private createEnvironment(): void {
    const { palette } = DAY_ONE_CONTENT;
    const backgroundKey = V2_ASSETS.environment.salesFloor.key;

    if (this.textures.exists(backgroundKey)) {
      this.add.image(768, 512, backgroundKey)
        .setDisplaySize(1536, 1024)
        .setAlpha(0.16)
        .setTint(0xb6a98d)
        .setDepth(-20);
    }

    this.add.rectangle(768, 120, 1536, 240, 0x413b31, 1).setDepth(-15);
    this.add.rectangle(768, 250, 1536, 260, 0x6c6558, 1).setDepth(-14);
    this.add.polygon(768, 682, [
      -768, -300,
      768, -300,
      768, 342,
      -768, 342
    ], palette.floor, 1).setDepth(-13);

    const perspective = this.add.graphics().setDepth(-12);
    perspective.lineStyle(2, 0xffffff, 0.12);
    for (let x = -100; x <= 1636; x += 120) {
      perspective.lineBetween(768, 340, x, 1024);
    }
    for (let y = 430; y <= 1000; y += 92) {
      const width = 510 + (y - 430) * 1.8;
      perspective.lineBetween(768 - width, y, 768 + width, y);
    }

    this.createCeiling();
    this.createBackroom();
    this.createProduceIsland();
    this.createCoolerWall();
    this.createFloorRoute();
  }

  private createCeiling(): void {
    const beams = this.add.graphics().setDepth(-10);
    beams.lineStyle(10, 0x2b2925, 0.82);
    beams.lineBetween(0, 34, 1536, 34);
    beams.lineBetween(0, 105, 1536, 105);
    beams.lineBetween(0, 176, 1536, 176);
    beams.lineStyle(4, 0xb4aa95, 0.38);
    for (let x = 80; x < 1536; x += 210) beams.lineBetween(x, 0, x + 45, 225);

    [320, 520, 820, 1030, 1300].forEach((x, index) => {
      this.add.rectangle(x, 143 + (index % 2) * 18, 48, 8, 0x171717, 1).setDepth(-8);
      this.add.circle(x, 153 + (index % 2) * 18, 10, 0xfbf4dc, 0.95).setDepth(-7);
    });
  }

  private createBackroom(): void {
    this.add.rectangle(690, 390, 355, 355, 0x302e29, 1)
      .setStrokeStyle(8, 0x5c584f, 1)
      .setDepth(-5);
    this.add.rectangle(690, 395, 315, 310, 0x504b40, 1).setDepth(-4);
    this.add.rectangle(690, 232, 245, 58, 0x244e31, 1).setDepth(2);
    this.add.text(690, 232, "STAFF ONLY", {
      fontFamily: "Arial",
      fontSize: "25px",
      color: "#e7eadc",
      fontStyle: "bold"
    }).setOrigin(0.5).setDepth(3);

    const rack = this.add.graphics().setDepth(-2);
    rack.lineStyle(8, 0x353b38, 1);
    [575, 660, 745, 830].forEach((x) => rack.lineBetween(x, 270, x, 560));
    [330, 415, 500].forEach((y) => rack.lineBetween(555, y, 850, y));

    const boxColors = [0xa47442, 0x8a653d, 0xb28855, 0x6d7c48];
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 5; col += 1) {
        this.add.rectangle(585 + col * 58, 303 + row * 84, 48, 51, boxColors[(row + col) % boxColors.length], 1)
          .setStrokeStyle(2, 0x4e3b29, 0.85)
          .setDepth(-1);
      }
    }
  }

  private createProduceIsland(): void {
    this.add.rectangle(205, 207, 325, 78, 0x365d2e, 1).setDepth(2);
    this.add.text(205, 193, "FRUITS & VEGETABLES", {
      fontFamily: "Arial",
      fontSize: "25px",
      color: "#f0e6cf",
      fontStyle: "bold",
      align: "center"
    }).setOrigin(0.5).setDepth(3);
    this.add.text(205, 225, "FRESH MARKET", {
      fontFamily: "Arial",
      fontSize: "15px",
      color: "#e4ddc9"
    }).setOrigin(0.5).setDepth(3);

    const fixtures = [
      { y: 420, width: 430 },
      { y: 585, width: 480 },
      { y: 755, width: 520 }
    ];
    const produceColors = [0x6fa842, 0xc84d3a, 0xe7be45, 0x4f7d3d, 0xd57f36];

    fixtures.forEach((fixture, fixtureIndex) => {
      this.add.polygon(230, fixture.y, [
        -fixture.width / 2, -55,
        fixture.width / 2, -55,
        fixture.width / 2 - 38, 58,
        -fixture.width / 2 + 38, 58
      ], 0x4a3c2d, 1).setStrokeStyle(4, 0x25231f, 1).setDepth(1);

      for (let i = 0; i < 15; i += 1) {
        const row = Math.floor(i / 5);
        const col = i % 5;
        const x = 75 + col * 68 + fixtureIndex * 5;
        const y = fixture.y - 36 + row * 28;
        this.add.ellipse(x, y, 42, 28, produceColors[(i + fixtureIndex) % produceColors.length], 1)
          .setStrokeStyle(1, 0xffffff, 0.12)
          .setDepth(2);
      }
    });
  }

  private createCoolerWall(): void {
    const { palette } = DAY_ONE_CONTENT;
    this.add.rectangle(1260, 478, 555, 700, palette.cooler, 1)
      .setStrokeStyle(10, 0x646c6f, 1)
      .setDepth(0);
    this.add.rectangle(1260, 155, 555, 88, 0x365d2e, 1).setDepth(3);
    this.add.text(1134, 121, "BEVERAGES", {
      fontFamily: "Arial",
      fontSize: "37px",
      color: "#f0e6cf",
      fontStyle: "bold"
    }).setDepth(4);
    this.add.text(1138, 164, "COLD DRINKS", {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#e8dfca"
    }).setDepth(4);

    this.add.rectangle(1260, 250, 522, 16, palette.coolerLight, 0.92).setDepth(2);
    this.add.rectangle(1260, 520, 522, 16, palette.coolerLight, 0.78).setDepth(2);

    [1012, 1180, 1348, 1510].forEach((x) => {
      this.add.rectangle(x, 510, 9, 620, 0xa7aeb0, 0.9).setDepth(4);
    });

    const shelfYs = [320, 405, 490, 575, 660, 745];
    shelfYs.forEach((y, rowIndex) => {
      this.add.rectangle(1260, y + 35, 510, 9, 0xa7aeb0, 1).setDepth(4);
      this.createAmbientCoolerStock(y, rowIndex);
      this.coolerRows.push(this.createRestockRow(y, rowIndex));
    });
  }

  private createAmbientCoolerStock(y: number, rowIndex: number): void {
    const colors = [0xc74435, 0x2d7b45, 0xe58a27, 0x3273a8, 0x26312b];
    const positions = [1035, 1070, 1105, 1395, 1430, 1465, 1500];
    positions.forEach((x, index) => {
      const color = colors[(rowIndex + index) % colors.length];
      this.add.rectangle(x, y, 22, 58, color, 1)
        .setStrokeStyle(1, 0xffffff, 0.2)
        .setDepth(3);
      this.add.rectangle(x, y - 34, 11, 9, 0xe8e3d6, 1).setDepth(3);
      this.add.rectangle(x, y + 4, 16, 13, 0xf4eee0, 0.82).setDepth(4);
    });
  }

  private createRestockRow(y: number, rowIndex: number): Phaser.GameObjects.Container {
    const objects: Phaser.GameObjects.GameObject[] = [];
    for (let index = 0; index < 6; index += 1) {
      const x = 1140 + index * 39;
      const bottle = this.add.rectangle(x, y, 25, 60, rowIndex % 2 === 0 ? 0xb93329 : 0x9d2d27, 1)
        .setStrokeStyle(1, 0xffffff, 0.22);
      const cap = this.add.rectangle(x, y - 35, 12, 9, 0xe9e3d8, 1);
      const label = this.add.rectangle(x, y + 3, 18, 14, 0xf4eee2, 0.9);
      objects.push(bottle, cap, label);
    }
    return this.add.container(0, 0, objects).setAlpha(0.12).setDepth(5).setName(`v2-cooler-row-${rowIndex}`);
  }

  private createFloorRoute(): void {
    this.add.polygon(865, 790, [0, -24, 92, 0, 0, 24, 18, 7, -112, 7, -112, -7, 18, -7], 0xf5c64d, 0.9)
      .setAngle(-4)
      .setDepth(7);
    this.add.text(810, 824, "RESTOCK ROUTE", {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#8d6d12",
      fontStyle: "bold"
    }).setAngle(-4).setDepth(8);
  }

  private createActors(): void {
    const world = DAY_ONE_CONTENT.world;

    this.cart = this.add.image(world.cartStart.x, world.cartStart.y, V2_ASSETS.props.cart.key)
      .setDisplaySize(210, 210)
      .setDepth(22)
      .setName("v2-restock-cart");

    this.worker = this.add.image(world.workerStart.x, world.workerStart.y, V2_ASSETS.characters.workerPush.key)
      .setDisplaySize(170, 260)
      .setDepth(24)
      .setName("v2-worker");

    this.caseBox = this.add.image(world.backroomBox.x, world.backroomBox.y, V2_ASSETS.props.colaCase.key)
      .setDisplaySize(145, 105)
      .setDepth(23)
      .setName("v2-cola-case");
  }

  private createTargeting(): void {
    this.target = this.add.rectangle(0, 0, 120, 90, 0xf5c64d, 0.06)
      .setStrokeStyle(4, 0xf5c64d, 1)
      .setInteractive({ useHandCursor: true })
      .setDepth(60)
      .setName("v2-interaction-target");
    this.targetArrow = this.add.text(0, 0, "▼", {
      fontFamily: "Arial",
      fontSize: "43px",
      color: "#f5c64d",
      fontStyle: "bold",
      stroke: "#362d16",
      strokeThickness: 6
    }).setOrigin(0.5).setDepth(61);

    this.target.on("pointerdown", () => this.performCurrentAction());
    this.targetTween = this.tweens.add({
      targets: [this.target, this.targetArrow],
      alpha: { from: 0.5, to: 1 },
      scaleX: { from: 0.96, to: 1.04 },
      scaleY: { from: 0.96, to: 1.04 },
      duration: 680,
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
    if (!this.worker || !this.cart || !this.caseBox) return;
    const world = DAY_ONE_CONTENT.world;

    if (snapshot.step === "collect") {
      this.worker.setTexture(V2_ASSETS.characters.workerPush.key)
        .setPosition(world.workerStart.x, world.workerStart.y);
      this.cart.setTexture(V2_ASSETS.props.cart.key)
        .setPosition(world.cartStart.x, world.cartStart.y);
      this.caseBox.setVisible(true).setPosition(world.backroomBox.x, world.backroomBox.y).setAngle(0);
      return;
    }

    if (snapshot.step === "load") {
      this.worker.setTexture(V2_ASSETS.characters.workerCarry.key)
        .setPosition(world.backroomBox.x + 30, world.backroomBox.y + 135)
        .setDisplaySize(170, 260);
      this.caseBox.setVisible(true).setPosition(this.worker.x + 12, this.worker.y - 30).setDisplaySize(110, 78);
      return;
    }

    if (snapshot.step === "push") {
      this.worker.setTexture(V2_ASSETS.characters.workerPush.key).setDisplaySize(170, 260);
      this.cart.setTexture(V2_ASSETS.props.cartLoaded.key);
      this.caseBox.setVisible(false);
      return;
    }

    if (snapshot.step === "park" && !this.cartMoved) {
      this.cartMoved = true;
      this.inputLocked = true;
      this.worker.setTexture(V2_ASSETS.characters.workerPush.key).setDisplaySize(170, 260);
      this.cart.setTexture(V2_ASSETS.props.cartLoaded.key);
      this.caseBox.setVisible(false);

      this.tweens.add({
        targets: this.cart,
        x: world.cartCooler.x,
        y: world.cartCooler.y,
        duration: 1150,
        ease: "Sine.InOut"
      });
      this.tweens.add({
        targets: this.worker,
        x: world.workerCooler.x,
        y: world.workerCooler.y,
        duration: 1150,
        ease: "Sine.InOut",
        onComplete: () => {
          this.inputLocked = false;
          this.syncTarget(this.controller.snapshot());
        }
      });
      return;
    }

    if (["open", "restock", "complete"].includes(snapshot.step)) {
      this.cart.setPosition(world.cartCooler.x, world.cartCooler.y).setTexture(V2_ASSETS.props.cartLoaded.key);
      this.worker.setPosition(world.workerCooler.x, world.workerCooler.y).setTexture(V2_ASSETS.characters.workerPush.key);
      this.caseBox.setVisible(snapshot.step !== "complete")
        .setPosition(world.cartCooler.x + 5, world.cartCooler.y - 78)
        .setDisplaySize(115, 82)
        .setAngle(snapshot.boxOpened ? -8 : 0);
    }
  }

  private syncRows(snapshot: RestockSnapshot): void {
    this.coolerRows.forEach((row, index) => {
      const stocked = index < snapshot.stockedRows;
      row.setAlpha(stocked ? 1 : 0.12);
    });

    if (snapshot.stockedRows > this.previousStockedRows) {
      const row = this.coolerRows[snapshot.stockedRows - 1];
      if (row) {
        row.setScale(0.82).setAlpha(1);
        this.tweens.add({
          targets: row,
          scaleX: 1,
          scaleY: 1,
          duration: 260,
          ease: "Back.Out"
        });
      }
    }
  }

  private syncTarget(snapshot: RestockSnapshot): void {
    if (!this.target || !this.targetArrow) return;
    const world = DAY_ONE_CONTENT.world;
    let x = world.backroomBox.x;
    let y = world.backroomBox.y;
    let width = 165;
    let height = 120;

    switch (snapshot.step) {
      case "collect":
        break;
      case "load":
      case "push":
        x = this.cart?.x ?? world.cartStart.x;
        y = (this.cart?.y ?? world.cartStart.y) - 5;
        width = 220;
        height = 190;
        break;
      case "park":
        x = world.cartCooler.x;
        y = world.cartCooler.y;
        width = 245;
        height = 205;
        break;
      case "open":
        x = world.cartCooler.x;
        y = world.cartCooler.y - 78;
        width = 150;
        height = 105;
        break;
      case "restock": {
        const rowIndex = Math.min(snapshot.stockedRows, snapshot.totalRows - 1);
        x = 1238;
        y = 320 + rowIndex * 85;
        width = 275;
        height = 72;
        break;
      }
      case "complete":
        x = world.coolerTarget.x;
        y = world.coolerTarget.y + 115;
        width = world.coolerTarget.width;
        height = world.coolerTarget.height;
        break;
    }

    this.target.setPosition(x, y).setSize(width, height).setDisplaySize(width, height);
    this.targetArrow.setPosition(x, y - height / 2 - 28);
    const interactive = snapshot.step !== "complete" && !this.inputLocked;
    this.target.disableInteractive();
    if (interactive) this.target.setInteractive({ useHandCursor: true });
  }

  private playCompletionFeedback(): void {
    const { palette } = DAY_ONE_CONTENT;
    const banner = this.add.rectangle(768, 480, 620, 150, 0x0a0f0c, 0.94)
      .setStrokeStyle(4, palette.gold, 1)
      .setDepth(120)
      .setScale(0.8);
    const title = this.add.text(768, 455, "COOLER FULLY STOCKED", {
      fontFamily: "Arial",
      fontSize: "34px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setOrigin(0.5).setDepth(121);
    const reward = this.add.text(768, 505, "+1 STAR   +100 COINS", {
      fontFamily: "Arial",
      fontSize: "22px",
      color: "#f5c64d",
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
      const sparkle = this.add.circle(1238, 520, 3 + (i % 4), i % 2 === 0 ? palette.gold : 0xffffff, 1)
        .setDepth(90);
      this.tweens.add({
        targets: sparkle,
        x: 1050 + Math.random() * 380,
        y: 250 + Math.random() * 520,
        alpha: 0,
        duration: 850 + Math.random() * 650,
        ease: "Cubic.Out",
        onComplete: () => sparkle.destroy()
      });
    }
  }
}
