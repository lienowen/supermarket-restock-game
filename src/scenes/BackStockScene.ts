import Phaser from "phaser";
import { PRODUCTS, type ProductId } from "../gameConfig";
import type { ShiftPhase } from "../domain/gameTypes";
import { gameSession } from "../systems/GameSession";

type RuntimeSlot = {
  productId: ProductId;
  hitArea: Phaser.GameObjects.Rectangle;
  missingTag: Phaser.GameObjects.Image;
  productBottomY: number;
  product?: Phaser.GameObjects.Image;
  reservedForCustomer: boolean;
};

type RuntimeGameScene = Phaser.Scene & {
  shelfSlots: RuntimeSlot[];
  phase: ShiftPhase;
  shiftEnded: boolean;
  stocked: number;
  restockBusy: boolean;
  updateHud: () => void;
  updateStars: () => void;
  showTransientHint: (message: string) => void;
};

type StockButton = {
  productId: ProductId;
  bg: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  count: Phaser.GameObjects.Text;
};

const INITIAL_BACK_STOCK: Record<ProductId, number> = {
  cola: 2,
  water: 2,
  milk: 2
};

export class BackStockScene extends Phaser.Scene {
  private gameScene?: RuntimeGameScene;
  private attached = false;
  private inventory: Record<ProductId, number> = { ...INITIAL_BACK_STOCK };
  private buttons = new Map<ProductId, StockButton>();
  private panel?: Phaser.GameObjects.Container;
  private attachEvent?: Phaser.Time.TimerEvent;
  private lastPhase?: ShiftPhase;

  constructor() {
    super({ key: "back-stock", active: true });
  }

  create(): void {
    this.attachEvent = this.time.addEvent({
      delay: 120,
      loop: true,
      callback: () => this.tryAttach()
    });
  }

  update(): void {
    if (!this.attached || !this.gameScene?.scene.isActive()) return;

    const phase = this.gameScene.phase;
    if (phase !== this.lastPhase) {
      this.lastPhase = phase;
      this.updateVisibility();
    }

    this.refreshButtons();
  }

  private tryAttach(): void {
    if (this.attached || gameSession.day !== "day02") return;

    const scene = this.scene.get("game") as RuntimeGameScene;
    if (!scene?.scene?.isActive() || !scene.shelfSlots?.length) return;

    this.gameScene = scene;
    this.attached = true;
    this.inventory = { ...INITIAL_BACK_STOCK };

    // Day 2 should not repeat Day 1's full six-slot setup. Keep one of each drink
    // from the previous shift so the player can open after a single three-case trip.
    this.seedOpeningShelfStock(scene);
    this.createPanel();
    this.updateVisibility();

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.detach());
    this.scene.bringToTop();
  }

  private detach(): void {
    this.panel?.destroy(true);
    this.panel = undefined;
    this.buttons.clear();
    this.gameScene = undefined;
    this.attached = false;
    this.lastPhase = undefined;
  }

  private seedOpeningShelfStock(scene: RuntimeGameScene): void {
    if (scene.phase !== "PREPARE" || scene.stocked > 0) return;

    const seeded = new Set<ProductId>();
    for (const slot of scene.shelfSlots) {
      if (seeded.has(slot.productId) || slot.product) continue;

      const definition = PRODUCTS[slot.productId];
      const product = scene.add.image(slot.hitArea.x, slot.productBottomY, definition.productKey)
        .setOrigin(0.5, 1)
        .setDepth(22);
      this.fitImage(product, definition.shelfWidth, definition.shelfHeight);

      slot.product = product;
      slot.missingTag.setVisible(false);
      seeded.add(slot.productId);
      scene.stocked += 1;

      if (seeded.size >= 3) break;
    }

    scene.updateStars();
    scene.updateHud();
    scene.showTransientHint("Day 2 starts with 3 shelf items. Load one COLA, WATER and MILK case to open.");
  }

  private createPanel(): void {
    this.panel?.destroy(true);
    this.buttons.clear();

    const bg = this.add.rectangle(1045, 985, 440, 118, 0x132724, 0.96)
      .setStrokeStyle(3, 0x7fc08b, 0.9);
    const title = this.add.text(845, 945, "BACK STOCK", {
      fontFamily: "Arial",
      fontSize: "20px",
      color: "#dff6df",
      fontStyle: "bold"
    });
    const subtitle = this.add.text(845, 974, "Quick refill · use before warehouse trips", {
      fontFamily: "Arial",
      fontSize: "14px",
      color: "#bcd0c8"
    });

    const children: Phaser.GameObjects.GameObject[] = [bg, title, subtitle];
    const products: ProductId[] = ["cola", "water", "milk"];

    products.forEach((productId, index) => {
      const x = 900 + index * 135;
      const buttonBg = this.add.rectangle(x, 1022, 118, 42, 0x27423c, 1)
        .setStrokeStyle(2, 0x719b86)
        .setInteractive({ useHandCursor: true });
      const label = this.add.text(x - 48, 1011, PRODUCTS[productId].label, {
        fontFamily: "Arial",
        fontSize: "15px",
        color: "#ffffff",
        fontStyle: "bold"
      });
      const count = this.add.text(x + 43, 1011, "x2", {
        fontFamily: "Arial",
        fontSize: "15px",
        color: "#ffd75a",
        fontStyle: "bold"
      }).setOrigin(1, 0);

      buttonBg.on("pointerdown", () => this.quickRestock(productId));
      this.buttons.set(productId, { productId, bg: buttonBg, label, count });
      children.push(buttonBg, label, count);
    });

    this.panel = this.add.container(0, 0, children).setDepth(470);
  }

  private updateVisibility(): void {
    const scene = this.gameScene;
    if (!scene || !this.panel) return;

    const visible = !scene.shiftEnded && (scene.phase === "OPEN" || scene.phase === "RUSH");
    this.panel.setVisible(visible);
  }

  private refreshButtons(): void {
    const scene = this.gameScene;
    if (!scene || !this.panel?.visible) return;

    for (const button of this.buttons.values()) {
      const missing = scene.shelfSlots.some(
        (slot) => slot.productId === button.productId && !slot.product && !slot.reservedForCustomer
      );
      const amount = this.inventory[button.productId];

      button.count.setText(`x${amount}`);
      button.bg.setFillStyle(
        amount <= 0 ? 0x353b39 : missing ? 0x386b4a : 0x27423c,
        1
      );
      button.bg.setStrokeStyle(2, missing && amount > 0 ? 0xffd75a : 0x719b86, missing ? 1 : 0.8);
      button.label.setAlpha(amount > 0 ? 1 : 0.45);
      button.count.setAlpha(amount > 0 ? 1 : 0.4);
    }
  }

  private quickRestock(productId: ProductId): void {
    const scene = this.gameScene;
    if (!scene || gameSession.isPaused || scene.shiftEnded || scene.restockBusy) return;

    if (this.inventory[productId] <= 0) {
      this.showFloatingText(1045, 925, `${PRODUCTS[productId].label} BACK STOCK EMPTY`, 0xff8179);
      return;
    }

    const slot = scene.shelfSlots.find(
      (candidate) => candidate.productId === productId && !candidate.product && !candidate.reservedForCustomer
    );

    if (!slot) {
      this.showFloatingText(1045, 925, `NO ${PRODUCTS[productId].label} GAP`, 0xb8d1c6);
      return;
    }

    this.inventory[productId] -= 1;
    scene.restockBusy = true;
    this.refreshButtons();

    const definition = PRODUCTS[productId];
    const product = scene.add.image(1040, 980, definition.productKey)
      .setOrigin(0.5, 1)
      .setDepth(31)
      .setAlpha(0.9);
    this.fitImage(product, definition.shelfWidth, definition.shelfHeight);

    scene.tweens.add({
      targets: product,
      x: slot.hitArea.x,
      y: slot.productBottomY,
      alpha: 1,
      duration: 280,
      ease: "Cubic.Out",
      onComplete: () => {
        slot.product = product;
        slot.missingTag.setVisible(false);
        scene.stocked += 1;
        scene.restockBusy = false;
        scene.updateStars();
        scene.updateHud();
        this.showFloatingText(slot.hitArea.x, slot.hitArea.y - 72, "BACK STOCK +1", 0x8ff08a);
      }
    });
  }

  private showFloatingText(x: number, y: number, message: string, color: number): void {
    const text = this.add.text(x, y, message, {
      fontFamily: "Arial",
      fontSize: "21px",
      color: `#${color.toString(16).padStart(6, "0")}`,
      fontStyle: "bold",
      stroke: "#172020",
      strokeThickness: 5
    }).setOrigin(0.5).setDepth(520);

    this.tweens.add({
      targets: text,
      y: y - 46,
      alpha: 0,
      duration: 720,
      ease: "Cubic.Out",
      onComplete: () => text.destroy()
    });
  }

  private fitImage(image: Phaser.GameObjects.Image, maxWidth: number, maxHeight: number): void {
    const sourceWidth = Math.max(1, image.width);
    const sourceHeight = Math.max(1, image.height);
    image.setScale(Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight));
  }
}
