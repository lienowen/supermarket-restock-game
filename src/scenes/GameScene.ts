import Phaser from "phaser";

type BoxItem = {
  productId: "cola" | "water" | "milk";
  color: number;
  label: string;
  node: Phaser.GameObjects.Container;
  loaded: boolean;
};

type ShelfSlot = {
  index: number;
  occupied: boolean;
  frame: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  product?: Phaser.GameObjects.Container;
};

export class GameScene extends Phaser.Scene {
  private boxes: BoxItem[] = [];
  private shelfSlots: ShelfSlot[] = [];
  private selectedBox?: BoxItem;

  private cart!: Phaser.GameObjects.Container;
  private cartCountText!: Phaser.GameObjects.Text;
  private cartLoaded = 0;
  private cartAtShelf = false;
  private movingCart = false;

  private taskText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private moneyText!: Phaser.GameObjects.Text;
  private money = 0;
  private stocked = 0;
  private storeOpen = false;

  constructor() {
    super("game");
  }

  create(): void {
    this.drawStaticScene();
    this.createBoxes();
    this.createCart();
    this.createShelf();
    this.updateHud();

    this.scale.on("resize", () => {
      // Phaser FIT mode handles presentation scaling; logical coordinates stay fixed.
    });
  }

  private drawStaticScene(): void {
    // Top HUD
    this.add.rectangle(665, 78, 1330, 156, 0x182020);
    this.add.rectangle(275, 78, 550, 132, 0x111818).setStrokeStyle(2, 0x243333);
    this.add.text(182, 28, "☀ Morning Shift", {
      fontFamily: "Arial",
      fontSize: "28px",
      color: "#ffffff",
      fontStyle: "bold"
    });
    this.add.text(182, 64, "Restock Drinks", {
      fontFamily: "Arial",
      fontSize: "34px",
      color: "#ffffff",
      fontStyle: "bold"
    });

    this.taskText = this.add.text(182, 111, "", {
      fontFamily: "Arial",
      fontSize: "22px",
      color: "#e8f1f1"
    });

    this.add.rectangle(655, 78, 104, 124, 0x313433).setStrokeStyle(3, 0x4b4c49);
    this.add.text(625, 32, "📋", { fontSize: "40px" });
    this.add.text(624, 101, "Tasks", {
      fontFamily: "Arial",
      fontSize: "21px",
      color: "#ffffff",
      fontStyle: "bold"
    });

    this.moneyText = this.add.text(970, 62, "⭐ 0", {
      fontFamily: "Arial",
      fontSize: "31px",
      color: "#ffffff",
      fontStyle: "bold"
    });
    this.add.text(1065, 62, "⏱ 05:00", {
      fontFamily: "Arial",
      fontSize: "31px",
      color: "#ffffff",
      fontStyle: "bold"
    });

    // Static stage
    this.add.rectangle(338, 669, 676, 1026, 0x555652);
    this.add.rectangle(1003, 669, 654, 1026, 0xd5c8b6);
    this.add.rectangle(678, 669, 7, 1026, 0x151a1a);

    this.add.rectangle(95, 193, 170, 45, 0x254e2e);
    this.add.text(31, 179, "BACKROOM", {
      fontFamily: "Arial",
      fontSize: "26px",
      color: "#ffffff",
      fontStyle: "bold"
    });

    this.add.rectangle(794, 193, 180, 45, 0x3d6386);
    this.add.text(716, 179, "SALES FLOOR", {
      fontFamily: "Arial",
      fontSize: "26px",
      color: "#ffffff",
      fontStyle: "bold"
    });

    // Backroom static decoration
    this.add.rectangle(105, 420, 160, 410, 0x314e37).setStrokeStyle(5, 0x1f2b21);
    this.add.text(54, 260, "EXIT", {
      fontSize: "27px",
      color: "#d9ffe0",
      backgroundColor: "#4c9b5b",
      padding: { x: 9, y: 5 }
    });

    for (let i = 0; i < 4; i++) {
      this.add.rectangle(545, 280 + i * 125, 190, 14, 0xc86513);
      this.add.rectangle(485, 280 + i * 125, 10, 120, 0x174d87);
      this.add.rectangle(605, 280 + i * 125, 10, 120, 0x174d87);
      if (i < 3) {
        this.add.rectangle(546, 240 + i * 125, 130, 75, 0xa67a42);
      }
    }

    // Sales-floor fridge/shelf frame
    this.add.rectangle(1004, 500, 535, 650, 0x202a31).setStrokeStyle(8, 0x111719);
    this.add.rectangle(1004, 224, 535, 78, 0x2581be);
    this.add.text(890, 198, "COLD DRINKS", {
      fontFamily: "Arial",
      fontSize: "38px",
      color: "#ffffff",
      fontStyle: "bold"
    });
    [367, 522, 677].forEach((y) => {
      this.add.rectangle(1004, y, 505, 12, 0xb7c1c4);
    });

    // Bottom guidance strip
    this.hintText = this.add.text(665, 1117, "", {
      fontFamily: "Arial",
      fontSize: "28px",
      color: "#152020",
      fontStyle: "bold",
      backgroundColor: "#f4e8c8",
      padding: { x: 22, y: 14 },
      align: "center"
    }).setOrigin(0.5);
  }

  private createBoxes(): void {
    const products: Array<Omit<BoxItem, "node" | "loaded">> = [
      { productId: "cola", color: 0xa23a28, label: "COLA" },
      { productId: "water", color: 0x3e78aa, label: "WATER" },
      { productId: "milk", color: 0xd9e2e7, label: "MILK" },
      { productId: "cola", color: 0xa23a28, label: "COLA" },
      { productId: "water", color: 0x3e78aa, label: "WATER" },
      { productId: "milk", color: 0xd9e2e7, label: "MILK" }
    ];

    products.forEach((p, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = 95 + col * 145;
      const y = 760 + row * 155;

      const body = this.add.rectangle(0, 0, 118, 118, 0xb78b52)
        .setStrokeStyle(4, 0x6f5435);
      const band = this.add.rectangle(0, 25, 94, 46, p.color);
      const label = this.add.text(0, 25, p.label, {
        fontFamily: "Arial",
        fontSize: "19px",
        color: p.productId === "milk" ? "#2c4b62" : "#ffffff",
        fontStyle: "bold"
      }).setOrigin(0.5);

      const node = this.add.container(x, y, [body, band, label])
        .setSize(118, 118)
        .setInteractive({ useHandCursor: true });

      const item: BoxItem = { ...p, node, loaded: false };
      node.on("pointerdown", () => this.selectBox(item));
      this.boxes.push(item);
    });
  }

  private createCart(): void {
    const tub = this.add.rectangle(0, 0, 245, 145, 0x6c7777)
      .setStrokeStyle(7, 0x283333);
    const panel = this.add.rectangle(0, 15, 132, 67, 0x466b1f);
    const label = this.add.text(0, 15, "REPLENISH\nCART", {
      fontFamily: "Arial",
      fontSize: "20px",
      color: "#ffffff",
      align: "center",
      fontStyle: "bold"
    }).setOrigin(0.5);
    const handle = this.add.rectangle(-92, -95, 92, 10, 0x1f2828);
    const wheelL = this.add.circle(-78, 88, 20, 0x222727);
    const wheelR = this.add.circle(78, 88, 20, 0x222727);

    this.cartCountText = this.add.text(92, -55, "0/6", {
      fontFamily: "Arial",
      fontSize: "22px",
      color: "#ffffff",
      fontStyle: "bold",
      backgroundColor: "#172020",
      padding: { x: 7, y: 3 }
    }).setOrigin(0.5);

    this.cart = this.add.container(450, 800, [
      tub, panel, label, handle, wheelL, wheelR, this.cartCountText
    ]).setSize(260, 220).setInteractive({ useHandCursor: true });

    this.cart.on("pointerdown", () => this.handleCartTap());
  }

  private createShelf(): void {
    const positions = [
      [855, 330], [1005, 330], [1155, 330],
      [855, 485], [1005, 485], [1155, 485]
    ] as const;

    positions.forEach(([x, y], index) => {
      const frame = this.add.rectangle(x, y, 116, 118, 0x2d353a, 0.82)
        .setStrokeStyle(4, 0xe9ecec, 0.75)
        .setInteractive({ useHandCursor: true });
      const label = this.add.text(x, y + 39, "MISSING", {
        fontFamily: "Arial",
        fontSize: "17px",
        color: "#ff665c",
        fontStyle: "bold",
        backgroundColor: "#7b271f",
        padding: { x: 6, y: 3 }
      }).setOrigin(0.5);

      const slot: ShelfSlot = { index, occupied: false, frame, label };
      frame.on("pointerdown", () => this.tryRestockSlot(slot));
      this.shelfSlots.push(slot);
    });
  }

  private selectBox(item: BoxItem): void {
    if (item.loaded || this.cartAtShelf || this.movingCart || this.storeOpen) return;

    if (this.selectedBox && this.selectedBox !== item) {
      this.selectedBox.node.setScale(1);
    }

    this.selectedBox = item;
    item.node.setScale(1.12);
    this.updateHud();
  }

  private handleCartTap(): void {
    if (this.movingCart) return;

    if (this.selectedBox && !this.cartAtShelf) {
      const item = this.selectedBox;
      this.selectedBox = undefined;
      item.node.disableInteractive();

      this.tweens.add({
        targets: item.node,
        x: this.cart.x,
        y: this.cart.y - 30,
        scaleX: 0.45,
        scaleY: 0.45,
        duration: 360,
        ease: "Cubic.Out",
        onComplete: () => {
          item.loaded = true;
          item.node.setVisible(false);
          this.cartLoaded += 1;
          this.cartCountText.setText(`${this.cartLoaded}/6`);
          this.updateHud();
        }
      });
      return;
    }

    if (!this.cartAtShelf && this.cartLoaded >= 6) {
      this.movingCart = true;
      this.updateHud();

      this.tweens.add({
        targets: this.cart,
        x: 730,
        y: 760,
        duration: 900,
        ease: "Sine.InOut",
        onComplete: () => {
          this.movingCart = false;
          this.cartAtShelf = true;
          this.updateHud();
        }
      });
    }
  }

  private tryRestockSlot(slot: ShelfSlot): void {
    if (!this.cartAtShelf || slot.occupied || this.cartLoaded <= 0 || this.movingCart) return;

    this.cartLoaded -= 1;
    this.cartCountText.setText(`${this.cartLoaded}/6`);

    const token = this.createBottle(this.cart.x, this.cart.y - 20, 0x3f9f4b, "DRINK");
    this.tweens.add({
      targets: token,
      x: slot.frame.x,
      y: slot.frame.y,
      scaleX: 0.85,
      scaleY: 0.85,
      duration: 420,
      ease: "Cubic.Out",
      onComplete: () => {
        slot.occupied = true;
        slot.product = token;
        slot.label.setVisible(false);
        slot.frame.setStrokeStyle(3, 0x7cc37f, 0.6);
        this.stocked += 1;
        this.updateHud();

        if (this.stocked >= this.shelfSlots.length && !this.storeOpen) {
          this.openStore();
        }
      }
    });
  }

  private createBottle(
    x: number,
    y: number,
    color: number,
    label: string
  ): Phaser.GameObjects.Container {
    const body = this.add.rectangle(0, 5, 42, 76, color)
      .setStrokeStyle(3, 0x1f2a2a);
    const cap = this.add.rectangle(0, -40, 18, 12, 0x253434);
    const text = this.add.text(0, 6, label, {
      fontFamily: "Arial",
      fontSize: "9px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setOrigin(0.5);

    return this.add.container(x, y, [body, cap, text]);
  }

  private openStore(): void {
    this.storeOpen = true;
    this.updateHud();

    this.time.addEvent({
      delay: 1500,
      loop: true,
      callback: () => this.customerPurchase()
    });
  }

  private customerPurchase(): void {
    const available = this.shelfSlots.filter((s) => s.occupied && s.product);
    if (available.length === 0) return;

    const slot = Phaser.Utils.Array.GetRandom(available);
    const customer = this.add.circle(1260, 785, 29, 0xe1a75e)
      .setStrokeStyle(4, 0x59412c);

    this.tweens.add({
      targets: customer,
      x: slot.frame.x + 40,
      y: 700,
      duration: 700,
      ease: "Sine.InOut",
      onComplete: () => {
        slot.occupied = false;
        slot.product?.destroy();
        slot.product = undefined;
        slot.label.setVisible(true);
        slot.frame.setStrokeStyle(4, 0xe9ecec, 0.75);
        this.stocked = Math.max(0, this.stocked - 1);

        this.money += 10;
        this.moneyText.setText(`⭐ ${this.money}`);

        const income = this.add.text(slot.frame.x, slot.frame.y - 45, "+$10", {
          fontFamily: "Arial",
          fontSize: "26px",
          color: "#ffe36a",
          fontStyle: "bold"
        }).setOrigin(0.5);

        this.tweens.add({
          targets: income,
          y: income.y - 80,
          alpha: 0,
          duration: 800,
          onComplete: () => income.destroy()
        });

        this.tweens.add({
          targets: customer,
          x: 1280,
          y: 900,
          alpha: 0,
          duration: 650,
          onComplete: () => customer.destroy()
        });

        this.updateHud();
      }
    });
  }

  private updateHud(): void {
    this.taskText.setText(`Task Progress: ${this.stocked}/6`);

    if (this.storeOpen) {
      this.hintText.setText("Store open · customers are buying · refill new MISSING slots");
      return;
    }

    if (this.movingCart) {
      this.hintText.setText("3. Push the cart to the shelf");
      return;
    }

    if (this.cartAtShelf) {
      this.hintText.setText("4. Tap a MISSING slot to restock");
      return;
    }

    if (this.selectedBox) {
      this.hintText.setText("2. Put the selected box on the cart");
      return;
    }

    if (this.cartLoaded >= 6) {
      this.hintText.setText("3. Cart ready · tap the cart to move");
      return;
    }

    this.hintText.setText("1. Tap a box to pick it up");
  }
}
