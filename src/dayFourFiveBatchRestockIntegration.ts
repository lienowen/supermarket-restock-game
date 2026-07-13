import Phaser from "phaser";
import { Assets } from "./assets";
import { PRODUCTS, type ProductId } from "./gameConfig";
import { LEVELS } from "./levels/levelConfigs";
import { GameScene } from "./scenes/GameScene";
import { gameSession } from "./systems/GameSession";

const FLOOR_BG = "week-one-realistic-sales-floor";
const FLOOR_BG_PATH = "assets/day02/promotion/promotion_wing_background.png";
const CART_HOME = { x: 455, y: 920 };
const CART_FLOOR = { x: 650, y: 920 };
const WORKER_HOME = { x: 360, y: 830 };
const WORKER_FLOOR = { x: 575, y: 835 };

type ShiftPhase = "PREPARE" | "OPEN" | "RUSH" | "CLOSING" | "RESULT";
type BatchDay = "day04" | "day05";

type FixtureSpec = {
  id: string;
  label: string;
  productId: ProductId;
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
  lowOverlay: Phaser.GameObjects.Rectangle;
  outline: Phaser.GameObjects.Rectangle;
  status: Phaser.GameObjects.Text;
  stocked: boolean;
};

type SelectedBox = { productId: ProductId };

type RuntimeGame = Phaser.Scene & {
  phase: ShiftPhase;
  shiftEnded: boolean;
  soldCount: number;
  stocked: number;
  stars: number;
  money: number;
  remainingSeconds: number;
  shelfSlots: RuntimeSlot[];
  loadedProducts: ProductId[];
  selectedBox?: SelectedBox;
  cart: Phaser.GameObjects.Container;
  worker: Phaser.GameObjects.Image;
  cartAtShelf: boolean;
  movingCart: boolean;
  restockBusy: boolean;
  taskText?: Phaser.GameObjects.Text;
  hintText?: Phaser.GameObjects.Text;
  __campaignDutyStrip?: Phaser.GameObjects.Container;
  __campaignDutyText?: Phaser.GameObjects.Text;
  __contractPanel?: Phaser.GameObjects.Container;
  __supervisorContractPanel?: Phaser.GameObjects.Container;
  __batchFixtures?: BatchFixture[];
  __batchFlashSaleTriggered?: boolean;
  __batchSurgeWave?: number;
  __batchStatsText?: Phaser.GameObjects.Text;
  __batchDutyText?: Phaser.GameObjects.Text;
  __batchHintText?: Phaser.GameObjects.Text;
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
  { id: "promo", label: "PROMOTION DISPLAY", productId: "cola", x: 465, y: 650, width: 190, height: 330, color: 0xb46a28 },
  { id: "drinks", label: "DRINKS AISLE", productId: "cola", x: 675, y: 610, width: 190, height: 390, color: 0x2f6f9f },
  { id: "value", label: "VALUE END CAP", productId: "water", x: 875, y: 620, width: 180, height: 370, color: 0x8a5a2b },
  { id: "dairy", label: "DAIRY & COLD", productId: "milk", x: 1110, y: 560, width: 245, height: 470, color: 0x377c73 }
];

const DAY5_FIXTURES: FixtureSpec[] = [
  { id: "drinks", label: "COLA & SODA", productId: "cola", x: 445, y: 510, width: 185, height: 380, color: 0x2f6f9f },
  { id: "water", label: "BOTTLED WATER", productId: "water", x: 645, y: 510, width: 185, height: 380, color: 0x3c7fa6 },
  { id: "pantry", label: "FAMILY VALUE", productId: "water", x: 845, y: 510, width: 185, height: 380, color: 0x8a5a2b },
  { id: "dairy", label: "DAIRY COLD CASE", productId: "milk", x: 1065, y: 500, width: 220, height: 400, color: 0x377c73 },
  { id: "promo", label: "WEEKEND DEALS", productId: "cola", x: 575, y: 825, width: 250, height: 245, color: 0xb46a28 },
  { id: "front", label: "FRONT COOLER", productId: "milk", x: 900, y: 825, width: 250, height: 245, color: 0x6b5b8c }
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
};

prototype.createStage = function createRealisticFullSalesFloor(): void {
  if (!isBatchDay(gameSession.day)) {
    originalCreateStage.call(this);
    return;
  }

  const scene = this as unknown as RuntimeGame;
  scene.add.image(665, 591, FLOOR_BG)
    .setDisplaySize(1330, 1182)
    .setDepth(0);
  scene.add.rectangle(665, 591, 1330, 1182, 0x07100f, gameSession.day === "day05" ? 0.06 : 0.1)
    .setDepth(1);

  scene.add.rectangle(170, 635, 320, 900, 0x10252a, 0.82)
    .setStrokeStyle(4, 0x78a465, 0.95)
    .setDepth(2);
  scene.add.text(170, 350, "STOCK DOCK", {
    fontFamily: "Arial",
    fontSize: "27px",
    color: "#ffffff",
    fontStyle: "bold",
    backgroundColor: "#244f2e",
    padding: { x: 25, y: 11 }
  }).setOrigin(0.5).setDepth(8);
  scene.add.text(170, 405, "LOAD CASES\nBUILD A ROUTE\nBATCH RESTOCK", {
    fontFamily: "Arial",
    fontSize: "16px",
    color: "#d9efdf",
    fontStyle: "bold",
    align: "center",
    lineSpacing: 9
  }).setOrigin(0.5).setDepth(8);

  const specs = gameSession.day === "day04" ? DAY4_FIXTURES : DAY5_FIXTURES;
  scene.__batchFixtures = specs.map((spec) => createFixtureZone(scene, spec));
};

prototype.createShelfSlots = function createBatchFixtureSlots(): void {
  if (!isBatchDay(gameSession.day)) {
    originalCreateShelfSlots.call(this);
    return;
  }

  const scene = this as unknown as RuntimeGame;
  const fixtures = scene.__batchFixtures ?? [];
  scene.shelfSlots = fixtures.map((fixture, index) => {
    const hitArea = scene.add.rectangle(fixture.x, fixture.y, fixture.width, fixture.height, 0xffffff, 0.001)
      .setDepth(32)
      .setInteractive({ useHandCursor: true });
    const missingTag = scene.add.image(fixture.x, fixture.y, Assets.ui.missingTag)
      .setDisplaySize(1, 1)
      .setAlpha(0)
      .setDepth(3);
    const typeLabel = scene.add.text(-2000, -2000, fixture.label).setVisible(false);
    const slot: RuntimeSlot = {
      index,
      productId: fixture.productId,
      hitArea,
      missingTag,
      typeLabel,
      productBottomY: fixture.y + fixture.height * 0.2,
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
    scene.showTransientHint(`Load one ${PRODUCTS[slot.productId].label} case for ${scene.__batchFixtures?.[slot.index]?.label ?? "this display"}.`);
    return;
  }

  const fixture = scene.__batchFixtures?.[slot.index];
  if (!fixture) return;

  scene.clearGuide();
  scene.restockBusy = true;
  scene.loadedProducts.splice(productIndex, 1);
  scene.updateCartCount();

  [-58, -20, 20, 58].forEach((offset, index) => {
    const icon = scene.add.image(scene.cart.x, scene.cart.y - 75, PRODUCTS[slot.productId].productKey)
      .setOrigin(0.5, 1)
      .setDepth(9050);
    fitInside(icon, 38, 76);
    scene.tweens.add({
      targets: icon,
      x: fixture.x + offset,
      y: fixture.y + 20 + (index % 2) * 34,
      alpha: 0,
      duration: 430 + index * 70,
      ease: "Cubic.Out",
      onComplete: () => icon.destroy()
    });
  });

  scene.time.delayedCall(680, () => {
    if (!scene.scene.isActive()) return;
    const marker = scene.add.image(fixture.x, fixture.y, PRODUCTS[slot.productId].productKey)
      .setVisible(false)
      .setDepth(2);
    slot.product = marker;
    scene.stocked += 1;
    scene.recordRestockCombo();
    fixture.stocked = true;
    applyFixtureState(fixture, true);
    scene.showPhaseBanner(`BATCH RESTOCK · ${fixture.label}`);
    scene.showTransientHint(`${fixture.label} is full. One case restored the complete display.`);
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
      scene.showTransientHint("Load one or more cases, then tap the cart to enter the sales floor.");
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
  syncReleaseHud(this as unknown as RuntimeGame);
};

prototype.create = function createBatchRestockShift(): void {
  originalCreate.call(this);
  if (!isBatchDay(gameSession.day)) return;

  const scene = this as unknown as RuntimeGame;
  document.body.dataset.weekOneBatchFloor = gameSession.day;
  scene.__campaignDutyStrip?.destroy(true);
  scene.__campaignDutyStrip = undefined;
  scene.__contractPanel?.destroy(true);
  scene.__contractPanel = undefined;
  scene.__supervisorContractPanel?.destroy(true);
  scene.__supervisorContractPanel = undefined;

  scene.cart.setPosition(CART_HOME.x, CART_HOME.y).setDepth(70);
  scene.worker.setPosition(WORKER_HOME.x, WORKER_HOME.y).setDepth(68);
  scene.cartAtShelf = false;
  scene.__batchFlashSaleTriggered = false;
  scene.__batchSurgeWave = 0;
  createReleaseHud(scene);
  syncReleaseHud(scene);

  let lastMonitor = -Infinity;
  const monitor = (): void => {
    if (scene.time.now - lastMonitor < 140) return;
    lastMonitor = scene.time.now;
    synchronizeFixtures(scene);
    triggerDemandEvents(scene);
    syncReleaseHud(scene);
  };
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, monitor);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, monitor);
    delete document.body.dataset.weekOneBatchFloor;
  });

  scene.time.delayedCall(500, () => {
    if (!scene.scene.isActive()) return;
    scene.showTransientHint(gameSession.day === "day04"
      ? "Fill four displays, then protect Promotion and Drinks during the flash sale."
      : "Plan a route across six displays. Two weekend demand surges are coming.");
  });
};

function createFixtureZone(scene: RuntimeGame, spec: FixtureSpec): BatchFixture {
  const outline = scene.add.rectangle(spec.x, spec.y, spec.width, spec.height, 0xffffff, 0.001)
    .setStrokeStyle(5, spec.color, 0.98)
    .setDepth(12);
  const lowOverlay = scene.add.rectangle(spec.x, spec.y, spec.width - 8, spec.height - 8, 0x071010, 0.5)
    .setDepth(11);
  const label = scene.add.text(spec.x, spec.y - spec.height / 2 + 23, spec.label, {
    fontFamily: "Arial",
    fontSize: spec.width < 200 ? "14px" : "16px",
    color: "#ffffff",
    fontStyle: "bold",
    backgroundColor: colorToCss(spec.color),
    padding: { x: 11, y: 7 },
    align: "center"
  }).setOrigin(0.5).setDepth(14);
  const status = scene.add.text(spec.x, spec.y + spec.height / 2 - 28, "LOW STOCK", {
    fontFamily: "Arial",
    fontSize: "15px",
    color: "#ffffff",
    fontStyle: "bold",
    backgroundColor: "#8f2f25",
    padding: { x: 12, y: 7 }
  }).setOrigin(0.5).setDepth(14);
  void label;
  const fixture: BatchFixture = { ...spec, lowOverlay, outline, status, stocked: false };
  applyFixtureState(fixture, false);
  return fixture;
}

function createReleaseHud(scene: RuntimeGame): void {
  scene.add.rectangle(665, 70, 1330, 140, 0x091517, 0.985)
    .setStrokeStyle(2, 0x42585b)
    .setDepth(9000);
  const day = Number(gameSession.day.slice(-2));
  scene.add.rectangle(88, 70, 138, 82, gameSession.day === "day04" ? 0x9b5e25 : 0x5b4b80, 1)
    .setStrokeStyle(3, 0xffdd78)
    .setDepth(9001);
  scene.add.text(88, 70, `DAY ${day}`, {
    fontFamily: "Arial",
    fontSize: "25px",
    color: "#ffffff",
    fontStyle: "bold"
  }).setOrigin(0.5).setDepth(9002);
  scene.add.text(180, 31, gameSession.day === "day04" ? "PROMOTION PRESSURE" : "WEEKEND RUSH", {
    fontFamily: "Arial",
    fontSize: "31px",
    color: "#ffffff",
    fontStyle: "bold"
  }).setDepth(9002);
  scene.add.text(180, 78, gameSession.day === "day04"
    ? "PROMOTION SUPERVISOR · FOUR FULL DISPLAYS · FLASH SALE"
    : "WEEKEND DUTY MANAGER · SIX DISPLAYS · TWO DEMAND SURGES", {
    fontFamily: "Arial",
    fontSize: "17px",
    color: "#f4d98a",
    fontStyle: "bold"
  }).setDepth(9002);
  scene.__batchStatsText = scene.add.text(1065, 70, "", {
    fontFamily: "Arial",
    fontSize: "20px",
    color: "#ffffff",
    fontStyle: "bold",
    align: "right",
    lineSpacing: 5
  }).setOrigin(1, 0.5).setDepth(9002);

  scene.add.rectangle(300, 240, 540, 145, 0x10252a, 0.98)
    .setStrokeStyle(4, 0xffd75a)
    .setDepth(9000);
  scene.add.text(300, 207, "BATCH RESTOCK MODE", {
    fontFamily: "Arial",
    fontSize: "23px",
    color: "#fff2a8",
    fontStyle: "bold"
  }).setOrigin(0.5).setDepth(9002);
  scene.add.text(300, 258, gameSession.day === "day04"
    ? "1 CASE  →  1 FULL DISPLAY\nKEEP PROMOTION LOOKING FULL"
    : "LOAD A ROUTE  →  RESTORE SIX DISPLAYS\nPRIORITIZE THE BUSIEST AISLES", {
    fontFamily: "Arial",
    fontSize: "17px",
    color: "#ffffff",
    fontStyle: "bold",
    align: "center",
    lineSpacing: 7
  }).setOrigin(0.5).setDepth(9002);

  scene.add.rectangle(665, 1063, 1220, 116, 0x0b1719, 0.98)
    .setStrokeStyle(4, 0xffd75a)
    .setDepth(9000);
  scene.__batchDutyText = scene.add.text(665, 1037, "", {
    fontFamily: "Arial",
    fontSize: "19px",
    color: "#ffffff",
    fontStyle: "bold",
    align: "center"
  }).setOrigin(0.5).setDepth(9002);
  scene.__batchHintText = scene.add.text(665, 1085, "", {
    fontFamily: "Arial",
    fontSize: "20px",
    color: "#fff2bd",
    fontStyle: "bold",
    align: "center",
    wordWrap: { width: 1120 }
  }).setOrigin(0.5).setDepth(9002);
}

function syncReleaseHud(scene: RuntimeGame): void {
  const total = scene.shelfSlots.length;
  const filled = scene.shelfSlots.filter((slot) => Boolean(slot.product?.active)).length;
  const target = LEVELS[gameSession.day].salesTargets.rushToClosing;
  const minutes = Math.floor(Math.max(0, scene.remainingSeconds) / 60);
  const seconds = Math.max(0, scene.remainingSeconds) % 60;
  scene.__batchStatsText?.setText([
    `★ ${scene.stars}    COINS ${scene.money}`,
    `SALES ${scene.soldCount}/${target}    TIME ${minutes}:${String(seconds).padStart(2, "0")}`
  ]);

  const title = gameSession.day === "day04" ? "PROMOTION PRESSURE" : "WEEKEND RUSH";
  const duty = scene.phase === "PREPARE"
    ? `BATCH RESTOCK ${filled}/${total} FULL DISPLAYS`
    : scene.phase === "OPEN"
      ? `KEEP DISPLAYS FULL · SALES ${scene.soldCount}/${target}`
      : scene.phase === "RUSH"
        ? `PRIORITIZE LOW DISPLAYS · SALES ${scene.soldCount}/${target}`
        : scene.phase === "CLOSING"
          ? "RETURN THE CART AND CLOSE THE STORE"
          : "SHIFT COMPLETE";
  scene.__batchDutyText?.setText(`DAY ${Number(gameSession.day.slice(-2))} · ${title} · ${duty}`);
  scene.__batchHintText?.setText(scene.phase === "PREPARE"
    ? "LOAD MATCHING CASES · TAP THE CART TO MOVE · TAP A LOW-STOCK AREA TO FILL THE COMPLETE DISPLAY"
    : scene.phase === "RUSH"
      ? "WATCH THE RED LOW-STOCK LABELS · BATCH-RESTOCK THE BUSIEST DISPLAY FIRST"
      : "KEEP THE SALES FLOOR LOOKING FULL WHILE CUSTOMERS SHOP");
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
    fixture.lowOverlay.setAlpha(0.04);
    fixture.outline.setStrokeStyle(4, 0x7ed58a, 0.92);
    fixture.status.setText("FULL DISPLAY").setBackgroundColor("#315f4b");
  } else {
    fixture.lowOverlay.setAlpha(0.5);
    fixture.outline.setStrokeStyle(5, fixture.color, 0.98);
    fixture.status.setText("LOW STOCK").setBackgroundColor("#8f2f25");
  }
}

function triggerDemandEvents(scene: RuntimeGame): void {
  if (scene.shiftEnded || scene.phase === "PREPARE" || scene.phase === "CLOSING" || scene.phase === "RESULT") return;

  if (gameSession.day === "day04" && scene.phase === "RUSH" && !scene.__batchFlashSaleTriggered) {
    scene.__batchFlashSaleTriggered = true;
    depleteFixtures(scene, [0, 1]);
    scene.showPhaseBanner("FLASH SALE · TWO DISPLAYS DRAINED");
    scene.showTransientHint("Promotion and Drinks are low. Load two matching cases and restore both displays.");
    return;
  }

  if (gameSession.day !== "day05") return;
  const wave = scene.__batchSurgeWave ?? 0;
  if (wave === 0 && scene.soldCount >= 4) {
    scene.__batchSurgeWave = 1;
    depleteFixtures(scene, [0, 1]);
    scene.showPhaseBanner("WEEKEND SURGE 1");
    scene.showTransientHint("Cola and Water dropped together. Choose the fastest route.");
  } else if (wave === 1 && scene.soldCount >= 10) {
    scene.__batchSurgeWave = 2;
    depleteFixtures(scene, [2, 3, 4]);
    scene.showPhaseBanner("WEEKEND SURGE 2");
    scene.showTransientHint("Three displays are low. Prioritize the busiest aisle before closing.");
  }
}

function depleteFixtures(scene: RuntimeGame, indices: number[]): void {
  indices.forEach((index) => {
    const slot = scene.shelfSlots[index];
    if (!slot || slot.reservedForCustomer || !slot.product) return;
    slot.product.destroy();
    slot.product = undefined;
    scene.stocked = Math.max(0, scene.stocked - 1);
  });
  scene.updateHud();
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
