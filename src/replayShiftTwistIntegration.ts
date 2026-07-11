import Phaser from "phaser";
import { Assets } from "./assets";
import { PRODUCTS, type ProductId } from "./gameConfig";
import { LEVELS } from "./levels/levelConfigs";
import { GameScene } from "./scenes/GameScene";
import { gameSession } from "./systems/GameSession";
import { bestStarsFor } from "./systems/StorefrontProgress";

type RuntimeGame = Phaser.Scene & {
  phase: "PREPARE" | "OPEN" | "RUSH" | "CLOSING" | "RESULT";
  soldCount: number;
  shiftEnded: boolean;
  money: number;
  purchaseEvent?: Phaser.Time.TimerEvent;
  __rushPreparing?: boolean;
  __shiftTwistTriggered?: boolean;
  __shiftTwistPanel?: Phaser.GameObjects.Container;
  __shiftTwistTimer?: Phaser.Time.TimerEvent;
  startCustomerLoop: (delay: number) => void;
  showPhaseBanner: (message: string) => void;
  showTransientHint: (message: string) => void;
  updateHud: () => void;
};

type GamePrototype = {
  create: () => void;
};

type TwistKind = "SPILL" | "FIND_ITEM" | "PRICE_CHECK";

const prototype = GameScene.prototype as unknown as GamePrototype;
const originalCreate = prototype.create;

prototype.create = function createWithReplayShiftTwist(): void {
  originalCreate.call(this);
  const scene = this as unknown as RuntimeGame;
  scene.__shiftTwistTriggered = false;

  if (gameSession.day !== "day01" || bestStarsFor("day01") <= 0) return;

  let lastCheck = 0;
  const monitor = (): void => {
    if (scene.time.now - lastCheck < 250) return;
    lastCheck = scene.time.now;
    if (
      scene.__shiftTwistTriggered ||
      scene.shiftEnded ||
      scene.phase !== "RUSH" ||
      scene.__rushPreparing ||
      scene.soldCount < 2
    ) return;

    scene.__shiftTwistTriggered = true;
    scene.time.delayedCall(900, () => {
      if (!scene.scene.isActive() || scene.shiftEnded || scene.phase !== "RUSH") return;
      startShiftTwist(scene, pickTwist());
    });
  };

  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, monitor);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, monitor);
    scene.__shiftTwistTimer?.remove(false);
    scene.__shiftTwistPanel?.destroy(true);
    scene.__shiftTwistTimer = undefined;
    scene.__shiftTwistPanel = undefined;
  });
};

function startShiftTwist(scene: RuntimeGame, kind: TwistKind): void {
  scene.purchaseEvent?.remove(false);
  scene.purchaseEvent = undefined;
  scene.showPhaseBanner("STORE EVENT");

  const shade = scene.add.rectangle(665, 591, 1330, 1182, 0x061012, 0.62)
    .setInteractive()
    .setDepth(1700);
  const panel = scene.add.rectangle(665, 595, 820, 650, 0xf1ead9, 0.99)
    .setStrokeStyle(8, 0xffd75a)
    .setDepth(1701);
  const eyebrow = scene.add.text(665, 330, "REPLAY SHIFT · SURPRISE DUTY", {
    fontFamily: "Arial",
    fontSize: "19px",
    color: "#8a5a18",
    fontStyle: "bold",
    letterSpacing: 2
  }).setOrigin(0.5).setDepth(1702);
  const title = scene.add.text(665, 385, twistTitle(kind), {
    fontFamily: "Arial",
    fontSize: "39px",
    color: "#263a30",
    fontStyle: "bold"
  }).setOrigin(0.5).setDepth(1702);
  const instruction = scene.add.text(665, 450, twistInstruction(kind), {
    fontFamily: "Arial",
    fontSize: "22px",
    color: "#4f6258",
    align: "center",
    lineSpacing: 8,
    wordWrap: { width: 700 }
  }).setOrigin(0.5).setDepth(1702);
  const timerText = scene.add.text(665, 825, "12", {
    fontFamily: "Arial",
    fontSize: "31px",
    color: "#ffffff",
    fontStyle: "bold",
    backgroundColor: "#7a4b24",
    padding: { x: 18, y: 9 }
  }).setOrigin(0.5).setDepth(1703);

  const objects: Phaser.GameObjects.GameObject[] = [shade, panel, eyebrow, title, instruction, timerText];
  const finish = (success: boolean): void => finishShiftTwist(scene, success, timerText);

  if (kind === "SPILL") createSpillDuty(scene, objects, finish);
  if (kind === "FIND_ITEM") createFindItemDuty(scene, objects, finish);
  if (kind === "PRICE_CHECK") createPriceCheckDuty(scene, objects, finish);

  scene.__shiftTwistPanel = scene.add.container(0, 0, objects).setDepth(1700).setAlpha(0).setScale(0.96);
  scene.tweens.add({
    targets: scene.__shiftTwistPanel,
    alpha: 1,
    scaleX: 1,
    scaleY: 1,
    duration: 180,
    ease: "Back.Out"
  });

  let seconds = 12;
  scene.__shiftTwistTimer?.remove(false);
  scene.__shiftTwistTimer = scene.time.addEvent({
    delay: 1000,
    loop: true,
    callback: () => {
      if (!scene.__shiftTwistPanel?.active) return;
      seconds -= 1;
      timerText.setText(String(Math.max(0, seconds)));
      if (seconds <= 0) finish(false);
    }
  });
}

function createSpillDuty(
  scene: RuntimeGame,
  objects: Phaser.GameObjects.GameObject[],
  finish: (success: boolean) => void
): void {
  const puddle = scene.add.ellipse(665, 625, 300, 120, 0x7cc4df, 0.92)
    .setStrokeStyle(7, 0x3f829e)
    .setDepth(1702);
  const shine = scene.add.ellipse(620, 600, 95, 28, 0xd9f7ff, 0.72).setDepth(1703);
  const cleanBackground = scene.add.rectangle(665, 725, 330, 84, 0x4f8b4c, 1)
    .setStrokeStyle(4, 0x2e6338)
    .setDepth(1703)
    .setInteractive({ useHandCursor: true });
  const cleanText = scene.add.text(665, 725, "CLEAN SPILL", {
    fontFamily: "Arial",
    fontSize: "26px",
    color: "#ffffff",
    fontStyle: "bold"
  }).setOrigin(0.5).setDepth(1704);
  const clean = (): void => finish(true);
  cleanBackground.on("pointerdown", clean);
  cleanText.setInteractive({ useHandCursor: true }).on("pointerdown", clean);
  objects.push(puddle, shine, cleanBackground, cleanText);
}

function createFindItemDuty(
  scene: RuntimeGame,
  objects: Phaser.GameObjects.GameObject[],
  finish: (success: boolean) => void
): void {
  const requested = Phaser.Utils.Array.GetRandom(["cola", "water", "milk"] as ProductId[]);
  const request = scene.add.text(665, 515, `CUSTOMER: WHERE IS ${PRODUCTS[requested].label.toUpperCase()}?`, {
    fontFamily: "Arial",
    fontSize: "25px",
    color: "#315f4b",
    fontStyle: "bold"
  }).setOrigin(0.5).setDepth(1703);
  objects.push(request);

  (["cola", "water", "milk"] as ProductId[]).forEach((productId, index) => {
    const x = 445 + index * 220;
    const card = scene.add.rectangle(x, 670, 180, 210, 0x173238, 1)
      .setStrokeStyle(4, 0x6d898d)
      .setDepth(1702);
    const image = scene.add.image(x, 660, productTexture(productId)).setOrigin(0.5, 1).setDepth(1703);
    fitImage(image, 75, 120);
    const label = scene.add.text(x, 735, PRODUCTS[productId].label.toUpperCase(), {
      fontFamily: "Arial",
      fontSize: "21px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setOrigin(0.5).setDepth(1703);
    const hit = scene.add.rectangle(x, 670, 195, 225, 0xffffff, 0.001)
      .setDepth(1704)
      .setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => finish(productId === requested));
    objects.push(card, image, label, hit);
  });
}

function createPriceCheckDuty(
  scene: RuntimeGame,
  objects: Phaser.GameObjects.GameObject[],
  finish: (success: boolean) => void
): void {
  const requested = Phaser.Utils.Array.GetRandom(["cola", "water", "milk"] as ProductId[]);
  const correctPrice = PRODUCTS[requested].price;
  const prices = Phaser.Utils.Array.Shuffle([
    Math.max(1, correctPrice - 2),
    correctPrice,
    correctPrice + 3
  ]);
  const product = scene.add.image(665, 600, productTexture(requested)).setOrigin(0.5, 1).setDepth(1703);
  fitImage(product, 90, 150);
  const request = scene.add.text(665, 630, `${PRODUCTS[requested].label.toUpperCase()} PRICE?`, {
    fontFamily: "Arial",
    fontSize: "25px",
    color: "#315f4b",
    fontStyle: "bold"
  }).setOrigin(0.5).setDepth(1703);
  objects.push(product, request);

  prices.forEach((price, index) => {
    const x = 465 + index * 200;
    const button = scene.add.rectangle(x, 735, 165, 82, 0x315f7d, 1)
      .setStrokeStyle(4, 0x9fcbe8)
      .setDepth(1703)
      .setInteractive({ useHandCursor: true });
    const label = scene.add.text(x, 735, `${price} COINS`, {
      fontFamily: "Arial",
      fontSize: "22px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setOrigin(0.5).setDepth(1704);
    const choose = (): void => finish(price === correctPrice);
    button.on("pointerdown", choose);
    label.setInteractive({ useHandCursor: true }).on("pointerdown", choose);
    objects.push(button, label);
  });
}

function finishShiftTwist(scene: RuntimeGame, success: boolean, timerText: Phaser.GameObjects.Text): void {
  if (!scene.__shiftTwistPanel?.active) return;
  scene.__shiftTwistTimer?.remove(false);
  scene.__shiftTwistTimer = undefined;

  timerText.setText(success ? "DONE" : "MISSED")
    .setBackgroundColor(success ? "#315f4b" : "#7a3b32");
  if (success) {
    scene.money += 12;
    gameSession.recordSatisfiedCustomer();
    scene.showTransientHint("Surprise duty complete · +12 coins");
  } else {
    scene.showTransientHint("Surprise duty missed · continue the shift");
  }
  scene.updateHud();

  const panel = scene.__shiftTwistPanel;
  scene.__shiftTwistPanel = undefined;
  scene.time.delayedCall(650, () => {
    if (panel?.active) panel.destroy(true);
    if (!scene.scene.isActive() || scene.shiftEnded || (scene.phase !== "OPEN" && scene.phase !== "RUSH")) return;
    const delay = scene.phase === "RUSH"
      ? LEVELS.day01.customerIntervalsMs.rush
      : LEVELS.day01.customerIntervalsMs.open;
    scene.startCustomerLoop(delay);
  });
}

function pickTwist(): TwistKind {
  return Phaser.Utils.Array.GetRandom(["SPILL", "FIND_ITEM", "PRICE_CHECK"] as TwistKind[]);
}

function twistTitle(kind: TwistKind): string {
  if (kind === "SPILL") return "AISLE SPILL";
  if (kind === "FIND_ITEM") return "CUSTOMER NEEDS HELP";
  return "PRICE CHECK";
}

function twistInstruction(kind: TwistKind): string {
  if (kind === "SPILL") return "Customers are paused. Clean the spill before reopening the aisle.";
  if (kind === "FIND_ITEM") return "A customer cannot find a product. Tap the correct item.";
  return "A customer needs the shelf price. Choose the correct amount.";
}

function productTexture(productId: ProductId): string {
  if (productId === "cola") return Assets.products.cola;
  if (productId === "water") return Assets.products.water;
  return Assets.products.milk;
}

function fitImage(image: Phaser.GameObjects.Image, maxWidth: number, maxHeight: number): void {
  const width = Math.max(1, image.width);
  const height = Math.max(1, image.height);
  image.setScale(Math.min(maxWidth / width, maxHeight / height));
}
