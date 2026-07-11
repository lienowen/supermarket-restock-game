import Phaser from "phaser";
import { AssetPaths, Assets } from "./assets";
import { PRODUCTS, type ProductId } from "./gameConfig";
import { PromotionWingScene } from "./scenes/PromotionWingScene";
import { gameSession } from "./systems/GameSession";

type WingSlot = {
  index: number;
  x: number;
  y: number;
  product?: Phaser.GameObjects.Image;
  missing: Phaser.GameObjects.Image;
  hitArea: Phaser.GameObjects.Rectangle;
  reserved: boolean;
};

type CheckoutEntry = {
  customer: Phaser.GameObjects.Image;
  income: number;
};

type RuntimeGameScene = Phaser.Scene & {
  phase: "PREPARE" | "OPEN" | "RUSH" | "CLOSING" | "RESULT";
  shiftEnded: boolean;
  money: number;
  soldCount: number;
  customerSequence: number;
  __promotionWingStock?: number;
  __promotionDamageTriggered?: boolean;
  __promotionRepairTriggered?: boolean;
  updateHud: () => void;
  updateStars: () => void;
  advanceBusinessPhase: () => void;
};

type RuntimePromotionWing = Phaser.Scene & {
  gameScene?: RuntimeGameScene;
  featuredProduct: ProductId;
  slots: WingSlot[];
  worker?: Phaser.GameObjects.Image;
  customerEvent?: Phaser.Time.TimerEvent;
  restockBusy: boolean;
  exiting: boolean;
  lastSoldOutAt: number;
  __promoQueue?: CheckoutEntry[];
  __promoQueueText?: Phaser.GameObjects.Text;
  __promoRegisterButton?: Phaser.GameObjects.Image;
  __promoRegisterGlow?: Phaser.GameObjects.Rectangle;
  __promoCashier?: Phaser.GameObjects.Image;
  __promoCheckoutBroken?: boolean;
  __promoRepairAlert?: Phaser.GameObjects.Image;
  __promoServicePending?: boolean;
  __promoServiceCustomer?: Phaser.GameObjects.Image;
  __promoServiceBubble?: Phaser.GameObjects.Image;
  __promoServiceTimer?: Phaser.Time.TimerEvent;
  __promoDamagePending?: boolean;
  __promoDamageIcon?: Phaser.GameObjects.Image;
  __promoDamageTimer?: Phaser.Time.TimerEvent;
  __promoCheckoutCount?: number;
  fitImage: (image: Phaser.GameObjects.Image, maxWidth: number, maxHeight: number) => void;
  showFloating: (x: number, y: number, message: string, color: number) => void;
  restockSlot: (slot: WingSlot) => void;
};

type PromotionWingPrototype = {
  preload: () => void;
  createExpandedRoom: () => void;
  createDisplayIslands: () => void;
  createWorker: () => void;
  startWingCustomers: () => void;
  customerVisit: () => void;
  showSoldOutCustomer: () => void;
  placeProduct: (slot: WingSlot, animate: boolean) => void;
};

const prototype = PromotionWingScene.prototype as unknown as PromotionWingPrototype;
const originalPreload = prototype.preload;

prototype.preload = function preloadProductionPromotionAssets(): void {
  originalPreload.call(this);
  const scene = this as unknown as Phaser.Scene;
  Object.values(Assets.promotion).forEach((key) => {
    const assetKey = key as keyof typeof AssetPaths;
    if (!scene.textures.exists(assetKey)) scene.load.image(assetKey, AssetPaths[assetKey]);
  });
};

prototype.createExpandedRoom = function createProductionPromotionRoom(): void {
  const scene = this as unknown as RuntimePromotionWing;
  const game = scene.gameScene;

  scene.add.image(665, 591, Assets.promotion.roomBg)
    .setDisplaySize(1330, 1182)
    .setDepth(0);

  scene.add.rectangle(665, 116, 1330, 232, 0x071315, 0.6).setDepth(2);
  scene.add.image(665, 255, Assets.promotion.dayBanner)
    .setDisplaySize(420, 175)
    .setDepth(5);

  scene.add.image(225, 775, Assets.promotion.serviceDesk)
    .setDisplaySize(300, 225)
    .setDepth(8);
  const serviceHit = scene.add.rectangle(225, 775, 330, 260, 0xffffff, 0.001)
    .setDepth(20)
    .setInteractive({ useHandCursor: true });
  serviceHit.on("pointerdown", () => resolveServiceRequest(scene));

  scene.add.image(1115, 790, Assets.promotion.checkoutCounter)
    .setDisplaySize(330, 255)
    .setDepth(10);
  scene.__promoCashier = scene.add.image(1125, 720, Assets.promotion.cashierIdle)
    .setOrigin(0.5, 1)
    .setDepth(9);
  scene.fitImage(scene.__promoCashier, 145, 285);

  scene.__promoRegisterGlow = scene.add.rectangle(1115, 525, 285, 112, 0xffd75a, 0.16)
    .setStrokeStyle(5, 0xffd75a, 1)
    .setDepth(14)
    .setVisible(false);
  scene.__promoRegisterButton = scene.add.image(1115, 525, Assets.promotion.cashRegisterButton)
    .setDisplaySize(275, 105)
    .setDepth(15)
    .setInteractive({ useHandCursor: true });
  scene.__promoRegisterButton.on("pointerdown", () => processCheckout(scene));

  scene.__promoQueueText = scene.add.text(1115, 600, "CHECKOUT QUEUE 0", {
    fontFamily: "Arial",
    fontSize: "20px",
    color: "#ffffff",
    fontStyle: "bold",
    backgroundColor: "#173135",
    padding: { x: 16, y: 9 }
  }).setOrigin(0.5).setDepth(16);

  [930, 825, 720].forEach((x) => {
    scene.add.image(x, 1000, Assets.promotion.queueMarker)
      .setDisplaySize(64, 72)
      .setAlpha(0.52)
      .setDepth(6);
  });

  scene.add.image(1190, 1000, Assets.promotion.damagedGoodsBin)
    .setDisplaySize(185, 175)
    .setDepth(12);
  const damageHit = scene.add.rectangle(1190, 990, 215, 205, 0xffffff, 0.001)
    .setDepth(21)
    .setInteractive({ useHandCursor: true });
  damageHit.on("pointerdown", () => resolveDamagedGoods(scene));

  scene.__promoQueue = [];
  scene.__promoCheckoutBroken = false;
  scene.__promoCheckoutCount = 0;
  scene.__promoServicePending = false;
  scene.__promoDamagePending = false;

  if (game && !game.__promotionDamageTriggered) {
    game.__promotionDamageTriggered = true;
    scene.time.delayedCall(16_000, () => spawnDamagedGoods(scene));
  }
  if (game && !game.__promotionRepairTriggered) {
    game.__promotionRepairTriggered = true;
    scene.time.delayedCall(29_000, () => breakCheckout(scene));
  }
};

prototype.createDisplayIslands = function createProductionPromoShelves(): void {
  const scene = this as unknown as RuntimePromotionWing;
  const fixtures = [
    { x: 450, key: Assets.promotion.shelfLeft },
    { x: 680, key: Assets.promotion.shelfCenter },
    { x: 910, key: Assets.promotion.shelfRight }
  ];

  fixtures.forEach((fixture, fixtureIndex) => {
    scene.add.ellipse(fixture.x, 790, 235, 30, 0x101515, 0.25).setDepth(3);
    scene.add.image(fixture.x, 605, fixture.key)
      .setDisplaySize(245, 365)
      .setDepth(5);

    [525, 675].forEach((y, rowIndex) => {
      const index = fixtureIndex * 2 + rowIndex;
      const missing = scene.add.image(fixture.x, y, Assets.promotion.slotEmpty)
        .setDisplaySize(112, 140)
        .setDepth(8);
      const hitArea = scene.add.rectangle(fixture.x, y, 150, 158, 0xffffff, 0.001)
        .setDepth(18)
        .setInteractive({ useHandCursor: true });
      const slot: WingSlot = {
        index,
        x: fixture.x,
        y,
        missing,
        hitArea,
        reserved: false
      };
      hitArea.on("pointerdown", () => scene.restockSlot(slot));
      scene.slots.push(slot);
    });
  });
};

prototype.createWorker = function createProductionStockWorker(): void {
  const scene = this as unknown as RuntimePromotionWing;
  scene.worker = scene.add.image(165, 1040, Assets.characters.workerIdle)
    .setOrigin(0.5, 1)
    .setDepth(20);
  scene.fitImage(scene.worker, 170, 330);
};

prototype.placeProduct = function placeProductionPromoProduct(slot: WingSlot, animate: boolean): void {
  const scene = this as unknown as RuntimePromotionWing;
  const texture = scene.featuredProduct === "cola"
    ? Assets.promotion.slotCola
    : scene.featuredProduct === "milk"
      ? Assets.promotion.slotMilk
      : Assets.promotion.slotWater;

  slot.product?.destroy();
  const product = scene.add.image(slot.x, slot.y, texture)
    .setDisplaySize(112, 140)
    .setDepth(9);
  slot.product = product;
  slot.missing.setVisible(false);

  if (!animate) return;
  product.setScale(0.78).setAlpha(0);
  scene.tweens.add({
    targets: product,
    scaleX: 1,
    scaleY: 1,
    alpha: 1,
    duration: 180,
    ease: "Back.Out"
  });
};

prototype.startWingCustomers = function startProductionWingCustomers(): void {
  const scene = this as unknown as RuntimePromotionWing;
  scene.customerEvent?.remove(false);
  scene.customerEvent = scene.time.addEvent({
    delay: 2800,
    loop: true,
    callback: () => prototype.customerVisit.call(this)
  });
};

prototype.customerVisit = function customerShopsThenQueues(): void {
  const scene = this as unknown as RuntimePromotionWing;
  const game = scene.gameScene;
  if (!game || game.shiftEnded || scene.restockBusy || scene.exiting) return;
  if (game.phase !== "OPEN" && game.phase !== "RUSH") return;
  if ((scene.__promoQueue?.length ?? 0) >= 3) return;

  const available = scene.slots.filter((slot) => slot.product && !slot.reserved);
  if (available.length === 0) {
    if (game.__promotionWingStock === 0 && scene.time.now - scene.lastSoldOutAt >= 2800) {
      scene.lastSoldOutAt = scene.time.now;
      gameSession.recordMissedSale();
      game.updateStars();
      prototype.showSoldOutCustomer.call(this);
    }
    return;
  }

  const slot = Phaser.Utils.Array.GetRandom(available);
  slot.reserved = true;
  game.customerSequence += 1;
  const customer = scene.add.image(1380, 1020, Assets.promotion.customerWaiting)
    .setOrigin(0.5, 1)
    .setDepth(24);
  scene.fitImage(customer, 145, 295);

  scene.tweens.add({
    targets: customer,
    x: slot.x + 78,
    y: 890,
    duration: 620,
    ease: "Sine.InOut",
    onComplete: () => {
      const sold = slot.product;
      if (!sold || game.shiftEnded) {
        slot.reserved = false;
        customer.destroy();
        return;
      }

      slot.product = undefined;
      slot.reserved = false;
      sold.destroy();
      slot.missing.setVisible(true);
      game.__promotionWingStock = Math.max(0, (game.__promotionWingStock ?? 0) - 1);

      const income = PRODUCTS[scene.featuredProduct].price + 4;
      scene.__promoQueue ??= [];
      scene.__promoQueue.push({ customer, income });
      repositionCheckoutQueue(scene);
      updateCheckoutUi(scene);
      scene.showFloating(slot.x, slot.y - 90, "ITEM TO CHECKOUT", 0xffe16d);
    }
  });
};

prototype.showSoldOutCustomer = function showProductionSoldOutCustomer(): void {
  const scene = this as unknown as RuntimePromotionWing;
  const customer = scene.add.image(1370, 1010, Assets.promotion.customerService)
    .setOrigin(0.5, 1)
    .setDepth(24);
  scene.fitImage(customer, 150, 300);
  scene.tweens.add({
    targets: customer,
    x: 955,
    duration: 520,
    ease: "Sine.Out",
    onComplete: () => {
      scene.showFloating(820, 420, "PROMOTION SOLD OUT · LOST SALE", 0xff8179);
      scene.tweens.add({
        targets: customer,
        x: 1380,
        alpha: 0,
        delay: 280,
        duration: 480,
        onComplete: () => customer.destroy()
      });
    }
  });
};

function processCheckout(scene: RuntimePromotionWing): void {
  const game = scene.gameScene;
  if (!game || game.shiftEnded) return;
  if (scene.__promoCheckoutBroken) {
    scene.showFloating(1115, 430, "REGISTER BROKEN · TAP REPAIR", 0xff8179);
    return;
  }

  const entry = scene.__promoQueue?.shift();
  if (!entry) {
    scene.showFloating(1115, 445, "NO CUSTOMER WAITING", 0xbfd6d8);
    return;
  }

  game.money += entry.income;
  game.soldCount += 1;
  game.updateStars();
  game.advanceBusinessPhase();
  game.updateHud();
  scene.__promoCheckoutCount = (scene.__promoCheckoutCount ?? 0) + 1;
  scene.showFloating(1115, 450, `CHECKOUT +${entry.income}`, 0x9ff18d);

  scene.tweens.add({
    targets: entry.customer,
    x: 1380,
    y: 1030,
    alpha: 0,
    duration: 520,
    ease: "Sine.In",
    onComplete: () => entry.customer.destroy()
  });
  repositionCheckoutQueue(scene);
  updateCheckoutUi(scene);

  if ((scene.__promoCheckoutCount ?? 0) % 3 === 0) spawnServiceRequest(scene);
}

function repositionCheckoutQueue(scene: RuntimePromotionWing): void {
  const positions = [930, 825, 720];
  (scene.__promoQueue ?? []).forEach((entry, index) => {
    scene.tweens.add({
      targets: entry.customer,
      x: positions[index] ?? 720,
      y: 1010,
      duration: 260,
      ease: "Sine.Out"
    });
  });
}

function updateCheckoutUi(scene: RuntimePromotionWing): void {
  const count = scene.__promoQueue?.length ?? 0;
  scene.__promoQueueText?.setText(`CHECKOUT QUEUE ${count}`);
  scene.__promoRegisterGlow?.setVisible(count > 0 && !scene.__promoCheckoutBroken);
}

function spawnServiceRequest(scene: RuntimePromotionWing): void {
  if (scene.__promoServicePending || scene.exiting) return;
  scene.__promoServicePending = true;
  scene.__promoServiceCustomer = scene.add.image(-80, 1010, Assets.promotion.customerService)
    .setOrigin(0.5, 1)
    .setDepth(25);
  scene.fitImage(scene.__promoServiceCustomer, 145, 295);
  scene.__promoServiceBubble = scene.add.image(275, 505, Assets.promotion.serviceRequestBubble)
    .setDisplaySize(360, 170)
    .setDepth(26)
    .setInteractive({ useHandCursor: true });
  scene.__promoServiceBubble.on("pointerdown", () => resolveServiceRequest(scene));
  scene.tweens.add({
    targets: scene.__promoServiceCustomer,
    x: 310,
    duration: 520,
    ease: "Sine.Out"
  });
  scene.showFloating(280, 430, "CUSTOMER QUESTION / RETURN", 0xffd75a);

  scene.__promoServiceTimer?.remove(false);
  scene.__promoServiceTimer = scene.time.delayedCall(9000, () => {
    if (!scene.__promoServicePending) return;
    scene.__promoServicePending = false;
    gameSession.recordMissedSale();
    scene.gameScene?.updateStars();
    scene.showFloating(280, 430, "SERVICE REQUEST MISSED", 0xff8179);
    leaveServiceCustomer(scene);
  });
}

function resolveServiceRequest(scene: RuntimePromotionWing): void {
  if (!scene.__promoServicePending) {
    scene.showFloating(225, 570, "SERVICE DESK READY", 0xbfd6d8);
    return;
  }
  scene.__promoServicePending = false;
  scene.__promoServiceTimer?.remove(false);
  scene.__promoServiceTimer = undefined;
  if (scene.gameScene) {
    scene.gameScene.money += 8;
    scene.gameScene.updateHud();
  }
  gameSession.recordSatisfiedCustomer();
  scene.showFloating(250, 480, "CUSTOMER HELPED +8", 0x9ff18d);
  leaveServiceCustomer(scene);
}

function leaveServiceCustomer(scene: RuntimePromotionWing): void {
  scene.__promoServiceBubble?.destroy();
  scene.__promoServiceBubble = undefined;
  const customer = scene.__promoServiceCustomer;
  scene.__promoServiceCustomer = undefined;
  if (!customer?.active) return;
  scene.tweens.add({
    targets: customer,
    x: -100,
    alpha: 0,
    duration: 450,
    onComplete: () => customer.destroy()
  });
}

function spawnDamagedGoods(scene: RuntimePromotionWing): void {
  if (scene.__promoDamagePending || scene.exiting) return;
  scene.__promoDamagePending = true;
  scene.__promoDamageIcon = scene.add.image(1175, 875, Assets.promotion.returnExchangeIcon)
    .setDisplaySize(108, 108)
    .setDepth(30)
    .setInteractive({ useHandCursor: true });
  scene.__promoDamageIcon.on("pointerdown", () => resolveDamagedGoods(scene));
  scene.tweens.add({
    targets: scene.__promoDamageIcon,
    scaleX: 1.1,
    scaleY: 1.1,
    duration: 420,
    yoyo: true,
    repeat: -1
  });
  scene.showFloating(1160, 790, "DAMAGED ITEM · TAP BIN", 0xffd75a);

  scene.__promoDamageTimer?.remove(false);
  scene.__promoDamageTimer = scene.time.delayedCall(10_000, () => {
    if (!scene.__promoDamagePending) return;
    scene.__promoDamagePending = false;
    scene.__promoDamageIcon?.destroy();
    scene.__promoDamageIcon = undefined;
    if (scene.gameScene) {
      scene.gameScene.money = Math.max(0, scene.gameScene.money - 5);
      scene.gameScene.updateHud();
    }
    gameSession.recordWrongStock();
    scene.showFloating(1160, 800, "WASTE COST -5", 0xff8179);
  });
}

function resolveDamagedGoods(scene: RuntimePromotionWing): void {
  if (!scene.__promoDamagePending) {
    scene.showFloating(1190, 850, "NO DAMAGED GOODS", 0xbfd6d8);
    return;
  }
  scene.__promoDamagePending = false;
  scene.__promoDamageTimer?.remove(false);
  scene.__promoDamageTimer = undefined;
  scene.__promoDamageIcon?.destroy();
  scene.__promoDamageIcon = undefined;
  scene.showFloating(1160, 810, "DAMAGED ITEM REMOVED", 0x9ff18d);
}

function breakCheckout(scene: RuntimePromotionWing): void {
  if (scene.exiting || scene.__promoCheckoutBroken) return;
  scene.__promoCheckoutBroken = true;
  scene.__promoRegisterGlow?.setVisible(false);
  scene.__promoRepairAlert = scene.add.image(1115, 405, Assets.promotion.repairAlert)
    .setDisplaySize(125, 125)
    .setDepth(32)
    .setInteractive({ useHandCursor: true });
  scene.__promoRepairAlert.on("pointerdown", () => repairCheckout(scene));
  scene.tweens.add({
    targets: scene.__promoRepairAlert,
    angle: 5,
    duration: 280,
    yoyo: true,
    repeat: -1
  });
  scene.showFloating(1115, 350, "REGISTER FAULT · REPAIR IT", 0xff8179);
}

function repairCheckout(scene: RuntimePromotionWing): void {
  if (!scene.__promoCheckoutBroken) return;
  scene.__promoRepairAlert?.disableInteractive();
  scene.showFloating(1115, 350, "REPAIRING…", 0xffd75a);
  scene.time.delayedCall(650, () => {
    scene.__promoCheckoutBroken = false;
    scene.__promoRepairAlert?.destroy();
    scene.__promoRepairAlert = undefined;
    updateCheckoutUi(scene);
    scene.showFloating(1115, 350, "REGISTER REPAIRED", 0x9ff18d);
  });
}
