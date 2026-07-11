import Phaser from "phaser";
import { AssetPaths, Assets } from "../assets";
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
  card: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Rectangle;
  countBadge: Phaser.GameObjects.Rectangle;
  count: Phaser.GameObjects.Text;
};

const INITIAL_BACK_STOCK: Record<ProductId, number> = {
  cola: 2,
  water: 2,
  milk: 2
};

const STOCK_CARD_KEYS: Record<ProductId, string> = {
  cola: Assets.day02.backStockCola,
  water: Assets.day02.backStockWater,
  milk: Assets.day02.backStockMilk
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

  preload(): void {
    this.loadIfMissing(Assets.day02.backStockRack);
    this.loadIfMissing(Assets.day02.backStockCola);
    this.loadIfMissing(Assets.day02.backStockWater);
    this.loadIfMissing(Assets.day02.backStockMilk);
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

    // Day 2 starts with one of each drink still on the shelf, so opening needs only
    // one three-case trip instead of repeating the complete Day 1 setup.
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
    scene.showTransientHint("Day 2 starts at Shelf 3/6. Bring one COLA, WATER and MILK case to open.");
  }

  private createPanel(): void {
    this.panel?.destroy(true);
    this.buttons.clear();

    const rack = this.add.image(1070, 925, Assets.day02.backStockRack)
      .setDisplaySize(510, 330);
    const subtitle = this.add.text(1070, 794, "QUICK REFILL · USE BEFORE A WAREHOUSE TRIP", {
      fontFamily: "Arial",
      fontSize: "14px",
      color: "#dbe9e4",
      fontStyle: "bold",
      backgroundColor: "#132724",
      padding: { x: 12, y: 6 }
    }).setOrigin(0.5);

    const children: Phaser.GameObjects.GameObject[] = [rack, subtitle];
    const products: ProductId[] = ["cola", "water", "milk"];

    products.forEach((productId, index) => {
      const x = 900 + index * 170;
      const y = 985;
      const glow = this.add.rectangle(x, y, 130, 130, 0xffd75a, 0.14)
        .setStrokeStyle(4, 0xffd75a, 1)
        .setVisible(false);
      const card = this.add.image(x, y, STOCK_CARD_KEYS[productId])
        .setDisplaySize(118, 118)
        .setInteractive({ useHandCursor: true });
      const countBadge = this.add.rectangle(x + 43, y - 43, 48, 32, 0x10201d, 0.96)
        .setStrokeStyle(2, 0xffd75a, 0.95);
      const count = this.add.text(x + 43, y - 44, "x2", {
        fontFamily: "Arial",
        fontSize: "17px",
        color: "#ffd75a",
        fontStyle: "bold"
      }).setOrigin(0.5);

      card.on("pointerdown", () => this.quickRestock(productId));
      this.buttons.set(productId, { productId, card, glow, countBadge, count });
      children.push(glow, card, countBadge, count);
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
      const ready = amount > 0 && missing;

      button.count.setText(`x${amount}`);
      button.glow.setVisible(ready);
      button.card.setAlpha(amount > 0 ? 1 : 0.35);
      button.countBadge.setAlpha(amount > 0 ? 1 : 0.45);
      button.count.setAlpha(amount > 0 ? 1 : 0.45);

      if (ready) {
        button.card.setTint(0xffffff);
      } else if (amount <= 0) {
        button.card.setTint(0x8b9490);
      } else {
        button.card.clearTint();
      }
    }
  }

  private quickRestock(productId: ProductId): void {
    const scene = this.gameScene;
    if (!scene || gameSession.isPaused || scene.shiftEnded || scene.restockBusy) return;

    const button = this.buttons.get(productId);
    if (!button) return;

    if (this.inventory[productId] <= 0) {
      this.showFloatingText(button.card.x, button.card.y - 92, `${PRODUCTS[productId].label} EMPTY`, 0xff8179);
      return;
    }

    const slot = scene.shelfSlots.find(
      (candidate) => candidate.productId === productId && !candidate.product && !candidate.reservedForCustomer
    );

    if (!slot) {
      this.showFloatingText(button.card.x, button.card.y - 92, `NO ${PRODUCTS[productId].label} GAP`, 0xb8d1c6);
      return;
    }

    this.inventory[productId] -= 1;
    scene.restockBusy = true;
    this.refreshButtons();

    this.tweens.killTweensOf(button.card);
    this.tweens.add({
      targets: button.card,
      scaleX: button.card.scaleX * 0.92,
      scaleY: button.card.scaleY * 0.92,
      duration: 70,
      yoyo: true,
      ease: "Sine.Out"
    });

    const definition = PRODUCTS[productId];
    const product = scene.add.image(button.card.x, button.card.y - 20, definition.productKey)
      .setOrigin(0.5, 1)
      .setDepth(31)
      .setAlpha(0.92);
    this.fitImage(product, definition.shelfWidth, definition.shelfHeight);

    scene.tweens.add({
      targets: product,
      x: slot.hitArea.x,
      y: slot.productBottomY,
      alpha: 1,
      duration: 240,
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

  private loadIfMissing(key: keyof typeof AssetPaths): void {
    if (!this.textures.exists(key)) this.load.image(key, AssetPaths[key]);
  }

  private fitImage(image: Phaser.GameObjects.Image, maxWidth: number, maxHeight: number): void {
    const sourceWidth = Math.max(1, image.width);
    const sourceHeight = Math.max(1, image.height);
    image.setScale(Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight));
  }
}
