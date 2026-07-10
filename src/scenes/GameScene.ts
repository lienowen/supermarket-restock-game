import Phaser from "phaser";
import { AssetPaths, Assets } from "../assets";

type ProductId = "cola" | "water" | "milk";

type ProductDefinition = {
  id: ProductId;
  label: string;
  boxKey: string;
  productKey: string;
};

type BoxItem = {
  productId: ProductId;
  image: Phaser.GameObjects.Image;
  loaded: boolean;
};

type ShelfSlot = {
  index: number;
  productId: ProductId;
  hitArea: Phaser.GameObjects.Rectangle;
  missingTag: Phaser.GameObjects.Image;
  product?: Phaser.GameObjects.Image;
};

const PRODUCTS: Record<ProductId, ProductDefinition> = {
  cola: {
    id: "cola",
    label: "COLA",
    boxKey: Assets.props.boxCola,
    productKey: Assets.products.cola
  },
  water: {
    id: "water",
    label: "WATER",
    boxKey: Assets.props.boxWater,
    productKey: Assets.products.water
  },
  milk: {
    id: "milk",
    label: "MILK",
    boxKey: Assets.props.boxMilk,
    productKey: Assets.products.milk
  }
};

const INITIAL_BOX_ORDER: ProductId[] = ["cola", "water", "milk", "cola", "water", "milk"];
const SLOT_PRODUCT_ORDER: ProductId[] = ["cola", "water", "milk", "cola", "water", "milk"];

export class GameScene extends Phaser.Scene {
  private boxes: BoxItem[] = [];
  private shelfSlots: ShelfSlot[] = [];
  private selectedBox?: BoxItem;
  private loadedProducts: ProductId[] = [];

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
  private hintBubble!: Phaser.GameObjects.Image;
  private menuButton!: Phaser.GameObjects.Image;

  private money = 0;
  private stars = 0;
  private stocked = 0;
  private storeOpen = false;
  private shiftEnded = false;
  private remainingSeconds = 300;
  private customerSequence = 0;
  private pauseOverlay?: Phaser.GameObjects.Container;
  private purchaseEvent?: Phaser.Time.TimerEvent;

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
    this.createBoxes();
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
    taskButton.on("pointerdown", () => this.showTransientHint("Goal: load boxes, move the cart, then refill every MISSING slot."));

    this.add.image(860, 78, Assets.ui.star)
      .setDisplaySize(55, 55)
      .setDepth(53);
    this.starText = this.add.text(900, 55, "0", {
      fontFamily: "Arial",
      fontSize: "31px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setDepth(53);

    this.add.image(986, 78, Assets.ui.coin)
      .setDisplaySize(54, 54)
      .setDepth(53);
    this.moneyText = this.add.text(1022, 55, "0", {
      fontFamily: "Arial",
      fontSize: "31px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setDepth(53);

    this.add.image(1102, 78, Assets.ui.timer)
      .setDisplaySize(52, 52)
      .setDepth(53);
    this.timerText = this.add.text(1136, 55, "05:00", {
      fontFamily: "Arial",
      fontSize: "31px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setDepth(53);

    this.menuButton = this.add.image(1265, 78, Assets.ui.menu)
      .setDisplaySize(72, 72)
      .setDepth(54)
      .setInteractive({ useHandCursor: true });
    this.menuButton.on("pointerdown", () => this.togglePauseOverlay());

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

    this.hintBubble = this.add.image(520, 530, Assets.ui.hintBubble)
      .setDisplaySize(330, 155)
      .setAlpha(0)
      .setDepth(40);
  }

  private createWorker(): void {
    this.worker = this.add.image(470, 615, Assets.characters.workerIdle)
      .setDepth(12);
    this.fitImage(this.worker, 260, 500);
  }

  private createBoxes(): void {
    const positions = [
      { x: 95, y: 760 },
      { x: 245, y: 760 },
      { x: 395, y: 760 },
      { x: 95, y: 925 },
      { x: 245, y: 925 },
      { x: 395, y: 925 }
    ];

    INITIAL_BOX_ORDER.forEach((productId, index) => {
      const definition = PRODUCTS[productId];
      const position = positions[index];
      const image = this.add.image(position.x, position.y, definition.boxKey)
        .setDisplaySize(128, 128)
        .setDepth(15)
        .setInteractive({ useHandCursor: true });

      const item: BoxItem = {
        productId,
        image,
        loaded: false
      };

      image.on("pointerdown", () => this.selectBox(item));
      this.boxes.push(item);
    });
  }

  private createCart(): void {
    this.cartSprite = this.add.image(0, 0, Assets.props.cart)
      .setDisplaySize(270, 255);

    this.cartCountText = this.add.text(104, -92, "0/6", {
      fontFamily: "Arial",
      fontSize: "22px",
      color: "#ffffff",
      fontStyle: "bold",
      backgroundColor: "#182020",
      padding: { x: 8, y: 4 }
    }).setOrigin(0.5);

    this.cart = this.add.container(475, 830, [this.cartSprite, this.cartCountText])
      .setSize(285, 265)
      .setDepth(20)
      .setInteractive({ useHandCursor: true });

    this.cart.on("pointerdown", () => this.handleCartTap());
  }

  private createShelfSlots(): void {
    const positions = [
      { x: 875, y: 365 },
      { x: 1020, y: 365 },
      { x: 1165, y: 365 },
      { x: 875, y: 570 },
      { x: 1020, y: 570 },
      { x: 1165, y: 570 }
    ];

    positions.forEach((position, index) => {
      const hitArea = this.add.rectangle(position.x, position.y, 112, 150, 0x173038, 0.08)
        .setStrokeStyle(2, 0xe9eeee, 0.45)
        .setDepth(7)
        .setInteractive({ useHandCursor: true });

      const missingTag = this.add.image(position.x, position.y + 50, Assets.ui.missingTag)
        .setDisplaySize(102, 38)
        .setDepth(9);

      const slot: ShelfSlot = {
        index,
        productId: SLOT_PRODUCT_ORDER[index],
        hitArea,
        missingTag
      };

      hitArea.on("pointerdown", () => this.tryRestockSlot(slot));
      this.shelfSlots.push(slot);
    });
  }

  private selectBox(item: BoxItem): void {
    if (item.loaded || this.movingCart || this.shiftEnded) return;

    if (this.selectedBox && this.selectedBox !== item) {
      this.selectedBox.image.setScale(1);
      this.selectedBox.image.clearTint();
    }

    this.selectedBox = item;
    item.image.setScale(1.12).setTint(0xffffcc);
    this.setWorkerState("carry");
    this.updateHud();
  }

  private handleCartTap(): void {
    if (this.movingCart || this.shiftEnded) return;

    if (this.selectedBox) {
      const item = this.selectedBox;
      this.selectedBox = undefined;
      item.image.disableInteractive().clearTint();

      this.tweens.add({
        targets: item.image,
        x: this.cart.x,
        y: this.cart.y - 25,
        scaleX: 0.38,
        scaleY: 0.38,
        duration: 380,
        ease: "Cubic.Out",
        onComplete: () => {
          item.loaded = true;
          item.image.setVisible(false);
          this.loadedProducts.push(item.productId);
          this.updateCartCount();
          this.setWorkerState("idle");
          this.updateHud();
        }
      });
      return;
    }

    if (!this.cartAtShelf && this.loadedProducts.length >= 6) {
      this.moveCartToShelf();
    }
  }

  private moveCartToShelf(): void {
    this.movingCart = true;
    this.cart.setVisible(false);

    this.worker.setTexture(Assets.characters.workerPush)
      .setPosition(500, 690)
      .setVisible(true);
    this.fitImage(this.worker, 400, 560);
    this.worker.setDepth(24);

    this.updateHud();

    this.tweens.add({
      targets: this.worker,
      x: 760,
      y: 735,
      duration: 1050,
      ease: "Sine.InOut",
      onComplete: () => {
        this.movingCart = false;
        this.cartAtShelf = true;
        this.cart.setPosition(755, 850).setVisible(true);
        this.worker.setTexture(Assets.characters.workerIdle)
          .setPosition(700, 650)
          .setDepth(12);
        this.fitImage(this.worker, 230, 440);
        this.updateHud();
      }
    });
  }

  private tryRestockSlot(slot: ShelfSlot): void {
    if (!this.cartAtShelf || slot.product || this.movingCart || this.shiftEnded) return;

    const productIndex = this.loadedProducts.indexOf(slot.productId);
    if (productIndex < 0) {
      this.showTransientHint(`Load a ${PRODUCTS[slot.productId].label} box first.`);
      return;
    }

    this.loadedProducts.splice(productIndex, 1);
    this.updateCartCount();

    const definition = PRODUCTS[slot.productId];
    const token = this.add.image(this.cart.x, this.cart.y - 45, definition.productKey)
      .setDepth(30);
    this.fitImage(token, 62, 112);

    this.tweens.add({
      targets: token,
      x: slot.hitArea.x,
      y: slot.hitArea.y,
      duration: 430,
      ease: "Cubic.Out",
      onComplete: () => {
        slot.product = token;
        slot.missingTag.setVisible(false);
        slot.hitArea.setStrokeStyle(2, 0x7dc982, 0.55);
        this.stocked = this.shelfSlots.filter((s) => Boolean(s.product)).length;
        this.updateHud();

        if (this.stocked >= this.shelfSlots.length && !this.storeOpen) {
          this.openStore();
        }
      }
    });
  }

  private openStore(): void {
    this.storeOpen = true;
    this.stars = Math.max(this.stars, 1);
    this.resetSupplyBoxes();
    this.updateHud();
    this.showTransientHint("Store open! Customers are buying. Keep refilling new MISSING slots.");

    this.purchaseEvent = this.time.addEvent({
      delay: 2200,
      loop: true,
      callback: () => this.customerPurchase()
    });
  }

  private customerPurchase(): void {
    if (this.shiftEnded) return;

    const available = this.shelfSlots.filter((slot) => Boolean(slot.product));
    if (available.length === 0) return;

    const slot = Phaser.Utils.Array.GetRandom(available);
    const useFirstCustomer = this.customerSequence % 2 === 0;
    this.customerSequence += 1;

    const idleKey = useFirstCustomer
      ? Assets.characters.customer01Idle
      : Assets.characters.customer02Idle;
    const basketKey = useFirstCustomer
      ? Assets.characters.customer01Basket
      : Assets.characters.customer02Basket;

    const customer = this.add.image(1285, 905, idleKey)
      .setDepth(26);
    this.fitImage(customer, 145, 270);

    this.tweens.add({
      targets: customer,
      x: slot.hitArea.x + 45,
      y: 790,
      duration: 780,
      ease: "Sine.InOut",
      onComplete: () => {
        slot.product?.destroy();
        slot.product = undefined;
        slot.missingTag.setVisible(true);
        slot.hitArea.setStrokeStyle(2, 0xe9eeee, 0.45);
        this.stocked = this.shelfSlots.filter((s) => Boolean(s.product)).length;

        customer.setTexture(basketKey);
        this.fitImage(customer, 160, 285);

        this.money += 10;
        if (this.money >= 50) this.stars = Math.max(this.stars, 2);
        if (this.money >= 100) this.stars = Math.max(this.stars, 3);
        this.spawnIncomeText(slot.hitArea.x, slot.hitArea.y - 55, 10);
        this.updateHud();

        this.tweens.add({
          targets: customer,
          x: 1370,
          y: 930,
          alpha: 0,
          duration: 720,
          delay: 180,
          onComplete: () => customer.destroy()
        });
      }
    });
  }

  private spawnIncomeText(x: number, y: number, amount: number): void {
    const income = this.add.text(x, y, `+$${amount}`, {
      fontFamily: "Arial",
      fontSize: "28px",
      color: "#ffe36a",
      fontStyle: "bold",
      stroke: "#5b3d00",
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(45);

    this.tweens.add({
      targets: income,
      y: y - 85,
      alpha: 0,
      duration: 850,
      onComplete: () => income.destroy()
    });
  }

  private resetSupplyBoxes(): void {
    this.boxes.forEach((item) => {
      item.loaded = false;
      item.image.setVisible(true)
        .setScale(1)
        .clearTint()
        .setInteractive({ useHandCursor: true });
    });
  }

  private setWorkerState(state: "idle" | "carry"): void {
    const key = state === "carry"
      ? Assets.characters.workerCarry
      : Assets.characters.workerIdle;

    this.worker.setTexture(key)
      .setVisible(true)
      .setPosition(this.cartAtShelf ? 700 : 470, this.cartAtShelf ? 650 : 615)
      .setDepth(12);

    this.fitImage(this.worker, state === "carry" ? 290 : 260, state === "carry" ? 500 : 500);
  }

  private updateCartCount(): void {
    this.cartCountText.setText(`${this.loadedProducts.length}/6`);
  }

  private updateHud(): void {
    this.stocked = this.shelfSlots.filter((slot) => Boolean(slot.product)).length;
    this.taskText.setText(`Task Progress: ${this.stocked}/6`);
    this.moneyText.setText(String(this.money));
    this.starText.setText(String(this.stars));

    if (this.shiftEnded) {
      this.hintText.setText(`Shift complete · earnings $${this.money} · stars ${this.stars}/3`);
      return;
    }

    if (this.storeOpen) {
      this.hintText.setText("Store open · customers are buying · refill new MISSING slots");
      return;
    }

    if (this.movingCart) {
      this.hintText.setText("3. Push the cart to the shelf");
      return;
    }

    if (this.cartAtShelf) {
      this.hintText.setText("4. Tap a MISSING slot to restock the matching product");
      return;
    }

    if (this.selectedBox) {
      this.hintText.setText("2. Tap the cart to load the selected box");
      return;
    }

    if (this.loadedProducts.length >= 6) {
      this.hintText.setText("3. Cart ready · tap the cart to move to the sales floor");
      return;
    }

    this.hintText.setText("1. Tap a drink box to pick it up");
  }

  private showTransientHint(message: string): void {
    this.hintBubble.setAlpha(1).setScale(1);

    const text = this.add.text(this.hintBubble.x, this.hintBubble.y - 5, message, {
      fontFamily: "Arial",
      fontSize: "20px",
      color: "#172020",
      fontStyle: "bold",
      align: "center",
      wordWrap: { width: 270 }
    }).setOrigin(0.5).setDepth(41);

    this.tweens.add({
      targets: [this.hintBubble, text],
      alpha: 0,
      duration: 300,
      delay: 1900,
      onComplete: () => text.destroy()
    });
  }

  private startShiftTimer(): void {
    this.updateTimerText();
    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (this.shiftEnded || this.pauseOverlay?.visible) return;
        this.remainingSeconds = Math.max(0, this.remainingSeconds - 1);
        this.updateTimerText();
        if (this.remainingSeconds === 0) {
          this.endShift();
        }
      }
    });
  }

  private updateTimerText(): void {
    const minutes = Math.floor(this.remainingSeconds / 60);
    const seconds = this.remainingSeconds % 60;
    this.timerText.setText(`${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`);
  }

  private endShift(): void {
    if (this.shiftEnded) return;
    this.shiftEnded = true;
    this.purchaseEvent?.remove(false);
    this.stars = Math.max(this.stars, this.money >= 100 ? 3 : this.money >= 50 ? 2 : this.storeOpen ? 1 : 0);
    this.updateHud();
    this.showTransientHint(`Morning shift complete! Final earnings: $${this.money}`);
  }

  private togglePauseOverlay(): void {
    if (!this.pauseOverlay) {
      const shade = this.add.rectangle(665, 669, 1330, 1026, 0x081010, 0.72);
      const panel = this.add.rectangle(665, 625, 430, 250, 0x1b2424, 0.98)
        .setStrokeStyle(3, 0x596969);
      const title = this.add.text(665, 575, "PAUSED", {
        fontFamily: "Arial",
        fontSize: "42px",
        color: "#ffffff",
        fontStyle: "bold"
      }).setOrigin(0.5);
      const subtitle = this.add.text(665, 650, "Tap the menu button again to continue", {
        fontFamily: "Arial",
        fontSize: "21px",
        color: "#d7e0e0"
      }).setOrigin(0.5);

      this.pauseOverlay = this.add.container(0, 0, [shade, panel, title, subtitle])
        .setDepth(80)
        .setVisible(true);
      return;
    }

    this.pauseOverlay.setVisible(!this.pauseOverlay.visible);
  }

  private fitImage(image: Phaser.GameObjects.Image, maxWidth: number, maxHeight: number): void {
    const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
    image.setScale(scale);
  }
}
