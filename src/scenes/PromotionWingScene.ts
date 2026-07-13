import Phaser from "phaser";
import { AssetPaths, Assets } from "../assets";
import { PRODUCTS, type ProductId } from "../gameConfig";
import { gameSession } from "../systems/GameSession";

type RuntimeGameScene = Phaser.Scene & {
  phase: "PREPARE" | "OPEN" | "RUSH" | "CLOSING" | "RESULT";
  shiftEnded: boolean;
  loadedProducts: ProductId[];
  cartAtShelf: boolean;
  movingCart: boolean;
  restockBusy: boolean;
  money: number;
  soldCount: number;
  remainingSeconds: number;
  customerSequence: number;
  __day2FeaturedProduct?: ProductId;
  __day2PromoActive?: boolean;
  __day2BackStockSaves?: number;
  __day2PromoBonusClaimed?: boolean;
  __promotionWingStock?: number;
  updateCartCount: () => void;
  updateHud: () => void;
  updateStars: () => void;
  advanceBusinessPhase: () => void;
};

type RuntimeBackStockScene = Phaser.Scene & {
  inventory?: Record<ProductId, number>;
  refreshButtons?: () => void;
};

type WingSlot = {
  index: number;
  x: number;
  y: number;
  product?: Phaser.GameObjects.Image;
  missing: Phaser.GameObjects.Text | Phaser.GameObjects.Image;
  hitArea: Phaser.GameObjects.Rectangle;
  reserved: boolean;
};

const AUXILIARY_SCENES = ["polish-overlay", "progression-customer", "back-stock"] as const;
const MAX_WING_STOCK = 6;
const BACK_STOCK_SAVE_REWARD = 6;
const WING_RESTOCK_REWARD = 4;
const WING_SALE_BONUS = 4;
const MAX_PROMO_CART = 3;

export class PromotionWingScene extends Phaser.Scene {
  private gameScene?: RuntimeGameScene;
  private backStockScene?: RuntimeBackStockScene;
  private featuredProduct: ProductId = "water";
  private slots: WingSlot[] = [];
  private worker?: Phaser.GameObjects.Image;
  private stockText?: Phaser.GameObjects.Text;
  private cartText?: Phaser.GameObjects.Text;
  private backStockText?: Phaser.GameObjects.Text;
  private timerText?: Phaser.GameObjects.Text;
  private objectiveText?: Phaser.GameObjects.Text;
  private flowText?: Phaser.GameObjects.Text;
  private stockEntryText?: Phaser.GameObjects.Text;
  private stockEntryGlow?: Phaser.GameObjects.Rectangle;
  private stockEntryButton?: Phaser.GameObjects.Container;
  private customerEvent?: Phaser.Time.TimerEvent;
  private restockBusy = false;
  private exiting = false;
  private lastSoldOutAt = -Infinity;

  constructor() {
    super("promotion-wing");
  }

  preload(): void {
    this.loadIfMissing(Assets.backgrounds.salesfloor);
    this.loadIfMissing(Assets.characters.workerIdle);
    this.loadIfMissing(Assets.characters.workerCarry);
    this.loadIfMissing(Assets.characters.customer01Idle);
    this.loadIfMissing(Assets.characters.customer01Basket);
    this.loadIfMissing(Assets.characters.customer02Idle);
    this.loadIfMissing(Assets.characters.customer02Basket);
    this.loadIfMissing(Assets.products.cola);
    this.loadIfMissing(Assets.products.water);
    this.loadIfMissing(Assets.products.milk);
  }

  create(): void {
    const game = this.scene.get("game") as RuntimeGameScene;
    if (!game?.scene?.isActive() || gameSession.day !== "day02") {
      this.scene.stop();
      return;
    }

    this.gameScene = game;
    this.backStockScene = this.scene.get("back-stock") as RuntimeBackStockScene;
    this.featuredProduct = game.__day2FeaturedProduct ?? "water";
    game.__promotionWingStock ??= 2;
    this.slots = [];
    this.restockBusy = false;
    this.exiting = false;
    this.lastSoldOutAt = -Infinity;

    this.hideMainStore();
    this.cameras.main.setBackgroundColor("#0f1718");
    this.createExpandedRoom();
    this.createHud();
    this.createDisplayIslands();
    this.createInventoryFlow();
    this.createWorker();
    this.createExitDoor();
    this.syncSlotProducts();
    this.startWingCustomers();
    this.refreshHud();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.restoreMainStore());
    this.cameras.main.fadeIn(220, 8, 14, 15);
  }

  update(): void {
    const game = this.gameScene;
    if (!game || this.exiting) return;

    this.refreshHud();
    if (game.shiftEnded || game.phase === "CLOSING" || game.phase === "RESULT") {
      this.exitWing("Closing time — return to the main store.");
    }
  }

  private createExpandedRoom(): void {
    const background = this.add.image(665, 591, Assets.backgrounds.salesfloor)
      .setDisplaySize(1330, 1182)
      .setAlpha(0.42)
      .setTint(0xb7c9c4);

    this.add.rectangle(665, 315, 1330, 430, 0x1b3436, 0.84).setDepth(1);
    this.add.rectangle(665, 850, 1330, 664, 0xb68b5c, 0.88).setDepth(1);
    this.add.rectangle(665, 582, 1230, 12, 0xe7c08b, 0.5).setDepth(2);

    this.add.rectangle(665, 164, 830, 112, 0x8a4315, 0.98)
      .setStrokeStyle(7, 0xffd75a)
      .setDepth(6);
    this.add.text(665, 138, "PROMOTION WING", {
      fontFamily: "Arial",
      fontSize: "42px",
      color: "#ffffff",
      fontStyle: "bold",
      letterSpacing: 4
    }).setOrigin(0.5).setDepth(7);
    this.add.text(665, 188, "DAY 2 · SHARED INVENTORY + CHECKOUT", {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#ffe6a1",
      fontStyle: "bold",
      letterSpacing: 3
    }).setOrigin(0.5).setDepth(7);

    this.add.rectangle(1120, 712, 320, 250, 0x36545a, 0.98)
      .setStrokeStyle(6, 0x91a9aa)
      .setDepth(4);
    this.add.rectangle(1120, 635, 345, 86, 0x1c3034, 1)
      .setStrokeStyle(4, 0xd3b46f)
      .setDepth(5);
    this.add.text(1120, 635, "EXPRESS CHECKOUT", {
      fontFamily: "Arial",
      fontSize: "24px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setOrigin(0.5).setDepth(6);

    this.add.rectangle(214, 720, 250, 330, 0x243c3f, 0.98)
      .setStrokeStyle(6, 0x6f8d8e)
      .setDepth(4);
    this.add.text(214, 588, "STOCK ENTRY", {
      fontFamily: "Arial",
      fontSize: "22px",
      color: "#e6f2ef",
      fontStyle: "bold"
    }).setOrigin(0.5).setDepth(5);

    void background;
  }

  private createHud(): void {
    this.add.rectangle(665, 60, 1330, 120, 0x0b1517, 0.98).setDepth(50);
    this.add.text(28, 20, "HOT DEAL FLOOR", {
      fontFamily: "Arial",
      fontSize: "27px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setDepth(52);

    this.objectiveText = this.add.text(28, 66, "", {
      fontFamily: "Arial",
      fontSize: "17px",
      color: "#cfe2de",
      fontStyle: "bold"
    }).setDepth(52);

    this.stockText = this.createInfoChip(625, "DISPLAY");
    this.cartText = this.createInfoChip(840, "PROMO CART");
    this.backStockText = this.createInfoChip(1045, "SHARED RESERVE");
    this.timerText = this.createInfoChip(1240, "TIME");
  }

  private createInfoChip(x: number, label: string): Phaser.GameObjects.Text {
    this.add.rectangle(x, 58, 178, 78, 0x1d2c2f, 1)
      .setStrokeStyle(2, 0x516a6d)
      .setDepth(51);
    this.add.text(x, 35, label, {
      fontFamily: "Arial",
      fontSize: "12px",
      color: "#91a8aa",
      fontStyle: "bold",
      letterSpacing: 1
    }).setOrigin(0.5).setDepth(52);
    return this.add.text(x, 66, "0", {
      fontFamily: "Arial",
      fontSize: "25px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setOrigin(0.5).setDepth(52);
  }

  private createInventoryFlow(): void {
    const label = PRODUCTS[this.featuredProduct].label.toUpperCase();

    this.add.rectangle(665, 335, 1080, 118, 0x0b1719, 0.94)
      .setStrokeStyle(3, 0x789d89, 0.85)
      .setDepth(54);
    this.flowText = this.add.text(665, 302, "1  LOAD RESERVE  →  2  FILL DISPLAY  →  3  CHECK OUT CUSTOMER", {
      fontFamily: "Arial",
      fontSize: "19px",
      color: "#ffffff",
      fontStyle: "bold",
      letterSpacing: 1
    }).setOrigin(0.5).setDepth(56);

    this.stockEntryGlow = this.add.rectangle(255, 350, 250, 58, 0xffd75a, 0.18)
      .setStrokeStyle(4, 0xffd75a, 1)
      .setDepth(55)
      .setVisible(false);
    const background = this.add.rectangle(0, 0, 238, 52, 0x315f4b, 1)
      .setStrokeStyle(3, 0xd9f2b4)
      .setInteractive({ useHandCursor: true });
    this.stockEntryText = this.add.text(0, 0, `LOAD ${label} CASE`, {
      fontFamily: "Arial",
      fontSize: "16px",
      color: "#ffffff",
      fontStyle: "bold",
      align: "center"
    }).setOrigin(0.5);
    this.stockEntryButton = this.add.container(255, 350, [background, this.stockEntryText]).setDepth(57);
    background.on("pointerover", () => this.stockEntryButton?.setScale(1.03));
    background.on("pointerout", () => this.stockEntryButton?.setScale(1));
    background.on("pointerdown", () => this.loadFeaturedFromBackStock());

    this.add.text(515, 350, "CART", {
      fontFamily: "Arial",
      fontSize: "17px",
      color: "#bfe5d7",
      fontStyle: "bold",
      backgroundColor: "#173238",
      padding: { x: 34, y: 15 }
    }).setOrigin(0.5).setDepth(56);
    this.add.text(760, 350, "EMPTY DISPLAY", {
      fontFamily: "Arial",
      fontSize: "17px",
      color: "#ffe4a1",
      fontStyle: "bold",
      backgroundColor: "#5f3217",
      padding: { x: 24, y: 15 }
    }).setOrigin(0.5).setDepth(56);
    this.add.text(1060, 350, "CHECKOUT", {
      fontFamily: "Arial",
      fontSize: "17px",
      color: "#d9eef4",
      fontStyle: "bold",
      backgroundColor: "#315f7d",
      padding: { x: 34, y: 15 }
    }).setOrigin(0.5).setDepth(56);
  }

  private loadFeaturedFromBackStock(): void {
    const game = this.gameScene;
    const inventory = this.backStockScene?.inventory;
    if (!game || !inventory || game.shiftEnded || this.restockBusy) return;

    const cartStock = game.loadedProducts.filter((item) => item === this.featuredProduct).length;
    if (cartStock >= MAX_PROMO_CART) {
      this.showFloating(255, 415, "PROMO CART FULL · FILL A DISPLAY", 0xffd75a);
      this.pulseEmptyDisplay();
      return;
    }

    if (inventory[this.featuredProduct] <= 0) {
      this.showFloating(255, 415, `NO ${PRODUCTS[this.featuredProduct].label.toUpperCase()} IN SHARED RESERVE`, 0xff8179);
      return;
    }

    inventory[this.featuredProduct] -= 1;
    game.loadedProducts.push(this.featuredProduct);
    game.updateCartCount();
    game.updateHud();
    this.backStockScene?.refreshButtons?.();

    if (game.__day2PromoActive) {
      game.__day2BackStockSaves = Math.min(3, (game.__day2BackStockSaves ?? 0) + 1);
      game.money += BACK_STOCK_SAVE_REWARD;
    }

    this.stockEntryGlow?.setVisible(false);
    this.showFloating(255, 415, `${PRODUCTS[this.featuredProduct].label.toUpperCase()} CASE LOADED → TAP EMPTY DISPLAY`, 0x9ff18d);
    this.pulseEmptyDisplay();
    this.refreshHud();
  }

  private pulseStockEntry(): void {
    const glow = this.stockEntryGlow;
    if (!glow) return;
    glow.setVisible(true).setAlpha(0.22);
    this.tweens.killTweensOf(glow);
    this.tweens.add({
      targets: glow,
      alpha: 0.55,
      duration: 360,
      yoyo: true,
      repeat: 3,
      ease: "Sine.InOut"
    });
  }

  private pulseEmptyDisplay(): void {
    const empty = this.slots.find((slot) => !slot.product && !slot.reserved);
    if (!empty) return;
    this.tweens.killTweensOf(empty.missing);
    this.tweens.add({
      targets: empty.missing,
      scaleX: empty.missing.scaleX * 1.08,
      scaleY: empty.missing.scaleY * 1.08,
      duration: 220,
      yoyo: true,
      repeat: 2,
      ease: "Sine.InOut"
    });
  }

  private createDisplayIslands(): void {
    const positions = [
      { x: 475, y: 485 },
      { x: 680, y: 485 },
      { x: 885, y: 485 },
      { x: 475, y: 755 },
      { x: 680, y: 755 },
      { x: 885, y: 755 }
    ];

    positions.forEach((position, index) => {
      this.add.ellipse(position.x, position.y + 90, 190, 28, 0x101515, 0.28).setDepth(3);
      this.add.rectangle(position.x, position.y + 48, 178, 128, 0x425d60, 1)
        .setStrokeStyle(5, 0x8fa5a5)
        .setDepth(4);
      this.add.rectangle(position.x, position.y - 20, 188, 26, 0xe2b15e, 1)
        .setStrokeStyle(3, 0x8a5b18)
        .setDepth(7);

      const missing = this.add.text(position.x, position.y + 4, "EMPTY · TAP TO FILL", {
        fontFamily: "Arial",
        fontSize: "14px",
        color: "#ffd75a",
        fontStyle: "bold",
        backgroundColor: "#5f3217",
        padding: { x: 8, y: 6 }
      }).setOrigin(0.5).setDepth(9);
      const hitArea = this.add.rectangle(position.x, position.y, 205, 220, 0xffffff, 0.001)
        .setDepth(12)
        .setInteractive({ useHandCursor: true });

      const slot: WingSlot = {
        index,
        x: position.x,
        y: position.y,
        missing,
        hitArea,
        reserved: false
      };
      hitArea.on("pointerdown", () => this.restockSlot(slot));
      this.slots.push(slot);
    });
  }

  private createWorker(): void {
    this.worker = this.add.image(230, 930, Assets.characters.workerIdle)
      .setOrigin(0.5, 1)
      .setDepth(20);
    this.fitImage(this.worker, 190, 350);
  }

  private createExitDoor(): void {
    const background = this.add.rectangle(0, 0, 270, 90, 0x315f7d, 1)
      .setStrokeStyle(4, 0xd9eef4)
      .setInteractive({ useHandCursor: true });
    const label = this.add.text(0, 0, "← MAIN STORE", {
      fontFamily: "Arial",
      fontSize: "24px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setOrigin(0.5);
    const button = this.add.container(180, 1050, [background, label]).setDepth(60);

    background.on("pointerover", () => button.setScale(1.03));
    background.on("pointerout", () => button.setScale(1));
    background.on("pointerdown", () => this.exitWing());
  }

  private syncSlotProducts(): void {
    const stock = Phaser.Math.Clamp(this.gameScene?.__promotionWingStock ?? 0, 0, MAX_WING_STOCK);
    this.slots.forEach((slot, index) => {
      slot.product?.destroy();
      slot.product = undefined;
      slot.missing.setVisible(index >= stock);
      if (index < stock) this.placeProduct(slot, false);
    });
  }

  private placeProduct(slot: WingSlot, animate: boolean): void {
    const definition = PRODUCTS[this.featuredProduct];
    slot.product?.destroy();
    const product = this.add.image(slot.x, slot.y + 58, definition.productKey)
      .setOrigin(0.5, 1)
      .setDepth(9);
    this.fitImage(product, definition.shelfWidth * 1.35, definition.shelfHeight * 1.35);
    slot.product = product;
    slot.missing.setVisible(false);

    if (!animate) return;
    const finalScaleX = product.scaleX;
    const finalScaleY = product.scaleY;
    product.setScale(finalScaleX * 0.78, finalScaleY * 0.78).setAlpha(0);
    this.tweens.add({
      targets: product,
      scaleX: finalScaleX,
      scaleY: finalScaleY,
      alpha: 1,
      duration: 180,
      ease: "Back.Out"
    });
  }

  private restockSlot(slot: WingSlot): void {
    const game = this.gameScene;
    if (!game || this.restockBusy || slot.product || slot.reserved || game.shiftEnded) return;

    const cartIndex = game.loadedProducts.indexOf(this.featuredProduct);
    if (cartIndex < 0) {
      this.showFloating(slot.x, slot.y - 95, `STEP 1 · LOAD ${PRODUCTS[this.featuredProduct].label.toUpperCase()} AT STOCK ENTRY`, 0xff8179);
      this.pulseStockEntry();
      return;
    }

    game.loadedProducts.splice(cartIndex, 1);
    game.updateCartCount();
    this.restockBusy = true;
    this.worker?.setTexture(Assets.characters.workerCarry);
    if (this.worker) this.fitImage(this.worker, 190, 345);

    this.tweens.add({
      targets: this.worker,
      x: slot.x - 78,
      y: slot.y + 205,
      duration: 350,
      ease: "Sine.InOut",
      onComplete: () => {
        this.placeProduct(slot, true);
        game.__promotionWingStock = Math.min(MAX_WING_STOCK, (game.__promotionWingStock ?? 0) + 1);
        game.money += WING_RESTOCK_REWARD;
        game.updateHud();

        this.worker?.setTexture(Assets.characters.workerIdle);
        if (this.worker) this.fitImage(this.worker, 170, 330);
        this.tweens.add({
          targets: this.worker,
          x: 165,
          y: 1040,
          duration: 260,
          ease: "Sine.Out"
        });

        this.restockBusy = false;
        this.showFloating(slot.x, slot.y - 100, `DISPLAY FILLED +${WING_RESTOCK_REWARD}`, 0x9ff18d);
        this.refreshHud();
      }
    });
  }

  private startWingCustomers(): void {
    this.customerEvent?.remove(false);
    this.customerEvent = this.time.addEvent({
      delay: 1450,
      loop: true,
      callback: () => this.customerVisit()
    });
  }

  private customerVisit(): void {
    const game = this.gameScene;
    if (!game || game.shiftEnded || this.restockBusy) return;
    if (game.phase !== "OPEN" && game.phase !== "RUSH") return;

    const available = this.slots.filter((slot) => slot.product && !slot.reserved);
    if (available.length === 0) {
      if (game.__day2PromoActive && this.time.now - this.lastSoldOutAt >= 2800) {
        this.lastSoldOutAt = this.time.now;
        gameSession.recordMissedSale();
        game.updateStars();
        this.showSoldOutCustomer();
      }
      return;
    }

    const slot = Phaser.Utils.Array.GetRandom(available);
    slot.reserved = true;
    const customerKeys = game.customerSequence % 2 === 0
      ? { idle: Assets.characters.customer01Idle, basket: Assets.characters.customer01Basket }
      : { idle: Assets.characters.customer02Idle, basket: Assets.characters.customer02Basket };
    game.customerSequence += 1;

    const customer = this.add.image(1350, 935, customerKeys.idle)
      .setOrigin(0.5, 1)
      .setDepth(24);
    this.fitImage(customer, 145, 300);

    this.tweens.add({
      targets: customer,
      x: slot.x + 88,
      y: slot.y + 170,
      duration: 640,
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

        customer.setTexture(customerKeys.basket);
        this.fitImage(customer, 150, 305);
        const income = PRODUCTS[this.featuredProduct].price + WING_SALE_BONUS;
        game.money += income;
        game.soldCount += 1;
        game.updateStars();
        game.advanceBusinessPhase();
        game.updateHud();
        this.showFloating(slot.x, slot.y - 105, `WING SALE +${income}`, 0xffe16d);

        this.tweens.add({
          targets: customer,
          x: 1350,
          y: 975,
          alpha: 0,
          duration: 590,
          ease: "Sine.In",
          onComplete: () => customer.destroy()
        });
      }
    });
  }

  private showSoldOutCustomer(): void {
    const key = (this.gameScene?.customerSequence ?? 0) % 2 === 0
      ? Assets.characters.customer01Idle
      : Assets.characters.customer02Idle;
    if (this.gameScene) this.gameScene.customerSequence += 1;

    const customer = this.add.image(1350, 935, key).setOrigin(0.5, 1).setDepth(24);
    this.fitImage(customer, 145, 300);
    this.tweens.add({
      targets: customer,
      x: 900,
      y: 925,
      duration: 520,
      ease: "Sine.Out",
      onComplete: () => {
        this.showFloating(680, 335, "WING SOLD OUT · LOST SALE", 0xff8179);
        this.tweens.add({
          targets: customer,
          x: 1350,
          alpha: 0,
          delay: 250,
          duration: 500,
          ease: "Sine.In",
          onComplete: () => customer.destroy()
        });
      }
    });
  }

  private refreshHud(): void {
    const game = this.gameScene;
    if (!game) return;

    const stock = game.__promotionWingStock ?? 0;
    const cartStock = game.loadedProducts.filter((item) => item === this.featuredProduct).length;
    const backStock = this.backStockScene?.inventory?.[this.featuredProduct] ?? 0;
    const minutes = Math.floor(Math.max(0, game.remainingSeconds) / 60);
    const seconds = Math.max(0, game.remainingSeconds) % 60;
    const emptyDisplays = this.slots.filter((slot) => !slot.product && !slot.reserved).length;
    const label = PRODUCTS[this.featuredProduct].label.toUpperCase();

    this.stockText?.setText(`${stock}/${MAX_WING_STOCK}`);
    this.cartText?.setText(String(cartStock));
    this.backStockText?.setText(String(backStock));
    this.timerText?.setText(`${minutes}:${seconds.toString().padStart(2, "0")}`);
    this.stockEntryText?.setText(`LOAD ${label} · RESERVE ${backStock}`);

    if (cartStock <= 0 && emptyDisplays > 0) {
      this.objectiveText?.setText(`STEP 1 · Load ${label} from shared reserve at STOCK ENTRY`);
    } else if (emptyDisplays > 0) {
      this.objectiveText?.setText(`STEP 2 · Tap an empty ${label} display · ${emptyDisplays} gaps`);
    } else {
      this.objectiveText?.setText(`STEP 3 · Serve checkout and keep displays full · Sales ${game.soldCount}`);
    }
  }

  private exitWing(message?: string): void {
    if (this.exiting) return;
    this.exiting = true;
    this.customerEvent?.remove(false);
    if (message) this.showFloating(665, 250, message, 0xffd75a);
    this.cameras.main.fadeOut(180, 8, 14, 15);
    this.time.delayedCall(190, () => this.scene.stop());
  }

  private hideMainStore(): void {
    const keys = ["game", ...AUXILIARY_SCENES];
    keys.forEach((key) => {
      const target = this.scene.get(key);
      if (!target) return;
      this.scene.setVisible(false, key);
      target.input.enabled = false;
    });
  }

  private restoreMainStore(): void {
    const keys = ["game", ...AUXILIARY_SCENES];
    keys.forEach((key) => {
      const target = this.scene.get(key);
      if (!target?.scene?.isActive()) return;
      this.scene.setVisible(true, key);
      target.input.enabled = true;
      this.scene.bringToTop(key);
    });
    this.gameScene?.updateHud();
  }

  private showFloating(x: number, y: number, message: string, color: number): void {
    const text = this.add.text(x, y, message, {
      fontFamily: "Arial",
      fontSize: "22px",
      color: `#${color.toString(16).padStart(6, "0")}`,
      fontStyle: "bold",
      stroke: "#172020",
      strokeThickness: 6,
      align: "center",
      wordWrap: { width: 720 }
    }).setOrigin(0.5).setDepth(80);

    this.tweens.add({
      targets: text,
      y: y - 58,
      alpha: 0,
      duration: 900,
      ease: "Cubic.Out",
      onComplete: () => text.destroy()
    });
  }

  private fitImage(image: Phaser.GameObjects.Image, maxWidth: number, maxHeight: number): void {
    const width = Math.max(1, image.frame.realWidth || image.width);
    const height = Math.max(1, image.frame.realHeight || image.height);
    image.setScale(Math.min(maxWidth / width, maxHeight / height));
  }

  private loadIfMissing(key: keyof typeof AssetPaths): void {
    if (!this.textures.exists(key)) this.load.image(key, AssetPaths[key]);
  }
}
