import Phaser from "phaser";
import { Assets } from "./assets";
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
  __day2CheckoutCount?: number;
  __day2ServiceResolved?: boolean;
  __day2DamageResolved?: boolean;
  __day2PromotionComplete?: boolean;
  updateHud: () => void;
  updateStars: () => void;
  advanceBusinessPhase: () => void;
};

type RuntimePromotionWing = Phaser.Scene & {
  gameScene?: RuntimeGameScene;
  featuredProduct: ProductId;
  slots: WingSlot[];
  customerEvent?: Phaser.Time.TimerEvent;
  restockBusy: boolean;
  exiting: boolean;
  lastSoldOutAt: number;
  __promoQueue?: CheckoutEntry[];
  __promoQueueText?: Phaser.GameObjects.Text;
  __promoRegisterButton?: Phaser.GameObjects.Image;
  __promoRegisterGlow?: Phaser.GameObjects.Rectangle;
  __promoCheckoutBroken?: boolean;
  __promoCheckoutCount?: number;
  __mainlineServiceCustomer?: Phaser.GameObjects.Image;
  __mainlineServiceBubble?: Phaser.GameObjects.Image;
  __mainlineServiceTimer?: Phaser.Time.TimerEvent;
  __mainlineDamageIcon?: Phaser.GameObjects.Image;
  __mainlineDamageTimer?: Phaser.Time.TimerEvent;
  fitImage: (image: Phaser.GameObjects.Image, maxWidth: number, maxHeight: number) => void;
  showFloating: (x: number, y: number, message: string, color: number) => void;
  exitWing: (message?: string) => void;
};

type PromotionWingPrototype = {
  createExpandedRoom: () => void;
  startWingCustomers: () => void;
  customerVisit: () => void;
  showSoldOutCustomer: () => void;
};

const prototype = PromotionWingScene.prototype as unknown as PromotionWingPrototype;
const originalCreateExpandedRoom = prototype.createExpandedRoom;
const originalShowSoldOutCustomer = prototype.showSoldOutCustomer;

prototype.createExpandedRoom = function createGuidedPromotionRoom(): void {
  const scene = this as unknown as RuntimePromotionWing;
  const game = scene.gameScene;

  // Day 2 teaches inventory, checkout, customer service and damaged goods in a
  // fixed order. Register faults are reserved for a later supervisor shift.
  if (game) {
    game.__promotionDamageTriggered = true;
    game.__promotionRepairTriggered = true;
    game.__day2CheckoutCount ??= 0;
    game.__day2ServiceResolved ??= false;
    game.__day2DamageResolved ??= false;
    game.__day2PromotionComplete ??= false;
  }

  originalCreateExpandedRoom.call(this);

  scene.__promoCheckoutCount = game?.__day2CheckoutCount ?? 0;
  scene.__promoCheckoutBroken = false;
  scene.__promoRegisterButton?.removeAllListeners("pointerdown");
  scene.__promoRegisterButton?.on("pointerdown", () => processMainlineCheckout(scene));

  // High-depth hit areas make the current duty obvious and prevent the older
  // prototype listeners underneath from running in parallel.
  const serviceHit = scene.add.rectangle(225, 775, 350, 285, 0xffffff, 0.001)
    .setDepth(90)
    .setInteractive({ useHandCursor: true });
  serviceHit.on("pointerdown", () => resolveMainlineService(scene));

  const damageHit = scene.add.rectangle(1190, 990, 235, 225, 0xffffff, 0.001)
    .setDepth(90)
    .setInteractive({ useHandCursor: true });
  damageHit.on("pointerdown", () => resolveMainlineDamage(scene));

  scene.time.delayedCall(700, () => synchronizeRequiredDuty(scene));
};

prototype.startWingCustomers = function startControlledPromotionCustomers(): void {
  const scene = this as unknown as RuntimePromotionWing;
  scene.customerEvent?.remove(false);
  scene.customerEvent = scene.time.addEvent({
    delay: 5_200,
    loop: true,
    callback: () => prototype.customerVisit.call(this)
  });
};

prototype.customerVisit = function spawnOnlyTheCurrentCustomerWave(): void {
  const scene = this as unknown as RuntimePromotionWing;
  const game = scene.gameScene;
  if (!game || game.shiftEnded || scene.restockBusy || scene.exiting) return;
  if (game.phase !== "OPEN" && game.phase !== "RUSH") return;
  if (game.__day2PromotionComplete) return;

  const completed = game.__day2CheckoutCount ?? 0;
  if (completed >= 3 && !game.__day2ServiceResolved) return;
  if (completed >= 5 && !game.__day2DamageResolved) return;
  if (completed >= 6) return;
  if ((scene.__promoQueue?.length ?? 0) >= 2) return;

  const reservedCount = scene.slots.filter((slot) => slot.reserved).length;
  if ((scene.__promoQueue?.length ?? 0) + reservedCount >= 2) return;

  const available = scene.slots.filter((slot) => slot.product && !slot.reserved);
  if (available.length === 0) {
    if (game.__promotionWingStock === 0 && scene.time.now - scene.lastSoldOutAt >= 5_000) {
      scene.lastSoldOutAt = scene.time.now;
      gameSession.recordMissedSale();
      game.updateStars();
      originalShowSoldOutCustomer.call(this);
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
    duration: 720,
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

      scene.__promoQueue ??= [];
      scene.__promoQueue.push({
        customer,
        income: PRODUCTS[scene.featuredProduct].price + 4
      });
      repositionQueue(scene);
      updateCheckoutUi(scene);
      scene.showFloating(slot.x, slot.y - 90, "CUSTOMER READY TO CHECK OUT", 0xffe16d);
    }
  });
};

function processMainlineCheckout(scene: RuntimePromotionWing): void {
  const game = scene.gameScene;
  if (!game || game.shiftEnded) return;

  const completed = game.__day2CheckoutCount ?? 0;
  if (completed >= 3 && !game.__day2ServiceResolved) {
    scene.showFloating(1115, 430, "HANDLE THE SERVICE DESK FIRST", 0xff8179);
    return;
  }
  if (completed >= 5 && !game.__day2DamageResolved) {
    scene.showFloating(1115, 430, "REMOVE THE DAMAGED ITEM FIRST", 0xff8179);
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

  const nextCount = completed + 1;
  game.__day2CheckoutCount = nextCount;
  scene.__promoCheckoutCount = nextCount;
  game.updateHud();
  scene.showFloating(1115, 450, `CHECKOUT ${nextCount}/6 · +${entry.income}`, 0x9ff18d);

  scene.tweens.add({
    targets: entry.customer,
    x: 1380,
    y: 1030,
    alpha: 0,
    duration: 520,
    ease: "Sine.In",
    onComplete: () => entry.customer.destroy()
  });
  repositionQueue(scene);
  updateCheckoutUi(scene);

  if (nextCount === 3) spawnMainlineService(scene);
  if (nextCount === 5 && game.__day2ServiceResolved) spawnMainlineDamage(scene);
  if (nextCount >= 6 && game.__day2ServiceResolved && game.__day2DamageResolved) {
    completePromotionShift(scene);
  }
};

function repositionQueue(scene: RuntimePromotionWing): void {
  const positions = [930, 820];
  (scene.__promoQueue ?? []).forEach((entry, index) => {
    scene.tweens.add({
      targets: entry.customer,
      x: positions[index] ?? 820,
      y: 1010,
      duration: 280,
      ease: "Sine.Out"
    });
  });
};

function updateCheckoutUi(scene: RuntimePromotionWing): void {
  const count = scene.__promoQueue?.length ?? 0;
  scene.__promoQueueText?.setText(`CHECKOUT QUEUE ${count}/2`);
  scene.__promoRegisterGlow?.setVisible(count > 0);
};

function synchronizeRequiredDuty(scene: RuntimePromotionWing): void {
  const game = scene.gameScene;
  if (!game || game.__day2PromotionComplete) return;
  const count = game.__day2CheckoutCount ?? 0;

  if (count >= 3 && !game.__day2ServiceResolved) {
    spawnMainlineService(scene);
    return;
  }
  if (count >= 5 && !game.__day2DamageResolved) {
    spawnMainlineDamage(scene);
  }
};

function spawnMainlineService(scene: RuntimePromotionWing): void {
  const game = scene.gameScene;
  if (!game || game.__day2ServiceResolved || scene.__mainlineServiceCustomer?.active) return;

  scene.__mainlineServiceCustomer = scene.add.image(-80, 1010, Assets.promotion.customerService)
    .setOrigin(0.5, 1)
    .setDepth(95);
  scene.fitImage(scene.__mainlineServiceCustomer, 155, 305);
  scene.__mainlineServiceBubble = scene.add.image(275, 505, Assets.promotion.serviceRequestBubble)
    .setDisplaySize(380, 180)
    .setDepth(96)
    .setInteractive({ useHandCursor: true });
  scene.__mainlineServiceBubble.on("pointerdown", () => resolveMainlineService(scene));

  scene.tweens.add({
    targets: scene.__mainlineServiceCustomer,
    x: 310,
    duration: 520,
    ease: "Sine.Out"
  });
  scene.showFloating(300, 420, "CUSTOMER RETURN · TAP SERVICE DESK", 0xffd75a);

  scene.__mainlineServiceTimer?.remove(false);
  scene.__mainlineServiceTimer = scene.time.delayedCall(20_000, () => {
    if (game.__day2ServiceResolved) return;
    scene.showFloating(300, 420, "CUSTOMER IS STILL WAITING", 0xff8179);
    spawnMainlineService(scene);
  });
};

function resolveMainlineService(scene: RuntimePromotionWing): void {
  const game = scene.gameScene;
  if (!game || game.__day2ServiceResolved || (game.__day2CheckoutCount ?? 0) < 3) {
    scene.showFloating(225, 570, "SERVICE DESK READY", 0xbfd6d8);
    return;
  }

  game.__day2ServiceResolved = true;
  game.money += 8;
  gameSession.recordSatisfiedCustomer();
  game.updateHud();
  scene.__mainlineServiceTimer?.remove(false);
  scene.__mainlineServiceTimer = undefined;
  scene.__mainlineServiceBubble?.destroy();
  scene.__mainlineServiceBubble = undefined;

  const customer = scene.__mainlineServiceCustomer;
  scene.__mainlineServiceCustomer = undefined;
  if (customer?.active) {
    scene.tweens.add({
      targets: customer,
      x: -100,
      alpha: 0,
      duration: 450,
      onComplete: () => customer.destroy()
    });
  }
  scene.showFloating(260, 460, "RETURN HANDLED · +8", 0x9ff18d);
};

function spawnMainlineDamage(scene: RuntimePromotionWing): void {
  const game = scene.gameScene;
  if (!game || game.__day2DamageResolved || scene.__mainlineDamageIcon?.active) return;

  scene.__mainlineDamageIcon = scene.add.image(1175, 875, Assets.promotion.returnExchangeIcon)
    .setDisplaySize(118, 118)
    .setDepth(97)
    .setInteractive({ useHandCursor: true });
  scene.__mainlineDamageIcon.on("pointerdown", () => resolveMainlineDamage(scene));
  scene.tweens.add({
    targets: scene.__mainlineDamageIcon,
    scaleX: 1.1,
    scaleY: 1.1,
    duration: 480,
    yoyo: true,
    repeat: -1
  });
  scene.showFloating(1150, 790, "DAMAGED ITEM · TAP THE BIN", 0xffd75a);

  scene.__mainlineDamageTimer?.remove(false);
  scene.__mainlineDamageTimer = scene.time.delayedCall(20_000, () => {
    if (game.__day2DamageResolved) return;
    scene.showFloating(1150, 790, "DAMAGED ITEM STILL NEEDS ACTION", 0xff8179);
  });
};

function resolveMainlineDamage(scene: RuntimePromotionWing): void {
  const game = scene.gameScene;
  if (!game || game.__day2DamageResolved || (game.__day2CheckoutCount ?? 0) < 5) {
    scene.showFloating(1190, 850, "NO DAMAGED GOODS TO PROCESS", 0xbfd6d8);
    return;
  }

  game.__day2DamageResolved = true;
  game.updateHud();
  scene.__mainlineDamageTimer?.remove(false);
  scene.__mainlineDamageTimer = undefined;
  scene.__mainlineDamageIcon?.destroy();
  scene.__mainlineDamageIcon = undefined;
  scene.showFloating(1150, 810, "DAMAGED ITEM REMOVED", 0x9ff18d);
};

function completePromotionShift(scene: RuntimePromotionWing): void {
  const game = scene.gameScene;
  if (!game || game.__day2PromotionComplete) return;
  game.__day2PromotionComplete = true;
  scene.customerEvent?.remove(false);
  scene.customerEvent = undefined;
  game.updateHud();
  scene.showFloating(665, 330, "PROMOTION SHIFT COMPLETE · 6/6", 0x9ff18d);
};
