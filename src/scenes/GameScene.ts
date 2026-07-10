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

type BoxItem = {
  id: number;
  productId: ProductId;
  image: Phaser.GameObjects.Image;
  positionIndex: number;
  renewable: boolean;
  loaded: boolean;
};

type ShelfSlot = {
  index: number;
  productId: ProductId;
  hitArea: Phaser.GameObjects.Rectangle;
  missingTag: Phaser.GameObjects.Image;
  product?: Phaser.GameObjects.Image;
  reservedForCustomer: boolean;
};

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

  private taskText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private moneyText!: Phaser.GameObjects.Text;
  private starText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private bubbleText!: Phaser.GameObjects.Text;
  private hintBubble!: Phaser.GameObjects.Image;

  private money = 0;
  private stars = 0;
  private stocked = 0;
  private soldCount = 0;
  private combo = 0;
  private comboDeadline = 0;
  private storeOpen = false;
  private shiftEnded = false;
  private remainingSeconds = GAME_RULES.shiftSeconds;
  private customerSequence = 0;
  private reserveStockStarted = false;

  private pauseOverlay?: Phaser.GameObjects.Container;
  private purchaseEvent?: Phaser.Time.TimerEvent;
  private timerEvent?: Phaser.Time.TimerEvent;

  constructor() {
    super("game");
  }

  preload(): void {
    Object.entries(AssetPaths).forEach(([key, path]) => {
      this.load.image(key, path);
    });
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#151b1b");
    this.createStage();
    this.createHud();
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
    taskButton.on("pointerdown", () => {
      this.showTransientHint("Load matching products, fill the shelf, then keep up with customer demand.");
    });

    this.add.image(835, 78, Assets.ui.star)
      .setDisplaySize(55, 55)
      .setDepth(53);
    this.starText = this.add.text(875, 55, "0", {
      fontFamily: "Arial",
      fontSize: "31px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setDepth(53);

    this.add.image(965, 78, Assets.ui.coin)
      .setDisplaySize(54, 54)
      .setDepth(53);
    this.moneyText = this.add.text(1002, 55, "0", {
      fontFamily: "Arial",
      fontSize: "31px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setDepth(53);

    this.add.image(1090, 78, Assets.ui.timer)
      .setDisplaySize(52, 52)
      .setDepth(53);
    this.timerText = this.add.text(1126, 55, "05:00", {
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
      .setDisplaySize(720, 104)
      .setDepth(51);

    this.hintText = this.add.text(665, 1118, "", {
      fontFamily: "Arial",
      fontSize: "25px",
      color: "#172020",
      fontStyle: "bold",
      align: "center",
      wordWrap: { width: 640 }
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
  }

  private createWorker(): void {
    this.worker = this.add.image(500, 620, Assets.characters.workerIdle).setDepth(12);
    this.fitImage(this.worker, 250, 490);
  }

  private createInitialBoxes(): void {
    INITIAL_BOX_ORDER.forEach((productId, index) => {
      this.spawnBox(productId, index, false);
    });
  }

  private spawnBox(productId: ProductId, positionIndex: number, renewable: boolean): BoxItem {
    const position = BOX_POSITIONS[positionIndex];
    const image = this.add.image(position.x, position.y, PRODUCTS[productId].boxKey)
      .setDepth(16)
      .setInteractive({ useHandCursor: true });
    this.fitImage(image, 126, 126);

    const item: BoxItem = {
      id: this.nextBoxId++,
      productId,
      image,
      positionIndex,
      renewable,
      loaded: false
    };

    image.on("pointerdown", () => this.selectBox(item));
    this.boxes.push(item);
    return item;
  }

  private selectBox(item: BoxItem): void {
    if (this.shiftEnded || this.movingCart || item.loaded || !item.image.visible) return;
    if (this.loadedProducts.length >= GAME_RULES.cartCapacity) {
      this.showTransientHint("The cart is full. Restock a shelf slot first.");
      return;
    }

    if (this.selectedBox && this.selectedBox !== item) {
      this.selectedBox.image.clearTint();
      this.selectedBox.image.setScale(this.selectedBox.image.scaleX / 1.08);
    }

    this.selectedBox = item;
    item.image.setTint(0xfff0a6);
    item.image.setScale(item.image.scaleX * 1.08);
    this.setWorkerTexture(Assets.characters.workerCarry, 255, 500);
    this.updateHud();
  }

  private createCart(): void {
    this.cartSprite = this.add.image(0, 0, Assets.props.cart);
    this.fitImage(this.cartSprite, 280, 250);

    this.cartCountText = this.add.text(85, -72, "0/6", {
      fontFamily: "Arial",
      fontSize: "24px",
      color: "#ffffff",
      fontStyle: "bold",
      backgroundColor: "#152020",
      padding: { x: 8, y: 4 }
    }).setOrigin(0.5);

    this.cart = this.add.container(470, 825, [this.cartSprite, this.cartCountText])
      .setSize(300, 270)
      .setDepth(18)
      .setInteractive({ useHandCursor: true });

    this.cart.on("pointerdown", () => this.handleCartTap());
  }

  private handleCartTap(): void {
    if (this.shiftEnded || this.movingCart) return;

    if (this.selectedBox) {
      this.loadSelectedBox();
      return;
    }

    if (!this.cartAtShelf && this.loadedProducts.length >= GAME_RULES.firstMoveRequirement) {
      this.moveCartToShelf();
      return;
    }

    if (!this.cartAtShelf) {
      this.showTransientHint(`Load ${GAME_RULES.firstMoveRequirement - this.loadedProducts.length} more box(es) before moving the cart.`);
      return;
    }

    if (this.loadedProducts.length === 0) {
      this.showTransientHint("The cart is empty. Pick a new reserve box from the backroom.");
    }
  }

  private loadSelectedBox(): void {
    const item = this.selectedBox;
    if (!item) return;

    this.selectedBox = undefined;
    item.image.clearTint();
    item.image.disableInteractive();

    this.tweens.add({
      targets: item.image,
      x: this.cart.x,
      y: this.cart.y - 30,
      scaleX: item.image.scaleX * 0.45,
      scaleY: item.image.scaleY * 0.45,
      duration: 380,
      ease: "Cubic.Out",
      onComplete: () => {
        item.loaded = true;
        item.image.setVisible(false);
        this.loadedProducts.push(item.productId);
        this.setWorkerTexture(Assets.characters.workerIdle, 250, 490);
        this.cartCountText.setText(`${this.loadedProducts.length}/${GAME_RULES.cartCapacity}`);

        if (item.renewable) {
          this.scheduleReserveRespawn(item.productId, item.positionIndex);
        }

        this.updateHud();
      }
    });
  }

  private moveCartToShelf(): void {
    this.movingCart = true;
    this.setWorkerTexture(Assets.characters.workerPush, 275, 500);
    this.worker.setPosition(615, 750);
    this.updateHud();

    this.tweens.add({
      targets: this.cart,
      x: 735,
      y: 800,
      duration: 950,
      ease: "Sine.InOut"
    });

    this.tweens.add({
      targets: this.worker,
      x: 660,
      y: 700,
      duration: 950,
      ease: "Sine.InOut",
      onComplete: () => {
        this.movingCart = false;
        this.cartAtShelf = true;
        this.setWorkerTexture(Assets.characters.workerIdle, 235, 470);
        this.worker.setPosition(720, 690);
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

      const slot: ShelfSlot = {
        index,
        productId,
        hitArea,
        missingTag,
        reservedForCustomer: false
      };

      hitArea.on("pointerdown", () => this.tryRestockSlot(slot));
      this.shelfSlots.push(slot);
    });
  }

  private tryRestockSlot(slot: ShelfSlot): void {
    if (this.shiftEnded || this.movingCart || !this.cartAtShelf) return;
    if (slot.product || slot.reservedForCustomer) return;

    const productIndex = this.loadedProducts.indexOf(slot.productId);
    if (productIndex < 0) {
      this.showTransientHint(`This slot needs ${PRODUCTS[slot.productId].label}. Load the matching box.`);
      return;
    }

    this.loadedProducts.splice(productIndex, 1);
    this.cartCountText.setText(`${this.loadedProducts.length}/${GAME_RULES.cartCapacity}`);

    const product = this.add.image(this.cart.x, this.cart.y - 35, PRODUCTS[slot.productId].productKey)
      .setDepth(31);
    this.fitImage(product, 72, 112);

    this.tweens.add({
      targets: product,
      x: slot.hitArea.x,
      y: slot.hitArea.y,
      duration: 440,
      ease: "Cubic.Out",
      onComplete: () => {
        slot.product = product;
        slot.missingTag.setVisible(false);
        this.stocked += 1;
        this.recordRestockCombo();

        if (this.stocked >= this.shelfSlots.length && !this.storeOpen) {
          this.openStore();
        }

        this.updateHud();
      }
    });
  }

  private recordRestockCombo(): void {
    if (!this.storeOpen) return;

    const now = this.time.now;
    this.combo = now <= this.comboDeadline ? this.combo + 1 : 1;
    this.comboDeadline = now + GAME_RULES.comboWindowMs;

    if (this.combo >= 2) {
      const bonus = Math.min(10, this.combo * 2);
      this.money += bonus;
      this.comboText.setText(`RESTOCK x${this.combo}  +${bonus}`);
      this.comboText.setAlpha(1).setScale(0.8);
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
    this.storeOpen = true;
    this.showTransientHint("Store open! Customers will create new MISSING slots. Keep restocking.");
    this.startReserveStock();

    this.purchaseEvent = this.time.addEvent({
      delay: GAME_RULES.customerIntervalMs,
      loop: true,
      callback: () => this.customerPurchase()
    });
  }

  private startReserveStock(): void {
    if (this.reserveStockStarted) return;
    this.reserveStockStarted = true;

    const reserveOrder: ProductId[] = ["cola", "water", "milk", "cola", "water", "milk"];
    reserveOrder.forEach((productId, index) => {
      this.time.delayedCall(index * 100, () => this.spawnBox(productId, index, true));
    });
  }

  private scheduleReserveRespawn(productId: ProductId, positionIndex: number): void {
    this.time.delayedCall(GAME_RULES.reserveRespawnDelayMs, () => {
      if (!this.shiftEnded) this.spawnBox(productId, positionIndex, true);
    });
  }

  private customerPurchase(): void {
    if (!this.storeOpen || this.shiftEnded) return;

    const available = this.shelfSlots.filter((slot) => slot.product && !slot.reservedForCustomer);
    if (available.length === 0) return;

    const slot = this.pickWeightedSlot(available);
    slot.reservedForCustomer = true;

    const customerKeys = this.customerSequence % 2 === 0
      ? { idle: Assets.characters.customer01Idle, basket: Assets.characters.customer01Basket }
      : { idle: Assets.characters.customer02Idle, basket: Assets.characters.customer02Basket };
    this.customerSequence += 1;

    const customer = this.add.image(1310, 840, customerKeys.idle).setDepth(35);
    this.fitImage(customer, 170, 330);

    this.tweens.add({
      targets: customer,
      x: slot.hitArea.x + 20,
      y: 790,
      duration: 720,
      ease: "Sine.InOut",
      onComplete: () => {
        const soldProduct = slot.product;
        slot.product = undefined;
        slot.reservedForCustomer = false;
        soldProduct?.destroy();
        slot.missingTag.setVisible(true);
        this.stocked = Math.max(0, this.stocked - 1);

        customer.setTexture(customerKeys.basket);
        this.fitImage(customer, 180, 340);

        const price = PRODUCTS[slot.productId].price;
        this.money += price;
        this.soldCount += 1;
        this.updateStars();
        this.showIncome(slot.hitArea.x, slot.hitArea.y - 55, price);
        this.updateHud();

        this.tweens.add({
          targets: customer,
          x: 1300,
          y: 930,
          alpha: 0,
          duration: 680,
          ease: "Sine.In",
          onComplete: () => customer.destroy()
        });

        const missingCount = this.shelfSlots.filter((candidate) => !candidate.product).length;
        if (missingCount >= 3) {
          this.showTransientHint(`${missingCount} shelves are empty. Restock quickly to protect sales.`);
        }
      }
    });
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
    this.purchaseEvent?.remove(false);
    this.timerEvent?.remove(false);
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
    const summary = this.add.text(665, 555,
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
      delay: 1800,
      duration: 350
    });
  }

  private updateHud(): void {
    this.moneyText.setText(String(this.money));
    this.starText.setText(String(this.stars));

    if (this.storeOpen) {
      this.taskText.setText(`Sales ${this.soldCount} · Shelf ${this.stocked}/${this.shelfSlots.length}`);
    } else {
      this.taskText.setText(`Initial Restock ${this.stocked}/${this.shelfSlots.length}`);
    }

    if (this.shiftEnded) {
      this.hintText.setText("Shift complete");
      return;
    }

    if (this.movingCart) {
      this.hintText.setText("3. Push the cart to the sales floor");
      return;
    }

    if (this.selectedBox) {
      this.hintText.setText(`2. Tap the cart to load ${PRODUCTS[this.selectedBox.productId].label}`);
      return;
    }

    if (!this.cartAtShelf && this.loadedProducts.length >= GAME_RULES.firstMoveRequirement) {
      this.hintText.setText("3. Cart ready · tap it to move to the shelf");
      return;
    }

    if (!this.cartAtShelf) {
      this.hintText.setText(`1. Pick boxes · cart ${this.loadedProducts.length}/${GAME_RULES.firstMoveRequirement}`);
      return;
    }

    const missingSlots = this.shelfSlots.filter((slot) => !slot.product).length;
    if (!this.storeOpen) {
      this.hintText.setText(`4. Tap MISSING slots · ${missingSlots} remaining`);
      return;
    }

    if (missingSlots > 0) {
      this.hintText.setText(`Store open · refill ${missingSlots} MISSING slot(s) · cart ${this.loadedProducts.length}/6`);
      return;
    }

    this.hintText.setText("Store open · shelves full · watch for the next customer");
  }

  private setWorkerTexture(texture: string, maxWidth: number, maxHeight: number): void {
    this.worker.setTexture(texture);
    this.fitImage(this.worker, maxWidth, maxHeight);
  }

  private fitImage(image: Phaser.GameObjects.Image, maxWidth: number, maxHeight: number): void {
    const sourceWidth = Math.max(1, image.width);
    const sourceHeight = Math.max(1, image.height);
    const scale = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight);
    image.setScale(scale);
  }
}
