import Phaser from "phaser";
import { Assets } from "./assets";
import { PRODUCTS, type ProductId } from "./gameConfig";
import { LEVELS } from "./levels/levelConfigs";
import { GameScene } from "./scenes/GameScene";
import { gameSession } from "./systems/GameSession";

const FLOOR_BG = "week-one-full-sales-floor";
const MODULES = {
  drinks: { key: "week-one-drinks-shelf", path: "assets/storefront/modules/shelf_drinks.png" },
  pantry: { key: "week-one-pantry-shelf", path: "assets/storefront/modules/shelf_snacks_pantry.png" },
  dairy: { key: "week-one-dairy-fridge", path: "assets/storefront/modules/fridge_dairy.png" },
  promo: { key: "week-one-promo-endcap", path: "assets/storefront/modules/promo_endcap.png" },
  produce: { key: "week-one-produce-island", path: "assets/storefront/modules/produce_island.png" }
} as const;

const FLOOR_BG_PATH = "assets/storefront/storefront_day.png";
const CART_HOME = { x: 420, y: 920 };
const CART_FLOOR = { x: 650, y: 915 };
const WORKER_HOME = { x: 380, y: 690 };
const WORKER_FLOOR = { x: 585, y: 820 };

type ShiftPhase = "PREPARE" | "OPEN" | "RUSH" | "CLOSING" | "RESULT";
type BatchDay = "day04" | "day05";
type ModuleName = keyof typeof MODULES;

type FixtureSpec = {
  id: string;
  label: string;
  productId: ProductId;
  module: ModuleName;
  x: number;
  y: number;
  width: number;
  height: number;
  color: number;
};

type RuntimeSlot = {
  index: number;
  productId: ProductId;
  hitArea: Phaser.GameObjects.Rectangle;
  missingTag: Phaser.GameObjects.Image;
  typeLabel: Phaser.GameObjects.Text;
  productBottomY: number;
  product?: Phaser.GameObjects.Image;
  reservedForCustomer: boolean;
};

type BatchFixture = FixtureSpec & {
  image: Phaser.GameObjects.Image;
  emptyShade: Phaser.GameObjects.Rectangle;
  status: Phaser.GameObjects.Text;
  slotIndex: number;
  stocked: boolean;
};

type SelectedBox = { productId: ProductId };

type RuntimeGame = Phaser.Scene & {
  phase: ShiftPhase;
  shiftEnded: boolean;
  soldCount: number;
  stocked: number;
  shelfSlots: RuntimeSlot[];
  loadedProducts: ProductId[];
  selectedBox?: SelectedBox;
  cart: Phaser.GameObjects.Container;
  cartCountText: Phaser.GameObjects.Text;
  worker: Phaser.GameObjects.Image;
  cartAtShelf: boolean;
  movingCart: boolean;
  restockBusy: boolean;
  taskText?: Phaser.GameObjects.Text;
  hintText?: Phaser.GameObjects.Text;
  __campaignDutyText?: Phaser.GameObjects.Text;
  __batchFixtures?: BatchFixture[];
  __batchFlashSaleTriggered?: boolean;
  __batchSurgeWave?: number;
  clearGuide: () => void;
  tryRestockSlot: (slot: RuntimeSlot) => void;
  updateCartCount: () => void;
  updateHud: () => void;
  recordRestockCombo: () => void;
  openStore: () => void;
  showTransientHint: (message: string) => void;
  showPhaseBanner: (message: string) => void;
  setWorkerTexture: (texture: string, width: number, height: number) => void;
};

type GamePrototype = {
  preload: () => void;
  create: () => void;
  createStage: () => void;
  createShelfSlots: () => void;
  tryRestockSlot: (slot: RuntimeSlot) => void;
  snapCart: (destination: "WAREHOUSE" | "SALES") => void;
  handleCartTap: () => void;
  updateHud: () => void;
};

const DAY4_FIXTURES: FixtureSpec[] = [
  { id: "promo", label: "PROMOTION END CAP", productId: "cola", module: "promo", x: 470, y: 620, width: 210, height: 430, color: 0xb46a28 },
  { id: "drinks", label: "DRINKS AISLE", productId: "cola", module: "drinks", x: 715, y: 515, width: 220, height: 540, color: 0x2f6f9f },
  { id: "pantry", label: "PANTRY & SNACKS", productId: "water", module: "pantry", x: 960, y: 515, width: 220, height: 540, color: 0x8a5a2b },
  { id: "dairy", label: "DAIRY COLD CASE", productId: "milk", module: "dairy", x: 1200, y: 515, width: 215, height: 540, color: 0x377c73 }
];

const DAY5_FIXTURES: FixtureSpec[] = [
  { id: "produce", label: "FRESH PRODUCE", productId: "milk", module: "produce", x: 420, y: 720, width: 230, height: 350, color: 0x4f8b4c },
  { id: "promo", label: "WEEKEND DEALS", productId: "cola", module: "promo", x: 650, y: 720, width: 210, height: 350, color: 0xb46a28 },
  { id: "drinks", label: "DRINKS AISLE", productId: "cola", module: "drinks", x: 720, y: 415, width: 210, height: 390, color: 0x2f6f9f },
  { id: "pantry", label: "SNACKS & PANTRY", productId: "water", module: "pantry", x: 950, y: 415, width: 210, height: 390, color: 0x8a5a2b },
  { id: "dairy", label: "DAIRY COLD CASE", productId: "milk", module: "dairy", x: 1180, y: 415, width: 205, height: 390, color: 0x377c73 },
  { id: "household", label: "HOUSEHOLD", productId: "water", module: "pantry", x: 1040, y: 805, width: 235, height: 300, color: 0x6b5b8c }
];

const prototype = GameScene.prototype as unknown as GamePrototype;
const originalPreload = prototype.preload;
const originalCreate = prototype.create;
const originalCreateStage = prototype.createStage;
const originalCreateShelfSlots = prototype.createShelfSlots;
const originalTryRestock = prototype.tryRestockSlot;
const originalSnapCart = prototype.snapCart;
const originalHandleCartTap = prototype.handleCartTap;
const originalUpdateHud = prototype.updateHud;

prototype.preload = function preloadWeekOneBatchFloor(): void {
  originalPreload.call(this);
  if (!isBatchDay(gameSession.day)) return;
  const scene = this as unknown as Phaser.Scene;
  if (!scene.textures.exists(FLOOR_BG)) scene.load.image(FLOOR_BG, FLOOR_BG_PATH);
  Object.values(MODULES).forEach(({ key, path }) => {
    if (!scene.textures.exists(key)) scene.load.image(key, path);
  });
};

prototype.createStage = function createFullSalesFloor(): void {
  if (!isBatchDay(gameSession.day)) {
    originalCreateStage.call(this);
    return;
  }
  const scene = this as unknown as RuntimeGame;
  const background = scene.add.image(665, 591, FLOOR_BG).setDepth(0);
  coverImage(background, 1330, 1182);
  scene.add.rectangle(665, 591, 1330, 1182, 0x07100f, gameSession.day === "day05" ? 0.1 : 0.16).setDepth(1);

  scene.add.rectangle(185, 610, 330, 815, 0x10252a, 0.9)
    .setStrokeStyle(5, 0x78a465)
    .setDepth(2);
  scene.add.text(185, 235, "STOCK DOCK", {
    fontFamily: "Arial", fontSize: "27px", color: "#ffffff", fontStyle: "bold",
    backgroundColor: "#244f2e", padding: { x: 24, y: 11 }
  }).setOrigin(0.5).setDepth(8);
  scene.add.text(185, 285, "LOAD CASES · BUILD A ROUTE · BATCH RESTOCK", {
    fontFamily: "Arial", fontSize: "14px", color: "#d9efdf", fontStyle: "bold", align: "center", wordWrap: { width: 285 }
  }).setOrigin(0.5).setDepth(8);

  const day = gameSession.day as BatchDay;
  const specs = day === "day04" ? DAY4_FIXTURES : DAY5_FIXTURES;
  scene.__batchFixtures = specs.map((spec, index) => createFixture(scene, spec, index));

  scene.add.text(835, 190, day === "day04" ? "PROMOTION PRESSURE · FOUR FULL DISPLAYS" : "WEEKEND RUSH · WHOLE STORE CONTROL", {
    fontFamily: "Arial", fontSize: "25px", color: "#ffffff", fontStyle: "bold",
    backgroundColor: day === "day04" ? "#71451f" : "#4a3f68", padding: { x: 22, y: 10 }
  }).setOrigin(0.5).setDepth(12);
};

prototype.createShelfSlots = function createBatchFixtureSlots(): void {
  if (!isBatchDay(gameSession.day)) {
    originalCreateShelfSlots.call(this);
    return;
  }
  const scene = this as unknown as RuntimeGame;
  const fixtures = scene.__batchFixtures ?? [];
  scene.shelfSlots = fixtures.map((fixture, index) => {
    fixture.slotIndex = index;
    const hitArea = scene.add.rectangle(fixture.x, fixture.y, fixture.width, fixture.height, 0xffffff, 0.001)
      .setDepth(25)
      .setInteractive({ useHandCursor: true });
    const missingTag = scene.add.image(fixture.x, fixture.y + fixture.height * 0.32, Assets.ui.missingTag)
      .setDisplaySize(120, 48)
      .setDepth(24);
    const typeLabel = scene.add.text(fixture.x, fixture.y - fixture.height * 0.43, `${PRODUCTS[fixture.productId].label} CASE · ${fixture.label}`, {
      fontFamily: "Arial", fontSize: "12px", color: "#ffffff", fontStyle: "bold",
      backgroundColor: colorToCss(fixture.color), padding: { x: 6, y: 4 }, align: "center"
    }).setOrigin(0.5).setDepth(23);
    const slot: RuntimeSlot = {
      index,
      productId: fixture.productId,
      hitArea,
      missingTag,
      typeLabel,
      productBottomY: fixture.y + fixture.height * 0.22,
      reservedForCustomer: false
    };
    hitArea.on("pointerdown", () => scene.tryRestockSlot(slot));
    return slot;
  });
};

prototype.tryRestockSlot = function batchRestockWholeDisplay(slot: RuntimeSlot): void {
  if (!isBatchDay(gameSession.day)) {
    originalTryRestock.call(this, slot);
    return;
  }
  const scene = this as unknown as RuntimeGame;
  if (scene.shiftEnded || scene.movingCart || !scene.cartAtShelf || scene.restockBusy) return;
  if (slot.product || slot.reservedForCustomer) return;

  const productIndex = scene.loadedProducts.indexOf(slot.productId);
  if (productIndex < 0) {
    scene.showTransientHint(`Load one ${PRODUCTS[slot.productId].label} case for this full display.`);
    return;
  }

  scene.clearGuide();
  scene.restockBusy = true;
  scene.loadedProducts.splice(productIndex, 1);
  scene.updateCartCount();
  const fixture = scene.__batchFixtures?.[slot.index];
  if (!fixture) {
    scene.restockBusy = false;
    return;
  }

  const icons = [-42, 0, 42].map((offset, index) => {
    const icon = scene.add.image(scene.cart.x, scene.cart.y - 75, PRODUCTS[slot.productId].productKey)
      .setOrigin(0.5, 1)
      .setDepth(70);
    fitInside(icon, 42, 82);
    scene.tweens.add({
      targets: icon,
      x: fixture.x + offset,
      y: fixture.y + 25 + (index % 2) * 35,
      alpha: 0.15,
      duration: 470 + index * 80,
      ease: "Cubic.Out",
      onComplete: () => icon.destroy()
    });
    return icon;
  });
  void icons;

  scene.time.delayedCall(700, () => {
    if (!scene.scene.isActive()) return;
    const marker = scene.add.image(fixture.x, fixture.y, PRODUCTS[slot.productId].productKey)
      .setVisible(false)
      .setDepth(2);
    slot.product = marker;
    slot.missingTag.setVisible(false);
    scene.stocked += 1;
    scene.recordRestockCombo();
    fixture.stocked = true;
    applyFixtureState(fixture, true);
    scene.showPhaseBanner(`BATCH RESTOCK · ${fixture.label}`);
    scene.showTransientHint(`${fixture.label} filled from one case. Keep the cart moving.`);
    if (scene.stocked >= scene.shelfSlots.length && scene.phase === "PREPARE") scene.openStore();
    scene.restockBusy = false;
    scene.updateHud();
  });
};

prototype.snapCart = function snapBatchCart(destination: "WAREHOUSE" | "SALES"): void {
  if (!isBatchDay(gameSession.day)) {
    originalSnapCart.call(this, destination);
    return;
  }
  const scene = this as unknown as RuntimeGame;
  const cartTarget = destination === "SALES" ? CART_FLOOR : CART_HOME;
  const workerTarget = destination === "SALES" ? WORKER_FLOOR : WORKER_HOME;
  scene.movingCart = true;
  scene.tweens.add({ targets: scene.cart, x: cartTarget.x, y: cartTarget.y, duration: 330, ease: "Sine.Out" });
  scene.tweens.add({
    targets: scene.worker,
    x: workerTarget.x,
    y: workerTarget.y,
    duration: 330,
    ease: "Sine.Out",
    onComplete: () => {
      scene.cartAtShelf = destination === "SALES";
      scene.movingCart = false;
      scene.setWorkerTexture(Assets.characters.workerIdle, destination === "SALES" ? 205 : 220, destination === "SALES" ? 420 : 440);
      scene.updateHud();
    }
  });
};

prototype.handleCartTap = function handleBatchCartTap(): void {
  if (!isBatchDay(gameSession.day)) {
    originalHandleCartTap.call(this);
    return;
  }
  const scene = this as unknown as RuntimeGame;
  if (scene.shiftEnded || scene.movingCart || scene.restockBusy) return;
  if (scene.selectedBox) {
    originalHandleCartTap.call(this);
    return;
  }
  if (!scene.cartAtShelf) {
    if (scene.loadedProducts.length === 0) {
      scene.showTransientHint("Load at least one case, then tap the cart to enter the sales floor.");
      return;
    }
    prototype.snapCart.call(this, "SALES");
    return;
  }
  prototype.snapCart.call(this, "WAREHOUSE");
};

prototype.updateHud = function updateBatchRestockHud(): void {
  originalUpdateHud.call(this);
  if (!isBatchDay(gameSession.day)) return;
  const scene = this as unknown as RuntimeGame;
  const total = scene.shelfSlots.length;
  const filled = scene.shelfSlots.filter((slot) => Boolean(slot.product)).length;
  const dayNumber = Number(gameSession.day.slice(-2));
  const title = gameSession.day === "day04" ? "PROMOTION PRESSURE" : "WEEKEND RUSH";
  const duty = scene.phase === "PREPARE"
    ? `BATCH RESTOCK ${filled}/${total} FULL DISPLAYS`
    : scene.phase === "OPEN"
      ? `KEEP THE FLOOR FULL · SALES ${scene.soldCount}/${LEVELS[gameSession.day].salesTargets.rushToClosing}`
      : scene.phase === "RUSH"
        ? `PRIORITIZE LOW DISPLAYS · SALES ${scene.soldCount}/${LEVELS[gameSession.day].salesTargets.rushToClosing}`
        : scene.phase === "CLOSING"
          ? "RETURN THE CART AND CLOSE THE STORE"
          : "SHIFT COMPLETE";
  scene.taskText?.setText(`DAY ${dayNumber} · ${title} · ${duty}`);
  scene.__campaignDutyText?.setText(`DAY ${dayNumber} · ${title} · ${duty}`);
  if (scene.phase === "PREPARE") {
    scene.hintText?.setText("LOAD A MATCHING CASE · TAP CART TO MOVE · ONE CASE FILLS ONE COMPLETE DISPLAY");
  }
};

prototype.create = function createBatchRestockShift(): void {
  originalCreate.call(this);
  if (!isBatchDay(gameSession.day)) return;
  const scene = this as unknown as RuntimeGame;
  document.body.dataset.weekOneBatchFloor = gameSession.day;
  scene.cart.setPosition(CART_HOME.x, CART_HOME.y);
  scene.worker.setPosition(WORKER_HOME.x, WORKER_HOME.y);
  scene.cartAtShelf = false;
  scene.__batchFlashSaleTriggered = false;
  scene.__batchSurgeWave = 0;
  rewriteHeader(scene);

  let lastMonitor = -Infinity;
  const monitor = (): void => {
    if (scene.time.now - lastMonitor < 160) return;
    lastMonitor = scene.time.now;
    synchronizeFixtures(scene);
    triggerDemandEvents(scene);
  };
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, monitor);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, monitor);
    delete document.body.dataset.weekOneBatchFloor;
  });

  const testWindow = window as unknown as { __GAME_TEST__?: Record<string, unknown> };
  testWindow.__GAME_TEST__ ??= {};
  testWindow.__GAME_TEST__.startWeekOneDay = (day: BatchDay): void => {
    if (!isBatchDay(day)) return;
    try {
      localStorage.setItem("supermarket.activeDay", day);
    } catch {
      // Test still works in memory.
    }
    gameSession.reset(day);
    scene.scene.start("game");
  };

  scene.time.delayedCall(500, () => {
    if (!scene.scene.isActive()) return;
    scene.showTransientHint(gameSession.day === "day04"
      ? "Fill all four displays, then protect the promotion end cap during the flash sale."
      : "Plan a route across six departments. Two weekend demand surges are coming.");
  });
};

function createFixture(scene: RuntimeGame, spec: FixtureSpec, slotIndex: number): BatchFixture {
  scene.add.rectangle(spec.x, spec.y, spec.width + 18, spec.height + 18, 0x0b1719, 0.58)
    .setStrokeStyle(4, spec.color, 0.95)
    .setDepth(3);
  const image = scene.add.image(spec.x, spec.y + 8, MODULES[spec.module].key).setDepth(4);
  fitInside(image, spec.width, spec.height - 52);
  const emptyShade = scene.add.rectangle(spec.x, spec.y + 8, spec.width - 10, spec.height - 60, 0x071010, 0.58).setDepth(5);
  const status = scene.add.text(spec.x, spec.y + spec.height * 0.34, "LOW STOCK", {
    fontFamily: "Arial", fontSize: "17px", color: "#ffffff", fontStyle: "bold",
    backgroundColor: "#8f2f25", padding: { x: 12, y: 7 }
  }).setOrigin(0.5).setDepth(7);
  scene.add.text(spec.x, spec.y - spec.height * 0.47, spec.label, {
    fontFamily: "Arial", fontSize: "17px", color: "#ffffff", fontStyle: "bold",
    backgroundColor: colorToCss(spec.color), padding: { x: 13, y: 8 }, align: "center"
  }).setOrigin(0.5).setDepth(8);
  const fixture: BatchFixture = { ...spec, image, emptyShade, status, slotIndex, stocked: false };
  applyFixtureState(fixture, false);
  return fixture;
}

function synchronizeFixtures(scene: RuntimeGame): void {
  (scene.__batchFixtures ?? []).forEach((fixture, index) => {
    const stocked = Boolean(scene.shelfSlots[index]?.product?.active);
    if (fixture.stocked !== stocked) {
      fixture.stocked = stocked;
      applyFixtureState(fixture, stocked);
    }
  });
}

function applyFixtureState(fixture: BatchFixture, stocked: boolean): void {
  if (stocked) {
    fixture.image.clearTint().setAlpha(1);
    fixture.emptyShade.setVisible(false);
    fixture.status.setText("FULL DISPLAY").setBackgroundColor("#315f4b");
  } else {
    fixture.image.setTint(0x66706d).setAlpha(0.72);
    fixture.emptyShade.setVisible(true);
    fixture.status.setText("LOW STOCK").setBackgroundColor("#8f2f25");
  }
}

function triggerDemandEvents(scene: RuntimeGame): void {
  if (scene.shiftEnded || scene.phase === "PREPARE" || scene.phase === "CLOSING" || scene.phase === "RESULT") return;
  if (gameSession.day === "day04" && scene.phase === "RUSH" && !scene.__batchFlashSaleTriggered) {
    scene.__batchFlashSaleTriggered = true;
    depleteFixtures(scene, [0, 1]);
    scene.showPhaseBanner("FLASH SALE · PROMOTION DRAIN");
    scene.showTransientHint("The flash sale emptied Promotion and Drinks. Load two cases and batch-restock both displays.");
    return;
  }
  if (gameSession.day !== "day05") return;
  const wave = scene.__batchSurgeWave ?? 0;
  if (wave === 0 && scene.soldCount >= 4) {
    scene.__batchSurgeWave = 1;
    depleteFixtures(scene, [0, 2]);
    scene.showPhaseBanner("WEEKEND SURGE 1");
    scene.showTransientHint("Produce and Drinks dropped together. Choose the fastest route.");
  } else if (wave === 1 && scene.soldCount >= 10) {
    scene.__batchSurgeWave = 2;
    depleteFixtures(scene, [1, 3, 4]);
    scene.showPhaseBanner("WEEKEND SURGE 2");
    scene.showTransientHint("Three departments are low. Prioritize customer demand before closing.");
  }
}

function depleteFixtures(scene: RuntimeGame, indices: number[]): void {
  indices.forEach((index) => {
    const slot = scene.shelfSlots[index];
    if (!slot || slot.reservedForCustomer || !slot.product) return;
    slot.product.destroy();
    slot.product = undefined;
    slot.missingTag.setVisible(true);
    scene.stocked = Math.max(0, scene.stocked - 1);
  });
  scene.updateHud();
}

function rewriteHeader(scene: RuntimeGame): void {
  scene.children.list
    .filter((child): child is Phaser.GameObjects.Text => child instanceof Phaser.GameObjects.Text && child.active)
    .forEach((text) => {
      const value = text.text.trim().toUpperCase();
      if (value === "MORNING SHIFT") text.setText(`WEEK ONE · DAY ${Number(gameSession.day.slice(-2))}`);
      if (value === "RESTOCK DRINKS") text.setText(gameSession.day === "day04" ? "PROMOTION PRESSURE" : "WEEKEND RUSH");
    });
}

function coverImage(image: Phaser.GameObjects.Image, width: number, height: number): void {
  const sourceWidth = Math.max(1, image.width);
  const sourceHeight = Math.max(1, image.height);
  image.setScale(Math.max(width / sourceWidth, height / sourceHeight));
}

function fitInside(image: Phaser.GameObjects.Image, width: number, height: number): void {
  const sourceWidth = Math.max(1, image.width);
  const sourceHeight = Math.max(1, image.height);
  image.setScale(Math.min(width / sourceWidth, height / sourceHeight));
}

function colorToCss(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

function isBatchDay(day: unknown): day is BatchDay {
  return day === "day04" || day === "day05";
}
