import Phaser from "phaser";
import { Assets } from "./assets";
import { PRODUCTS, type ProductId } from "./gameConfig";
import { GameScene } from "./scenes/GameScene";
import { BackStockScene } from "./scenes/BackStockScene";
import { gameSession } from "./systems/GameSession";

type MainSlot = {
  index?: number;
  productId: ProductId;
  hitArea: Phaser.GameObjects.Rectangle;
  missingTag: Phaser.GameObjects.Image;
  typeLabel?: Phaser.GameObjects.Text;
  productBottomY: number;
  product?: Phaser.GameObjects.Image;
  reservedForCustomer: boolean;
};

type PromoSlot = MainSlot & {
  promoIndex: number;
  zone: "PROMO";
};

type RuntimeGameScene = Phaser.Scene & {
  shelfSlots: MainSlot[];
  phase: "PREPARE" | "OPEN" | "RUSH" | "CLOSING" | "RESULT";
  shiftEnded: boolean;
  movingCart: boolean;
  restockBusy: boolean;
  cartAtShelf: boolean;
  loadedProducts: ProductId[];
  cart: Phaser.GameObjects.Container;
  worker: Phaser.GameObjects.Image;
  customerSequence: number;
  money: number;
  soldCount: number;
  stocked: number;
  __day2FeaturedProduct?: ProductId;
  __day2PromoActive?: boolean;
  __day2PromoSeconds?: number;
  __day2BackStockSaves?: number;
  __day2PromoUnlocked?: boolean;
  __day2PromoSlots?: PromoSlot[];
  __day2PromoObjects?: Phaser.GameObjects.GameObject[];
  __day2PromoTitle?: Phaser.GameObjects.Text;
  __day2PromoStockText?: Phaser.GameObjects.Text;
  __day2PromoMonitor?: () => void;
  __day2PromoLostAt?: number;
  __day2DealStatus?: Phaser.GameObjects.Text;
  fitImage: (image: Phaser.GameObjects.Image, maxWidth: number, maxHeight: number) => void;
  updateCartCount: () => void;
  updateHud: () => void;
  updateStars: () => void;
  showTransientHint: (message: string) => void;
  showIncome: (x: number, y: number, amount: number) => void;
  advanceBusinessPhase: () => void;
  recordRestockCombo: () => void;
  setWorkerTexture: (texture: string, maxWidth: number, maxHeight: number) => void;
};

type GamePrototype = {
  create: () => void;
  openStore: () => void;
  customerPurchase: () => void;
};

type RuntimeBackStockScene = Phaser.Scene & {
  gameScene?: RuntimeGameScene;
  inventory: Record<ProductId, number>;
};

type BackStockPrototype = {
  quickRestock: (productId: ProductId) => void;
};

const MAIN_COLUMNS = [930, 1060, 1190] as const;
const PROMO_X = 785;
const PROMO_SLOT_Y = [372, 527, 682] as const;
const PROMO_RESTOCK_BONUS = 4;
const PROMO_SALE_BONUS = 3;

const gamePrototype = GameScene.prototype as unknown as GamePrototype;
const originalCreate = gamePrototype.create;
const originalOpenStore = gamePrototype.openStore;
const originalCustomerPurchase = gamePrototype.customerPurchase;

gamePrototype.create = function createWithExpandedDayTwoSalesFloor(): void {
  originalCreate.call(this);
  const scene = this as unknown as RuntimeGameScene;
  if (gameSession.day !== "day02") return;

  resetExpansion(scene);
  moveMainCoolerRight(scene);
  createPromotionZoneShell(scene);

  const monitor = (): void => {
    if (!scene.scene.isActive() || gameSession.day !== "day02") return;
    if (scene.__day2FeaturedProduct && !scene.__day2PromoSlots?.length) {
      createPromoSlots(scene, scene.__day2FeaturedProduct);
    }
    refreshPromotionZone(scene);
  };

  scene.__day2PromoMonitor = monitor;
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, monitor);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => cleanupExpansion(scene, monitor));
};

gamePrototype.openStore = function openDayTwoPromotionEndCap(): void {
  const scene = this as unknown as RuntimeGameScene;
  originalOpenStore.call(this);

  if (gameSession.day !== "day02") return;
  const featured = scene.__day2FeaturedProduct ?? "water";
  if (!scene.__day2PromoSlots?.length) createPromoSlots(scene, featured);
  unlockPromotionZone(scene);
};

gamePrototype.customerPurchase = function customerPurchaseFromExpandedDayTwoFloor(): void {
  const scene = this as unknown as RuntimeGameScene;
  if (
    gameSession.day !== "day02" ||
    !scene.__day2PromoUnlocked ||
    scene.shiftEnded ||
    (scene.phase !== "OPEN" && scene.phase !== "RUSH")
  ) {
    originalCustomerPurchase.call(this);
    return;
  }

  const availablePromo = (scene.__day2PromoSlots ?? []).filter(
    (slot) => slot.product && !slot.reservedForCustomer
  );
  const preference = scene.__day2PromoActive ? 0.82 : 0.34;
  const wantsPromotion = Phaser.Math.FloatBetween(0, 1) <= preference;

  if (wantsPromotion && availablePromo.length > 0) {
    purchaseFromPromoDisplay(scene, Phaser.Utils.Array.GetRandom(availablePromo));
    return;
  }

  if (wantsPromotion && scene.__day2PromoActive && availablePromo.length === 0) {
    const now = scene.time.now;
    const lastLost = scene.__day2PromoLostAt ?? -Infinity;
    if (now - lastLost >= 2200) {
      scene.__day2PromoLostAt = now;
      showPromoLostSale(scene);
      return;
    }
  }

  originalCustomerPurchase.call(this);
};

function resetExpansion(scene: RuntimeGameScene): void {
  scene.__day2PromoUnlocked = false;
  scene.__day2PromoSlots = undefined;
  scene.__day2PromoObjects?.forEach((object) => object.destroy());
  scene.__day2PromoObjects = [];
  scene.__day2PromoTitle = undefined;
  scene.__day2PromoStockText = undefined;
  scene.__day2PromoLostAt = undefined;
}

function moveMainCoolerRight(scene: RuntimeGameScene): void {
  const shelf = scene.children.list.find((child) =>
    child instanceof Phaser.GameObjects.Image &&
    child.texture.key === Assets.props.shelf &&
    child.x > 700
  ) as Phaser.GameObjects.Image | undefined;

  shelf?.setPosition(1070, 510).setDisplaySize(500, 690);

  scene.shelfSlots.forEach((slot, index) => {
    const x = MAIN_COLUMNS[index % MAIN_COLUMNS.length];
    slot.hitArea.setPosition(x, slot.hitArea.y).setSize(108, 128);
    slot.missingTag.setPosition(x, slot.missingTag.y);
    slot.typeLabel?.setPosition(x, slot.typeLabel.y);
    slot.product?.setX(x);
  });

  const mainLabelBg = scene.add.rectangle(1070, 220, 360, 48, 0x213d55, 0.97)
    .setStrokeStyle(2, 0x8db7d2)
    .setDepth(5);
  const mainLabel = scene.add.text(1070, 220, "MAIN COOLER · 6 SLOTS", {
    fontFamily: "Arial",
    fontSize: "18px",
    color: "#e5f4ff",
    fontStyle: "bold",
    letterSpacing: 1
  }).setOrigin(0.5).setDepth(6);

  scene.__day2PromoObjects?.push(mainLabelBg, mainLabel);
}

function createPromotionZoneShell(scene: RuntimeGameScene): void {
  const floorZone = scene.add.rectangle(PROMO_X, 548, 205, 590, 0x102126, 0.42)
    .setStrokeStyle(3, 0xd29b3d, 0.75)
    .setDepth(2);
  const shadow = scene.add.ellipse(PROMO_X, 797, 192, 25, 0x071010, 0.34).setDepth(3);
  const stand = scene.add.rectangle(PROMO_X, 530, 188, 520, 0x294047, 0.98)
    .setStrokeStyle(7, 0x7f9698)
    .setDepth(4);
  const backing = scene.add.rectangle(PROMO_X, 526, 158, 454, 0x172b31, 1).setDepth(5);
  const banner = scene.add.rectangle(PROMO_X, 278, 220, 76, 0xa9571d, 1)
    .setStrokeStyle(5, 0xffd75a)
    .setDepth(8);
  const newArea = scene.add.text(PROMO_X, 256, "NEW AREA", {
    fontFamily: "Arial",
    fontSize: "13px",
    color: "#ffe29a",
    fontStyle: "bold",
    letterSpacing: 3
  }).setOrigin(0.5).setDepth(9);
  const title = scene.add.text(PROMO_X, 289, "PROMO END-CAP", {
    fontFamily: "Arial",
    fontSize: "21px",
    color: "#ffffff",
    fontStyle: "bold"
  }).setOrigin(0.5).setDepth(9);
  const stockText = scene.add.text(PROMO_X, 776, "SELECT TODAY'S DEAL", {
    fontFamily: "Arial",
    fontSize: "15px",
    color: "#d9e8e8",
    fontStyle: "bold",
    backgroundColor: "#15262a",
    padding: { x: 10, y: 6 }
  }).setOrigin(0.5).setDepth(9);

  for (const shelfY of [444, 599, 754]) {
    const shelfLine = scene.add.rectangle(PROMO_X, shelfY, 165, 14, 0x8ba0a0, 1)
      .setStrokeStyle(2, 0x4e6264)
      .setDepth(7);
    scene.__day2PromoObjects?.push(shelfLine);
  }

  scene.__day2PromoTitle = title;
  scene.__day2PromoStockText = stockText;
  scene.__day2PromoObjects?.push(floorZone, shadow, stand, backing, banner, newArea, title, stockText);
}

function createPromoSlots(scene: RuntimeGameScene, featured: ProductId): void {
  const slots: PromoSlot[] = PROMO_SLOT_Y.map((y, index) => {
    const hitArea = scene.add.rectangle(PROMO_X, y, 142, 124, 0xffffff, 0.001)
      .setDepth(28)
      .setInteractive({ useHandCursor: true });
    const missingTag = scene.add.image(PROMO_X, y + 25, Assets.ui.missingTag)
      .setDisplaySize(112, 44)
      .setTint(0xffc45f)
      .setDepth(26);
    const typeLabel = scene.add.text(PROMO_X, y - 48, index === 0 ? "DISPLAY SAMPLE" : "LOCKED", {
      fontFamily: "Arial",
      fontSize: "12px",
      color: "#fff0b2",
      fontStyle: "bold",
      backgroundColor: "#6a3a18",
      padding: { x: 7, y: 3 }
    }).setOrigin(0.5).setDepth(27);

    const slot: PromoSlot = {
      promoIndex: index,
      zone: "PROMO",
      productId: featured,
      hitArea,
      missingTag,
      typeLabel,
      productBottomY: y + 52,
      reservedForCustomer: false
    };

    hitArea.on("pointerdown", () => restockPromoFromCart(scene, slot));
    scene.__day2PromoObjects?.push(hitArea, missingTag, typeLabel);
    return slot;
  });

  scene.__day2PromoSlots = slots;
  refreshPromotionZone(scene);
}

function unlockPromotionZone(scene: RuntimeGameScene): void {
  if (scene.__day2PromoUnlocked) return;
  scene.__day2PromoUnlocked = true;

  const first = scene.__day2PromoSlots?.[0];
  if (first && !first.product) placePromoProduct(scene, first, false);

  scene.__day2PromoSlots?.forEach((slot) => {
    slot.typeLabel?.setText("HOT DEAL");
    slot.missingTag.clearTint();
  });

  scene.showPhaseBanner("PROMO AREA OPEN");
  scene.showTransientHint(
    "New zone unlocked: keep the Promo End-Cap stocked as well as the Main Cooler."
  );
  refreshPromotionZone(scene);
}

function restockPromoFromCart(scene: RuntimeGameScene, slot: PromoSlot): void {
  if (!scene.__day2PromoUnlocked) {
    scene.showTransientHint("Open the Main Cooler first. The Promo End-Cap unlocks when trading starts.");
    return;
  }
  if (scene.shiftEnded || scene.movingCart || scene.restockBusy || slot.product || slot.reservedForCustomer) return;
  if (!scene.cartAtShelf) {
    scene.showTransientHint("Bring the cart to the sales floor before filling the Promo End-Cap.");
    return;
  }

  const productIndex = scene.loadedProducts.indexOf(slot.productId);
  if (productIndex < 0) {
    scene.showTransientHint(`No ${PRODUCTS[slot.productId].label} on the cart for the Promo End-Cap.`);
    return;
  }

  scene.restockBusy = true;
  scene.loadedProducts.splice(productIndex, 1);
  scene.updateCartCount();
  scene.updateHud();

  const definition = PRODUCTS[slot.productId];
  const product = scene.add.image(scene.cart.x + 12, scene.cart.y - 55, definition.productKey)
    .setOrigin(0.5, 1)
    .setDepth(34);
  scene.fitImage(product, definition.shelfWidth * 1.12, definition.shelfHeight * 1.12);

  scene.setWorkerTexture(Assets.characters.workerCarry, 215, 430);
  scene.tweens.add({
    targets: scene.worker,
    x: 720,
    y: Phaser.Math.Clamp(slot.productBottomY + 140, 590, 830),
    duration: 330,
    ease: "Sine.InOut"
  });
  scene.tweens.add({
    targets: product,
    x: slot.hitArea.x,
    y: slot.productBottomY,
    duration: 430,
    ease: "Cubic.Out",
    onComplete: () => {
      slot.product = product;
      slot.missingTag.setVisible(false);
      scene.recordRestockCombo();
      scene.money += PROMO_RESTOCK_BONUS;
      scene.setWorkerTexture(Assets.characters.workerIdle, 205, 420);
      scene.tweens.add({
        targets: scene.worker,
        x: 720,
        y: 925,
        duration: 220,
        ease: "Sine.Out"
      });
      scene.restockBusy = false;
      scene.updateHud();
      showFloatingText(scene, slot.hitArea.x, slot.hitArea.y - 78, `PROMO FILLED +${PROMO_RESTOCK_BONUS}`, 0x9ff18d);
      refreshPromotionZone(scene);
    }
  });
}

function purchaseFromPromoDisplay(scene: RuntimeGameScene, slot: PromoSlot): void {
  if (!slot.product || slot.reservedForCustomer || scene.restockBusy) {
    originalCustomerPurchase.call(scene as unknown as GameScene);
    return;
  }

  slot.reservedForCustomer = true;
  const customerKeys = scene.customerSequence % 2 === 0
    ? { idle: Assets.characters.customer01Idle, basket: Assets.characters.customer01Basket }
    : { idle: Assets.characters.customer02Idle, basket: Assets.characters.customer02Basket };
  scene.customerSequence += 1;

  const customer = scene.add.image(1340, 900, customerKeys.idle)
    .setOrigin(0.5, 1)
    .setDepth(37);
  scene.fitImage(customer, 140, 292);

  scene.tweens.add({
    targets: customer,
    x: 875,
    y: 890,
    duration: 620,
    ease: "Sine.InOut",
    onComplete: () => {
      if (!slot.product || scene.shiftEnded) {
        slot.reservedForCustomer = false;
        customer.destroy();
        return;
      }

      const sold = slot.product;
      slot.product = undefined;
      slot.reservedForCustomer = false;
      sold.destroy();
      slot.missingTag.setVisible(true);

      customer.setTexture(customerKeys.basket);
      scene.fitImage(customer, 146, 300);

      const income = PRODUCTS[slot.productId].price + PROMO_SALE_BONUS;
      scene.money += income;
      scene.soldCount += 1;
      scene.updateStars();
      scene.showIncome(slot.hitArea.x, slot.hitArea.y - 48, income);
      scene.advanceBusinessPhase();
      scene.updateHud();
      refreshPromotionZone(scene);

      scene.tweens.add({
        targets: customer,
        x: 1345,
        y: 965,
        alpha: 0,
        duration: 590,
        ease: "Sine.In",
        onComplete: () => customer.destroy()
      });
    }
  });
}

function showPromoLostSale(scene: RuntimeGameScene): void {
  gameSession.recordMissedSale();
  scene.updateStars();
  scene.updateHud();

  const customerKey = scene.customerSequence % 2 === 0
    ? Assets.characters.customer01Idle
    : Assets.characters.customer02Idle;
  scene.customerSequence += 1;
  const customer = scene.add.image(1340, 900, customerKey)
    .setOrigin(0.5, 1)
    .setDepth(37);
  scene.fitImage(customer, 140, 292);

  scene.tweens.add({
    targets: customer,
    x: 875,
    y: 890,
    duration: 520,
    ease: "Sine.Out",
    onComplete: () => {
      showFloatingText(scene, PROMO_X, 320, "PROMO SOLD OUT · LOST SALE", 0xff8179);
      scene.tweens.add({
        targets: customer,
        x: 1345,
        y: 960,
        alpha: 0,
        delay: 260,
        duration: 520,
        ease: "Sine.In",
        onComplete: () => customer.destroy()
      });
    }
  });
}

function placePromoProduct(scene: RuntimeGameScene, slot: PromoSlot, animate: boolean): void {
  const definition = PRODUCTS[slot.productId];
  const product = scene.add.image(slot.hitArea.x, slot.productBottomY, definition.productKey)
    .setOrigin(0.5, 1)
    .setDepth(25);
  scene.fitImage(product, definition.shelfWidth * 1.12, definition.shelfHeight * 1.12);
  if (animate) product.setAlpha(0).setScale(product.scaleX * 0.8, product.scaleY * 0.8);
  slot.product = product;
  slot.missingTag.setVisible(false);

  if (animate) {
    scene.tweens.add({
      targets: product,
      alpha: 1,
      scaleX: product.scaleX / 0.8,
      scaleY: product.scaleY / 0.8,
      duration: 180,
      ease: "Back.Out"
    });
  }
}

function refreshPromotionZone(scene: RuntimeGameScene): void {
  const featured = scene.__day2FeaturedProduct;
  const slots = scene.__day2PromoSlots ?? [];
  if (!featured) {
    scene.__day2PromoStockText?.setText("SELECT TODAY'S DEAL").setColor("#d9e8e8");
    return;
  }

  scene.__day2PromoTitle?.setText(`${PRODUCTS[featured].label} PROMO`);
  const stock = slots.filter((slot) => slot.product).length;
  if (!scene.__day2PromoUnlocked) {
    scene.__day2PromoStockText?.setText("OPENS AFTER MAIN COOLER").setColor("#ffd75a");
  } else if (stock === 0) {
    scene.__day2PromoStockText?.setText("SOLD OUT · RESTOCK NOW").setColor("#ff8179");
  } else {
    scene.__day2PromoStockText?.setText(`PROMO STOCK ${stock}/3`).setColor(stock === 1 ? "#ffd75a" : "#9ff18d");
  }

  if (scene.__day2DealStatus && scene.__day2PromoUnlocked) {
    const mainStock = scene.shelfSlots.filter(
      (slot) => slot.productId === featured && slot.product
    ).length;
    const saves = scene.__day2BackStockSaves ?? 0;
    const timer = scene.__day2PromoActive ? ` · ${scene.__day2PromoSeconds ?? 0}s` : "";
    scene.__day2DealStatus
      .setText(`END-CAP ${stock}/3 · MAIN ${mainStock}/2 · SAVES ${saves}/3${timer}`)
      .setColor(stock === 0 && scene.__day2PromoActive ? "#ff8179" : stock <= 1 ? "#ffd75a" : "#dcebea");
  }
}

function cleanupExpansion(scene: RuntimeGameScene, monitor: () => void): void {
  scene.events.off(Phaser.Scenes.Events.POST_UPDATE, monitor);
  scene.__day2PromoObjects?.forEach((object) => {
    if (object.active) object.destroy();
  });
  scene.__day2PromoObjects = undefined;
  scene.__day2PromoSlots = undefined;
  scene.__day2PromoTitle = undefined;
  scene.__day2PromoStockText = undefined;
  scene.__day2PromoMonitor = undefined;
}

const backStockPrototype = BackStockScene.prototype as unknown as BackStockPrototype;
const originalQuickRestock = backStockPrototype.quickRestock;

backStockPrototype.quickRestock = function quickRestockExpandedDayTwo(productId: ProductId): void {
  const backStock = this as unknown as RuntimeBackStockScene;
  const game = backStock.gameScene;
  const promoSlots = game?.__day2PromoSlots ?? [];
  const promoGap = promoSlots.find(
    (slot) => slot.productId === productId && !slot.product && !slot.reservedForCustomer
  );

  if (
    gameSession.day === "day02" &&
    game?.__day2PromoUnlocked &&
    promoGap &&
    game.__day2FeaturedProduct === productId &&
    !game.restockBusy
  ) {
    const mainSlots = game.shelfSlots;
    const mainGap = mainSlots.some(
      (slot) => slot.productId === productId && !slot.product && !slot.reservedForCustomer
    );
    const promoStock = promoSlots.filter((slot) => slot.product).length;
    const prioritizePromo = Boolean(game.__day2PromoActive) || !mainGap || promoStock < 2;

    if (prioritizePromo) {
      const beforeStocked = game.stocked;
      game.shelfSlots = [promoGap];
      try {
        originalQuickRestock.call(this, productId);
      } finally {
        game.shelfSlots = mainSlots;
      }

      if (game.restockBusy) {
        game.time.delayedCall(280, () => {
          if (!game.scene.isActive()) return;
          game.stocked = beforeStocked;
          game.updateHud();
          refreshPromotionZone(game);
        });
      }
      return;
    }
  }

  originalQuickRestock.call(this, productId);
};

function showFloatingText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  message: string,
  color: number
): void {
  const text = scene.add.text(x, y, message, {
    fontFamily: "Arial",
    fontSize: "21px",
    color: `#${color.toString(16).padStart(6, "0")}`,
    fontStyle: "bold",
    stroke: "#172020",
    strokeThickness: 6,
    align: "center"
  }).setOrigin(0.5).setDepth(910);

  scene.tweens.add({
    targets: text,
    y: y - 54,
    alpha: 0,
    duration: 820,
    ease: "Cubic.Out",
    onComplete: () => text.destroy()
  });
}
