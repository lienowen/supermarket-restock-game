import Phaser from "phaser";
import { AssetPaths, Assets } from "../assets";
import {
  BOX_POSITIONS,
  GAME_RULES,
  INITIAL_BOX_ORDER,
  PRODUCTS,
  SLOT_POSITIONS,
  SLOT_PRODUCT_ORDER,
  type ProductId
} from "../gameConfig";

type ShiftPhase = "PREPARE" | "OPEN" | "RUSH" | "CLOSING" | "RESULT";

type BoxItem = {
  id: number;
  productId: ProductId;
  image: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
  positionIndex: number;
  renewable: boolean;
  loaded: boolean;
  homeX: number;
  homeY: number;
};

type ShelfSlot = {
  index: number;
  productId: ProductId;
  hitArea: Phaser.GameObjects.Rectangle;
  missingTag: Phaser.GameObjects.Image;
  typeLabel: Phaser.GameObjects.Text;
  productBottomY: number;
  product?: Phaser.GameObjects.Image;
  reservedForCustomer: boolean;
};

type GuideMode = "NONE" | "CART_TO_SALES" | "CART_TO_WAREHOUSE" | "RESTOCK";

const CART_HOME = { x: 505, y: 850 };
const CART_SALES = { x: 760, y: 850 };
const WORKER_HOME = { x: 490, y: 565 };
const WORKER_SALES_HOME = { x: 715, y: 755 };
const DOORWAY_X = 690;

export class GameScene extends Phaser.Scene {
  private boxes: BoxItem[] = [];
  private shelfSlots: ShelfSlot[] = [];
  private selectedBox?: BoxItem;
  private loadedProducts: ProductId[] = [];
  private nextBoxId = 1;

  private cart!: Phaser.GameObjects.Container;
  private cartSprite!: Phaser.GameObjects.Image;
  private cartCountText!: Phaser.GameObjects.Text;
  private worker!: Phaser.GameObjects.Image;
  private cartAtShelf = false;
  private movingCart = false;
  private restockBusy = false;

  private taskText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private moneyText!: Phaser.GameObjects.Text;
  private starText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private bubbleText!: Phaser.GameObjects.Text;
  private hintBubble!: Phaser.GameObjects.Image;
  private phaseBanner!: Phaser.GameObjects.Text;

  private guideGraphics!: Phaser.GameObjects.Graphics;
  private guideLabelBg!: Phaser.GameObjects.Rectangle;
  private guideLabel!: Phaser.GameObjects.Text;
  private guideMode: GuideMode = "NONE";
  private guideTween?: Phaser.Tweens.Tween;
  private highlightedMissing?: Phaser.GameObjects.Image;
  private highlightedMissingScale?: { x: number; y: number };

  private money = 0;
  private stars = 0;
  private stocked = 0;
  private soldCount = 0;
  private combo = 0;
  private comboDeadline = 0;
  private phase: ShiftPhase = "PREPARE";
  private shiftEnded = false;
  private remainingSeconds: number = GAME_RULES.shiftSeconds;
  private customerSequence = 0;
  private reserveStockStarted = false;

  private pauseOverlay?: Phaser.GameObjects.Container;
  private purchaseEvent?: Phaser.Time.TimerEvent;
  private timerEvent?: Phaser.Time.TimerEvent;

  constructor() {
    super("game");
  }

  preload(): void {
    Object.entries(AssetPaths).forEach(([key, path]) => this.load.image(key, path));
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#151b1b");
    this.createStage();
    this.createHud();
    this.createGuides();
    this.createWorker();
    this.createInitialBoxes();
    this.createCart();
    this.createShelfSlots();
    this.startShiftTimer();
    this.updateHud();
  }

  private createStage(): void {
    this.add.image(339, 669, Assets.backgrounds.backroom)
      .setDisplaySize(678, 1026)
      .setDepth(0);

    this.add.image(1004, 669, Assets.backgrounds.salesfloor)
      .setDisplaySize(652, 1026)
      .setDepth(0);

    this.add.rectangle(678, 669, 7, 1026, 0x141919, 0.95).setDepth(2);

    this.add.rectangle(98, 192, 182, 48, 0x244f2e, 0.96)
      .setStrokeStyle(2, 0x7ca17f)
      .setDepth(4);
    this.add.text(22, 178, "BACKROOM", {
      fontFamily: "Arial",
      fontSize: "26px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setDepth(5);

    this.add.rectangle(795, 192, 192, 48, 0x3f6688, 0.96)
      .setStrokeStyle(2, 0x86a5bf)
      .setDepth(4);
    this.add.text(710, 178, "SALES FLOOR", {
      fontFamily: "Arial",
      fontSize: "26px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setDepth(5);

    this.add.image(1020, 510, Assets.props.shelf)
      .setDisplaySize(555, 690)
      .setDepth(3);
  }

  private createHud(): void {
    this.add.rectangle(665, 78, 1330, 156, 0x111818, 0.98).setDepth(50);

    this.add.image(285, 78, Assets.ui.taskPanel)
      .setDisplaySize(560, 132)
      .setDepth(51);

    this.add.image(83, 76, Assets.ui.workerAvatar)
      .setDisplaySize(110, 110)
      .setDepth(53);

    this.add.text(154, 27, "Morning Shift", {
      fontFamily: "Arial",
      fontSize: "25px",
      color: "#f7e9b0",
      fontStyle: "bold"
    }).setDepth(53);

    this.add.text(154, 61, "Restock Drinks", {
      fontFamily: "Arial",
      fontSize: "34px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setDepth(53);

    this.taskText = this.add.text(154, 110, "", {
      fontFamily: "Arial",
      fontSize: "21px",
      color: "#e8f1f1"
    }).setDepth(53);

    const taskButton = this.add.image(655, 78, Assets.ui.taskButton)
      .setDisplaySize(104, 112)
      .setDepth(53)
      .setInteractive({ useHandCursor: true });
    taskButton.on("pointerdown", () => this.showTransientHint(this.phaseHelpText()));

    this.add.image(835, 78, Assets.ui.star).setDisplaySize(55, 55).setDepth(53);
    this.starText = this.add.text(875, 55, "0", {
      fontFamily: "Arial",
      fontSize: "31px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setDepth(53);

    this.add.image(965, 78, Assets.ui.coin).setDisplaySize(54, 54).setDepth(53);
    this.moneyText = this.add.text(1002, 55, "0", {
      fontFamily: "Arial",
      fontSize: "31px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setDepth(53);

    this.add.image(1090, 78, Assets.ui.timer).setDisplaySize(52, 52).setDepth(53);
    this.timerText = this.add.text(1126, 55, "03:00", {
      fontFamily: "Arial",
      fontSize: "31px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setDepth(53);

    const menuButton = this.add.image(1265, 78, Assets.ui.menu)
      .setDisplaySize(72, 72)
      .setDepth(54)
      .setInteractive({ useHandCursor: true });
    menuButton.on("pointerdown", () => this.togglePauseOverlay());

    this.add.image(665, 1120, Assets.ui.stepCard)
      .setDisplaySize(820, 104)
      .setDepth(51);

    this.hintText = this.add.text(665, 1118, "", {
      fontFamily: "Arial",
      fontSize: "24px",
      color: "#172020",
      fontStyle: "bold",
      align: "center",
      wordWrap: { width: 745 }
    }).setOrigin(0.5).setDepth(53);

    this.comboText = this.add.text(1005, 885, "", {
      fontFamily: "Arial",
      fontSize: "27px",
      color: "#ffe36a",
      fontStyle: "bold",
      stroke: "#3b2c15",
      strokeThickness: 5
    }).setOrigin(0.5).setDepth(45);

    this.hintBubble = this.add.image(520, 520, Assets.ui.hintBubble)
      .setDisplaySize(360, 165)
      .setAlpha(0)
      .setDepth(40);

    this.bubbleText = this.add.text(520, 515, "", {
      fontFamily: "Arial",
      fontSize: "19px",
      color: "#243030",
      fontStyle: "bold",
      align: "center",
      wordWrap: { width: 290 }
    }).setOrigin(0.5).setAlpha(0).setDepth(41);

    this.phaseBanner = this.add.text(665, 215, "", {
      fontFamily: "Arial",
      fontSize: "38px",
      color: "#fff2a8",
      fontStyle: "bold",
      stroke: "#263027",
      strokeThickness: 7
    }).setOrigin(0.5).setDepth(60).setAlpha(0);
  }

  private createGuides(): void {
    this.guideGraphics = this.add.graphics().setDepth(70).setVisible(false);
    this.guideLabelBg = this.add.rectangle(0, 0, 350, 56, 0x17312a, 0.96)
      .setStrokeStyle(3, 0xffd75a)
      .setDepth(71)
      .setVisible(false);
    this.guideLabel = this.add.text(0, 0, "", {
      fontFamily: "Arial",
      fontSize: "21px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setOrigin(0.5).setDepth(72).setVisible(false);
  }

  private createWorker(): void {
    this.worker = this.add.image(WORKER_HOME.x, WORKER_HOME.y, Assets.characters.workerIdle)
      .setOrigin(0.5, 1)
      .setDepth(12);
    this.fitImage(this.worker, 220, 440);
  }

  private createInitialBoxes(): void {
    INITIAL_BOX_ORDER.forEach((productId, index) => this.spawnBox(productId, index, false));
  }

  private spawnBox(productId: ProductId, positionIndex: number, renewable: boolean): BoxItem {
    const position = BOX_POSITIONS[positionIndex];
    const shadow = this.add.ellipse(position.x, position.y + 3, 82, 18, 0x101515, 0.24)
      .setDepth(14 + position.y / 10000);

    const image = this.add.image(position.x, position.y, PRODUCTS[productId].boxKey)
      .setOrigin(0.5, 1)
      .setDepth(16 + position.y / 10000)
      .setInteractive({ useHandCursor: true });
    this.fitImage(image, 120, 120);

    const item: BoxItem = {
      id: this.nextBoxId++,
      productId,
      image,
      shadow,
      positionIndex,
      renewable,
      loaded: false,
      homeX: position.x,
      homeY: position.y
    };

    this.installBoxDrag(item);
    this.boxes.push(item);
    return item;
  }

  private installBoxDrag(item: BoxItem): void {
    const image = item.image;
    this.input.setDraggable(image);

    image.on("pointerdown", () => this.selectBox(item));

    image.on("dragstart", () => {
      const blocked =
        this.shiftEnded ||
        this.movingCart ||
        this.restockBusy ||
        this.cartAtShelf ||
        item.loaded ||
        this.loadedProducts.length >= GAME_RULES.cartCapacity;

      image.setData("dragBlocked", blocked);
      if (blocked) {
        this.showTransientHint(
          this.cartAtShelf
            ? "Return the cart to the backroom before loading boxes."
            : "The cart cannot take another box right now."
        );
        return;
      }

      this.tweens.killTweensOf(image);
      this.selectBox(item);
      image.setDepth(46).setAlpha(0.96);
      item.shadow.setVisible(false);
      this.cartSprite.setTint(0xffef9f);
    });

    image.on("drag", (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
      if (image.getData("dragBlocked")) return;

      image.setPosition(
        Phaser.Math.Clamp(dragX, 45, 650),
        Phaser.Math.Clamp(dragY, 260, 1070)
      );

      const targetWorkerX = Phaser.Math.Clamp(image.x + 105, 190, 650);
      const targetWorkerY = Phaser.Math.Clamp(image.y, 440, 980);
      this.worker.setPosition(
        Phaser.Math.Linear(this.worker.x, targetWorkerX, 0.35),
        Phaser.Math.Linear(this.worker.y, targetWorkerY, 0.35)
      );

      this.cartSprite.setTint(this.isOverCart(image) ? 0xbff3a8 : 0xffef9f);
    });

    image.on("dragend", () => {
      const blocked = Boolean(image.getData("dragBlocked"));
      image.setData("dragBlocked", false);
      this.cartSprite.clearTint();

      if (blocked) {
        this.returnBoxHome(item);
        return;
      }

      if (this.isOverCart(image)) {
        this.selectedBox = item;
        this.loadSelectedBox();
        return;
      }

      this.returnBoxHome(item);
    });
  }

  private selectBox(item: BoxItem): void {
    if (
      this.shiftEnded ||
      this.movingCart ||
      this.restockBusy ||
      this.cartAtShelf ||
      item.loaded ||
      !item.image.visible
    ) return;

    if (this.loadedProducts.length >= GAME_RULES.cartCapacity) {
      this.showTransientHint("The cart is full. Take it to the sales floor.");
      return;
    }

    this.selectedBox?.image.clearTint();
    this.selectedBox = item;
    item.image.setTint(0xfff0a6);
    this.setWorkerTexture(Assets.characters.workerCarry, 220, 440);
    this.updateHud();
  }

  private returnBoxHome(item: BoxItem): void {
    if (this.selectedBox === item) this.selectedBox = undefined;
    item.image.clearTint().setAlpha(1).setDepth(16 + item.homeY / 10000);
    this.setWorkerTexture(Assets.characters.workerIdle, 220, 440);

    this.tweens.add({
      targets: item.image,
      x: item.homeX,
      y: item.homeY,
      duration: 220,
      ease: "Sine.Out",
      onComplete: () => item.shadow.setVisible(true)
    });

    this.tweens.add({
      targets: this.worker,
      x: WORKER_HOME.x,
      y: WORKER_HOME.y,
      duration: 220,
      ease: "Sine.Out",
      onComplete: () => this.updateHud()
    });
  }

  private createCart(): void {
    this.cartSprite = this.add.image(0, 0, Assets.props.cart).setOrigin(0.5, 1);
    this.fitImage(this.cartSprite, 250, 230);

    this.cartCountText = this.add.text(85, -170, "0/6", {
      fontFamily: "Arial",
      fontSize: "24px",
      color: "#ffffff",
      fontStyle: "bold",
      backgroundColor: "#152020",
      padding: { x: 8, y: 4 }
    }).setOrigin(0.5);

    this.cart = this.add.container(CART_HOME.x, CART_HOME.y, [this.cartSprite, this.cartCountText])
      .setSize(285, 250)
      .setDepth(18)
      .setInteractive({ useHandCursor: true });

    this.cart.on("pointerdown", () => this.handleCartTap());
    this.installCartDrag();
  }

  private installCartDrag(): void {
    this.input.setDraggable(this.cart);

    this.cart.on("dragstart", () => {
      const fromSales = this.cartAtShelf;
      const required = this.departureRequirement();
      const blocked =
        this.shiftEnded ||
        this.movingCart ||
        this.restockBusy ||
        (!fromSales && this.loadedProducts.length < required);

      this.cart.setData("dragBlocked", blocked);
      this.cart.setData("dragFromSales", fromSales);

      if (blocked) {
        if (!fromSales && this.loadedProducts.length < required) {
          this.showTransientHint(`Load ${required - this.loadedProducts.length} more box(es) first.`);
        }
        return;
      }

      this.clearGuide();
      this.movingCart = true;
      this.setWorkerTexture(Assets.characters.workerPush, 250, 455);
      this.worker.setPosition(this.cart.x - 115, this.cart.y);
      this.cart.setDepth(38);
      this.updateHud();
    });

    this.cart.on("drag", (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
      if (this.cart.getData("dragBlocked")) return;

      this.cart.setPosition(
        Phaser.Math.Clamp(dragX, 455, 820),
        Phaser.Math.Clamp(dragY, 790, 940)
      );

      this.worker.setPosition(
        Phaser.Math.Linear(this.worker.x, this.cart.x - 115, 0.42),
        Phaser.Math.Linear(this.worker.y, this.cart.y, 0.42)
      );
    });

    this.cart.on("dragend", () => {
      const blocked = Boolean(this.cart.getData("dragBlocked"));
      const fromSales = Boolean(this.cart.getData("dragFromSales"));
      this.cart.setData("dragBlocked", false);
      if (blocked) return;

      if (fromSales) {
        this.snapCart(this.cart.x <= DOORWAY_X ? "WAREHOUSE" : "SALES");
      } else {
        this.snapCart(this.cart.x >= DOORWAY_X ? "SALES" : "WAREHOUSE");
      }
    });
  }

  private handleCartTap(): void {
    if (this.shiftEnded || this.movingCart || this.restockBusy) return;

    if (this.selectedBox) {
      if (this.cartAtShelf) {
        this.showTransientHint("Return the cart to the backroom before loading boxes.");
        return;
      }
      this.loadSelectedBox();
      return;
    }

    if (this.cartAtShelf) {
      const missingSlots = this.shelfSlots.filter((slot) => !slot.product);
      const hasMatchingStock = missingSlots.some((slot) => this.loadedProducts.includes(slot.productId));
      if (missingSlots.length > 0 && !hasMatchingStock) {
        this.showTransientHint("No matching stock. Drag the cart back to the backroom.");
      }
      return;
    }

    const required = this.departureRequirement();
    if (this.loadedProducts.length >= required) {
      this.showTransientHint("Drag the cart through the doorway to the sales floor.");
      return;
    }

    this.showTransientHint(`Load ${required - this.loadedProducts.length} more box(es) before leaving.`);
  }

  private loadSelectedBox(): void {
    const item = this.selectedBox;
    if (!item || this.cartAtShelf) return;

    this.selectedBox = undefined;
    item.image.clearTint().disableInteractive();
    item.shadow.destroy();

    this.tweens.add({
      targets: item.image,
      x: this.cart.x,
      y: this.cart.y - 55,
      scaleX: item.image.scaleX * 0.42,
      scaleY: item.image.scaleY * 0.42,
      duration: 320,
      ease: "Cubic.Out",
      onComplete: () => {
        item.loaded = true;
        item.image.setVisible(false);
        this.loadedProducts.push(item.productId);
        this.setWorkerTexture(Assets.characters.workerIdle, 220, 440);
        this.worker.setPosition(WORKER_HOME.x, WORKER_HOME.y);
        this.updateCartCount();

        if (item.renewable) this.scheduleReserveRespawn(item.productId, item.positionIndex);
        this.updateHud();
      }
    });
  }

  private snapCart(destination: "WAREHOUSE" | "SALES"): void {
    const cartTarget = destination === "SALES" ? CART_SALES : CART_HOME;
    const workerTarget = destination === "SALES" ? WORKER_SALES_HOME : WORKER_HOME;

    this.tweens.add({
      targets: this.cart,
      x: cartTarget.x,
      y: cartTarget.y,
      duration: 260,
      ease: "Sine.Out"
    });

    this.tweens.add({
      targets: this.worker,
      x: workerTarget.x,
      y: workerTarget.y,
      duration: 260,
      ease: "Sine.Out",
      onComplete: () => {
        this.cart.setDepth(18);
        this.cartAtShelf = destination === "SALES";
        this.movingCart = false;
        this.setWorkerTexture(Assets.characters.workerIdle, destination === "SALES" ? 205 : 220, destination === "SALES" ? 420 : 440);

        if (destination === "WAREHOUSE" && this.phase === "CLOSING") {
          this.endShift();
          return;
        }
        this.updateHud();
      }
    });
  }

  private createShelfSlots(): void {
    SLOT_POSITIONS.forEach((position, index) => {
      const productId = SLOT_PRODUCT_ORDER[index];
      const hitArea = this.add.rectangle(position.x, position.y, 118, 128, 0xffffff, 0.001)
        .setDepth(25)
        .setInteractive({ useHandCursor: true });

      const missingTag = this.add.image(position.x, position.y + 30, Assets.ui.missingTag)
        .setDisplaySize(112, 44)
        .setDepth(24);

      const typeLabel = this.add.text(position.x, position.y - 56, PRODUCTS[productId].label, {
        fontFamily: "Arial",
        fontSize: "13px",
        color: "#d9efff",
        fontStyle: "bold",
        backgroundColor: "#19394f",
        padding: { x: 5, y: 2 }
      }).setOrigin(0.5).setDepth(23);

      const slot: ShelfSlot = {
        index,
        productId,
        hitArea,
        missingTag,
        typeLabel,
        productBottomY: position.productBottomY,
        reservedForCustomer: false
      };

      hitArea.on("pointerdown", () => this.tryRestockSlot(slot));
      this.shelfSlots.push(slot);
    });
  }

  private tryRestockSlot(slot: ShelfSlot): void {
    if (this.shiftEnded || this.movingCart || !this.cartAtShelf || this.restockBusy) return;
    if (slot.product || slot.reservedForCustomer) return;

    const productIndex = this.loadedProducts.indexOf(slot.productId);
    if (productIndex < 0) {
      this.showTransientHint(
        `No ${PRODUCTS[slot.productId].label} on the cart. Return to the backroom for the matching box.`
      );
      this.updateHud();
      return;
    }

    this.clearGuide();
    this.restockBusy = true;
    this.loadedProducts.splice(productIndex, 1);
    this.updateCartCount();

    const definition = PRODUCTS[slot.productId];
    const product = this.add.image(this.cart.x + 15, this.cart.y - 55, definition.productKey)
      .setOrigin(0.5, 1)
      .setDepth(31);
    this.fitImage(product, definition.shelfWidth, definition.shelfHeight);

    const pickupX = this.cart.x - 90;
    const pickupY = this.cart.y;
    const approachX = Phaser.Math.Clamp(slot.hitArea.x - 105, 720, 1080);
    const approachY = Phaser.Math.Clamp(slot.productBottomY + 180, 560, 790);

    this.setWorkerTexture(Assets.characters.workerIdle, 205, 420);
    this.tweens.add({
      targets: this.worker,
      x: pickupX,
      y: pickupY,
      duration: 180,
      ease: "Sine.Out",
      onComplete: () => {
        this.setWorkerTexture(Assets.characters.workerCarry, 215, 430);

        this.tweens.add({
          targets: this.worker,
          x: approachX,
          y: approachY,
          duration: 420,
          ease: "Sine.InOut"
        });

        this.tweens.add({
          targets: product,
          x: slot.hitArea.x,
          y: slot.productBottomY,
          duration: 500,
          ease: "Cubic.Out",
          onComplete: () => {
            slot.product = product;
            slot.missingTag.setVisible(false);
            this.stocked += 1;
            this.recordRestockCombo();

            if (this.stocked >= this.shelfSlots.length && this.phase === "PREPARE") {
              this.openStore();
            }

            this.setWorkerTexture(Assets.characters.workerIdle, 205, 420);
            this.tweens.add({
              targets: this.worker,
              x: WORKER_SALES_HOME.x,
              y: WORKER_SALES_HOME.y,
              duration: 240,
              ease: "Sine.Out"
            });

            this.restockBusy = false;
            this.updateHud();
          }
        });
      }
    });
  }

  private recordRestockCombo(): void {
    if (this.phase === "PREPARE") return;

    const now = this.time.now;
    this.combo = now <= this.comboDeadline ? this.combo + 1 : 1;
    this.comboDeadline = now + GAME_RULES.comboWindowMs;

    if (this.combo >= 2) {
      const bonus = Math.min(10, this.combo * 2);
      this.money += bonus;
      this.comboText.setText(`RESTOCK x${this.combo}  +${bonus}`).setAlpha(1).setScale(0.8);
      this.tweens.add({
        targets: this.comboText,
        alpha: 0,
        scaleX: 1.15,
        scaleY: 1.15,
        duration: 900,
        ease: "Cubic.Out"
      });
    }
  }

  private openStore(): void {
    this.phase = "OPEN";
    this.startReserveStock();
    this.showPhaseBanner("STORE OPEN");
    this.showTransientHint("Customers are entering. Restock only when real stock is available on the cart.");
    this.startCustomerLoop(GAME_RULES.customerIntervalOpenMs);
    this.updateHud();
  }

  private startReserveStock(): void {
    if (this.reserveStockStarted) return;
    this.reserveStockStarted = true;

    const reserveOrder: ProductId[] = ["cola", "water", "milk", "cola", "water", "milk"];
    reserveOrder.forEach((productId, index) => {
      this.time.delayedCall(index * 110, () => this.spawnBox(productId, index, true));
    });
  }

  private scheduleReserveRespawn(productId: ProductId, positionIndex: number): void {
    this.time.delayedCall(GAME_RULES.reserveRespawnDelayMs, () => {
      if (!this.shiftEnded && this.phase !== "RESULT") this.spawnBox(productId, positionIndex, true);
    });
  }

  private startCustomerLoop(delay: number): void {
    this.purchaseEvent?.remove(false);
    this.purchaseEvent = this.time.addEvent({
      delay,
      loop: true,
      callback: () => this.customerPurchase()
    });
  }

  private customerPurchase(): void {
    if (this.shiftEnded || (this.phase !== "OPEN" && this.phase !== "RUSH")) return;

    const available = this.shelfSlots.filter((slot) => slot.product && !slot.reservedForCustomer);
    if (available.length === 0) return;

    const slot = this.pickWeightedSlot(available);
    slot.reservedForCustomer = true;

    const customerKeys = this.customerSequence % 2 === 0
      ? { idle: Assets.characters.customer01Idle, basket: Assets.characters.customer01Basket }
      : { idle: Assets.characters.customer02Idle, basket: Assets.characters.customer02Basket };
    this.customerSequence += 1;

    const customer = this.add.image(1310, 900, customerKeys.idle)
      .setOrigin(0.5, 1)
      .setDepth(35);
    this.fitImage(customer, 145, 300);

    const customerStopX = Phaser.Math.Clamp(slot.hitArea.x + 85, 820, 1235);
    const customerStopY = 860;

    this.tweens.add({
      targets: customer,
      x: customerStopX,
      y: customerStopY,
      duration: 720,
      ease: "Sine.InOut",
      onComplete: () => {
        if (!slot.product) {
          slot.reservedForCustomer = false;
          customer.destroy();
          return;
        }

        const soldProduct = slot.product;
        slot.product = undefined;
        slot.reservedForCustomer = false;
        soldProduct.destroy();
        slot.missingTag.setVisible(true);
        this.stocked = Math.max(0, this.stocked - 1);

        customer.setTexture(customerKeys.basket);
        this.fitImage(customer, 150, 305);

        const price = PRODUCTS[slot.productId].price;
        this.money += price;
        this.soldCount += 1;
        this.updateStars();
        this.showIncome(slot.hitArea.x, slot.hitArea.y - 55, price);
        this.advanceBusinessPhase();
        this.updateHud();

        this.tweens.add({
          targets: customer,
          x: 1305,
          y: 965,
          alpha: 0,
          duration: 680,
          ease: "Sine.In",
          onComplete: () => customer.destroy()
        });
      }
    });
  }

  private advanceBusinessPhase(): void {
    if (this.phase === "OPEN" && this.soldCount >= GAME_RULES.normalSalesTarget) {
      this.phase = "RUSH";
      this.showPhaseBanner("LUNCH RUSH!");
      this.showTransientHint("Rush hour: customers arrive faster. Prioritize matching stock.");
      this.startCustomerLoop(GAME_RULES.customerIntervalRushMs);
      return;
    }

    if (this.phase === "RUSH" && this.soldCount >= GAME_RULES.rushSalesTarget) {
      this.phase = "CLOSING";
      this.purchaseEvent?.remove(false);
      this.showPhaseBanner("CLOSING TIME");
      this.showTransientHint("Customers are done. Return the cart to the backroom to finish the shift.");
      this.updateHud();
    }
  }

  private pickWeightedSlot(slots: ShelfSlot[]): ShelfSlot {
    const totalWeight = slots.reduce((sum, slot) => sum + PRODUCTS[slot.productId].saleWeight, 0);
    let cursor = Phaser.Math.FloatBetween(0, totalWeight);

    for (const slot of slots) {
      cursor -= PRODUCTS[slot.productId].saleWeight;
      if (cursor <= 0) return slot;
    }
    return slots[slots.length - 1];
  }

  private showIncome(x: number, y: number, amount: number): void {
    const income = this.add.text(x, y, `+${amount}`, {
      fontFamily: "Arial",
      fontSize: "27px",
      color: "#ffe36a",
      fontStyle: "bold",
      stroke: "#4c3515",
      strokeThickness: 5
    }).setOrigin(0.5).setDepth(60);

    this.tweens.add({
      targets: income,
      y: y - 90,
      alpha: 0,
      duration: 850,
      ease: "Cubic.Out",
      onComplete: () => income.destroy()
    });
  }

  private updateStars(): void {
    this.stars = GAME_RULES.starSalesThresholds.filter((threshold) => this.soldCount >= threshold).length;
    this.stars = Math.min(GAME_RULES.maxStars, this.stars);
  }

  private startShiftTimer(): void {
    this.updateTimerText();
    this.timerEvent = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (this.shiftEnded) return;
        this.remainingSeconds = Math.max(0, this.remainingSeconds - 1);
        this.updateTimerText();
        if (this.remainingSeconds <= 0) this.endShift();
      }
    });
  }

  private updateTimerText(): void {
    const minutes = Math.floor(this.remainingSeconds / 60);
    const seconds = this.remainingSeconds % 60;
    this.timerText.setText(`${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`);
  }

  private endShift(): void {
    if (this.shiftEnded) return;
    this.shiftEnded = true;
    this.phase = "RESULT";
    this.purchaseEvent?.remove(false);
    this.timerEvent?.remove(false);
    this.clearGuide();
    this.selectedBox?.image.clearTint();
    this.selectedBox = undefined;
    this.updateHud();

    const shade = this.add.rectangle(665, 591, 1330, 1182, 0x071010, 0.78);
    const panel = this.add.rectangle(665, 575, 620, 430, 0xf4e7c9, 0.98)
      .setStrokeStyle(8, 0x4c7148);
    const title = this.add.text(665, 435, "SHIFT COMPLETE", {
      fontFamily: "Arial",
      fontSize: "46px",
      color: "#25382d",
      fontStyle: "bold"
    }).setOrigin(0.5);
    const summary = this.add.text(
      665,
      555,
      `Sales: ${this.soldCount}\nCoins: ${this.money}\nStars: ${this.stars}/${GAME_RULES.maxStars}`,
      {
        fontFamily: "Arial",
        fontSize: "31px",
        color: "#25382d",
        align: "center",
        lineSpacing: 12
      }
    ).setOrigin(0.5);
    const retry = this.add.rectangle(665, 720, 260, 72, 0x4f8b4c)
      .setStrokeStyle(4, 0x2f5f32)
      .setInteractive({ useHandCursor: true });
    const retryText = this.add.text(665, 720, "PLAY AGAIN", {
      fontFamily: "Arial",
      fontSize: "27px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setOrigin(0.5);

    retry.on("pointerdown", () => this.scene.restart());
    retryText.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.scene.restart());
    this.pauseOverlay = this.add.container(0, 0, [shade, panel, title, summary, retry, retryText]).setDepth(100);
  }

  private togglePauseOverlay(): void {
    if (this.shiftEnded) return;

    if (this.pauseOverlay) {
      this.pauseOverlay.destroy(true);
      this.pauseOverlay = undefined;
      this.time.paused = false;
      this.tweens.resumeAll();
      return;
    }

    const shade = this.add.rectangle(665, 591, 1330, 1182, 0x071010, 0.7);
    const panel = this.add.rectangle(665, 575, 500, 270, 0xf4e7c9, 0.98)
      .setStrokeStyle(8, 0x4c7148);
    const title = this.add.text(665, 515, "PAUSED", {
      fontFamily: "Arial",
      fontSize: "46px",
      color: "#25382d",
      fontStyle: "bold"
    }).setOrigin(0.5);
    const resume = this.add.rectangle(665, 640, 240, 70, 0x4f8b4c)
      .setInteractive({ useHandCursor: true });
    const resumeText = this.add.text(665, 640, "RESUME", {
      fontFamily: "Arial",
      fontSize: "27px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setOrigin(0.5);

    this.pauseOverlay = this.add.container(0, 0, [shade, panel, title, resume, resumeText]).setDepth(100);
    const close = () => this.togglePauseOverlay();
    resume.on("pointerdown", close);
    resumeText.setInteractive({ useHandCursor: true }).on("pointerdown", close);

    this.tweens.pauseAll();
    this.time.paused = true;
  }

  private showTransientHint(message: string): void {
    if (this.shiftEnded) return;
    this.hintBubble.setAlpha(1);
    this.bubbleText.setText(message).setAlpha(1);
    this.tweens.killTweensOf(this.hintBubble);
    this.tweens.killTweensOf(this.bubbleText);
    this.tweens.add({
      targets: [this.hintBubble, this.bubbleText],
      alpha: 0,
      delay: 2100,
      duration: 350
    });
  }

  private showPhaseBanner(text: string): void {
    this.phaseBanner.setText(text).setAlpha(0).setScale(0.8);
    this.tweens.add({
      targets: this.phaseBanner,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 260,
      yoyo: true,
      hold: 1050,
      ease: "Cubic.Out"
    });
  }

  private updateHud(): void {
    this.moneyText.setText(String(this.money));
    this.starText.setText(String(this.stars));
    this.updateCartCount();

    const phaseName = this.phase === "PREPARE"
      ? "Prepare"
      : this.phase === "OPEN"
        ? "Open"
        : this.phase === "RUSH"
          ? "Rush"
          : this.phase === "CLOSING"
            ? "Closing"
            : "Complete";
    this.taskText.setText(`${phaseName} · Sales ${this.soldCount} · Shelf ${this.stocked}/${this.shelfSlots.length}`);

    if (this.shiftEnded) {
      this.hintText.setText("Shift complete");
      return;
    }

    if (this.restockBusy) {
      this.hintText.setText("Worker is restocking the selected shelf slot");
      return;
    }

    if (this.phase === "CLOSING") {
      if (this.cartAtShelf) {
        this.hintText.setText("CLOSING · Drag the cart back through the doorway to the BACKROOM");
        this.showCartGuide("CART_TO_WAREHOUSE");
      } else {
        this.hintText.setText("Closing task complete");
      }
      return;
    }

    if (this.movingCart) {
      this.hintText.setText(this.cartAtShelf ? "Push the cart to the backroom" : "Push the cart to the sales floor");
      return;
    }

    if (this.selectedBox) {
      this.hintText.setText(`Drag ${PRODUCTS[this.selectedBox.productId].label} onto the cart`);
      return;
    }

    if (!this.cartAtShelf) {
      const required = this.departureRequirement();
      if (this.loadedProducts.length >= required) {
        this.hintText.setText("Cart ready · DRAG it through the doorway to the SALES FLOOR");
        this.showCartGuide("CART_TO_SALES");
      } else {
        this.clearGuide();
        this.hintText.setText(`Drag boxes onto cart · ${this.loadedProducts.length}/${required}`);
      }
      return;
    }

    const missingSlots = this.shelfSlots.filter((slot) => !slot.product);
    const restockable = missingSlots.find((slot) => this.loadedProducts.includes(slot.productId));
    if (restockable) {
      this.hintText.setText(`Tap the glowing ${PRODUCTS[restockable.productId].label} MISSING slot`);
      this.showRestockGuide(restockable);
      return;
    }

    if (missingSlots.length > 0) {
      this.hintText.setText("No matching stock · DRAG cart back to BACKROOM and load the right box");
      this.showCartGuide("CART_TO_WAREHOUSE");
      return;
    }

    this.clearGuide();
    this.hintText.setText(
      this.phase === "PREPARE"
        ? "Shelves full · opening store"
        : this.phase === "RUSH"
          ? "Rush hour · watch for the next empty slot"
          : "Store open · watch for the next customer"
    );
  }

  private departureRequirement(): number {
    return this.phase === "PREPARE" ? GAME_RULES.firstMoveRequirement : GAME_RULES.reopenMoveRequirement;
  }

  private phaseHelpText(): string {
    switch (this.phase) {
      case "PREPARE":
        return "Drag boxes onto the cart, move it through the doorway, then fill matching shelf slots.";
      case "OPEN":
        return "Customers buy items. Use real cart stock to refill matching MISSING slots.";
      case "RUSH":
        return "Rush hour is faster. Prioritize products that are actually missing.";
      case "CLOSING":
        return "Return the cart to the backroom to finish the shift.";
      default:
        return "Shift complete.";
    }
  }

  private showCartGuide(mode: "CART_TO_SALES" | "CART_TO_WAREHOUSE"): void {
    if (this.guideMode === mode) return;
    this.clearGuide();
    this.guideMode = mode;

    const toSales = mode === "CART_TO_SALES";
    const endX = toSales ? 775 : 575;
    const midX = toSales ? 655 : 705;

    this.guideGraphics.clear();
    this.guideGraphics.lineStyle(10, 0xffd75a, 0.95);
    this.guideGraphics.beginPath();
    this.guideGraphics.moveTo(this.cart.x, this.cart.y - 90);
    this.guideGraphics.lineTo(midX, 760);
    this.guideGraphics.lineTo(endX, 760);
    this.guideGraphics.strokePath();
    this.guideGraphics.fillStyle(0xffd75a, 1);
    if (toSales) {
      this.guideGraphics.fillTriangle(endX + 18, 760, endX - 15, 742, endX - 15, 778);
    } else {
      this.guideGraphics.fillTriangle(endX - 18, 760, endX + 15, 742, endX + 15, 778);
    }
    this.guideGraphics.setVisible(true);

    this.guideLabelBg.setPosition(675, 700).setVisible(true);
    this.guideLabel.setPosition(675, 700)
      .setText(toSales ? "DRAG CART TO SALES →" : "← RETURN CART TO BACKROOM")
      .setVisible(true);

    this.guideTween = this.tweens.add({
      targets: this.cartSprite,
      alpha: 0.58,
      duration: 430,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut"
    });
  }

  private showRestockGuide(slot: ShelfSlot): void {
    if (this.guideMode === "RESTOCK" && this.highlightedMissing === slot.missingTag) return;
    this.clearGuide();
    this.guideMode = "RESTOCK";
    this.highlightedMissing = slot.missingTag;
    this.highlightedMissingScale = { x: slot.missingTag.scaleX, y: slot.missingTag.scaleY };

    this.guideLabelBg.setPosition(slot.missingTag.x, slot.missingTag.y + 88).setVisible(true);
    this.guideLabel.setPosition(slot.missingTag.x, slot.missingTag.y + 88)
      .setText(`TAP ${PRODUCTS[slot.productId].label} HERE ↑`)
      .setVisible(true);

    this.guideTween = this.tweens.add({
      targets: slot.missingTag,
      alpha: 0.35,
      scaleX: slot.missingTag.scaleX * 1.1,
      scaleY: slot.missingTag.scaleY * 1.1,
      duration: 420,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut"
    });
  }

  private clearGuide(): void {
    this.guideTween?.stop();
    this.guideTween = undefined;
    this.tweens.killTweensOf(this.cartSprite);
    this.cartSprite?.setAlpha(1).clearTint();

    if (this.highlightedMissing?.active && this.highlightedMissingScale) {
      this.highlightedMissing.setAlpha(1).setScale(
        this.highlightedMissingScale.x,
        this.highlightedMissingScale.y
      );
    }

    this.highlightedMissing = undefined;
    this.highlightedMissingScale = undefined;
    this.guideGraphics?.setVisible(false);
    this.guideLabelBg?.setVisible(false);
    this.guideLabel?.setVisible(false);
    this.guideMode = "NONE";
  }

  private isOverCart(image: Phaser.GameObjects.Image): boolean {
    const bounds = this.cart.getBounds();
    return new Phaser.Geom.Rectangle(
      bounds.x - 25,
      bounds.y - 25,
      bounds.width + 50,
      bounds.height + 50
    ).contains(image.x, image.y);
  }

  private updateCartCount(): void {
    this.cartCountText?.setText(`${this.loadedProducts.length}/${GAME_RULES.cartCapacity}`);
  }

  private setWorkerTexture(texture: string, maxWidth: number, maxHeight: number): void {
    this.worker.setTexture(texture).setOrigin(0.5, 1);
    this.fitImage(this.worker, maxWidth, maxHeight);
  }

  private fitImage(image: Phaser.GameObjects.Image, maxWidth: number, maxHeight: number): void {
    const sourceWidth = Math.max(1, image.width);
    const sourceHeight = Math.max(1, image.height);
    const scale = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight);
    image.setScale(scale);
  }
}
