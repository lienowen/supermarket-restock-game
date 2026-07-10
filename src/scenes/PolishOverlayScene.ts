import Phaser from "phaser";
import { PRODUCTS, type ProductId } from "../gameConfig";
import type { ShiftPhase } from "../domain/gameTypes";

type RuntimeBox = {
  productId: ProductId;
  image: Phaser.GameObjects.Image;
  loaded: boolean;
};

type RuntimeSlot = {
  productId: ProductId;
  hitArea: Phaser.GameObjects.Rectangle;
  missingTag: Phaser.GameObjects.Image;
  product?: Phaser.GameObjects.Image;
};

type RuntimeGameScene = Phaser.Scene & {
  boxes: RuntimeBox[];
  shelfSlots: RuntimeSlot[];
  loadedProducts: ProductId[];
  cart: Phaser.GameObjects.Container;
  cartCountText: Phaser.GameObjects.Text;
  cartAtShelf: boolean;
  movingCart: boolean;
  restockBusy: boolean;
  stocked: number;
  phase: ShiftPhase;
  shiftEnded: boolean;
  timerText: Phaser.GameObjects.Text;
};

type TutorialStage = "BOX_TO_CART" | "CART_TO_SALES" | "RESTOCK" | "DONE";

export class PolishOverlayScene extends Phaser.Scene {
  private gameScene?: RuntimeGameScene;
  private attached = false;

  private tutorialStage?: TutorialStage;
  private tutorialGraphics!: Phaser.GameObjects.Graphics;
  private tutorialBg!: Phaser.GameObjects.Rectangle;
  private tutorialText!: Phaser.GameObjects.Text;
  private tutorialTween?: Phaser.Tweens.Tween;

  private pressureBg!: Phaser.GameObjects.Rectangle;
  private pressureText!: Phaser.GameObjects.Text;
  private pressureTween?: Phaser.Tweens.Tween;

  private previousStocked = 0;
  private previousCartCount = 0;
  private knownProducts = new Set<Phaser.GameObjects.Image>();
  private wrongSlotListeners: Array<{ hitArea: Phaser.GameObjects.Rectangle; handler: () => void }> = [];

  constructor() {
    super({ key: "polish-overlay", active: true });
  }

  create(): void {
    this.tutorialGraphics = this.add.graphics().setDepth(300);
    this.tutorialBg = this.add.rectangle(665, 230, 520, 62, 0x102820, 0.94)
      .setStrokeStyle(3, 0xffd75a)
      .setDepth(301)
      .setVisible(false);
    this.tutorialText = this.add.text(665, 230, "", {
      fontFamily: "Arial",
      fontSize: "24px",
      color: "#ffffff",
      fontStyle: "bold",
      align: "center"
    }).setOrigin(0.5).setDepth(302).setVisible(false);

    this.pressureBg = this.add.rectangle(1110, 178, 330, 48, 0x792323, 0.94)
      .setStrokeStyle(2, 0xffb0a5)
      .setDepth(290)
      .setVisible(false);
    this.pressureText = this.add.text(1110, 178, "", {
      fontFamily: "Arial",
      fontSize: "20px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setOrigin(0.5).setDepth(291).setVisible(false);

    this.time.addEvent({
      delay: 100,
      loop: true,
      callback: () => this.tryAttach()
    });
  }

  update(): void {
    if (!this.attached || !this.gameScene) return;
    if (!this.gameScene.scene.isActive()) return;

    this.updateTutorial();
    this.detectRestockFeedback();
    this.detectCartFeedback();
    this.updatePressure();
  }

  private tryAttach(): void {
    if (this.attached) return;

    const scene = this.scene.get("game") as RuntimeGameScene;
    if (!scene?.scene?.isActive()) return;
    if (!scene.cart || !scene.shelfSlots?.length || !scene.boxes?.length) return;

    this.gameScene = scene;
    this.attached = true;
    this.previousStocked = scene.stocked;
    this.previousCartCount = scene.loadedProducts.length;

    scene.shelfSlots.forEach((slot) => {
      if (slot.product) this.knownProducts.add(slot.product);
      const handler = () => this.handleSlotAttempt(slot);
      slot.hitArea.on("pointerdown", handler);
      this.wrongSlotListeners.push({ hitArea: slot.hitArea, handler });
    });

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.detach());
    this.scene.bringToTop();
    this.updateTutorial(true);
  }

  private detach(): void {
    this.wrongSlotListeners.forEach(({ hitArea, handler }) => {
      if (hitArea.active) hitArea.off("pointerdown", handler);
    });
    this.wrongSlotListeners = [];
    this.attached = false;
    this.gameScene = undefined;
    this.tutorialStage = undefined;
    this.knownProducts.clear();
    this.clearTutorial();
    this.hidePressure();
  }

  private resolveTutorialStage(): TutorialStage {
    const scene = this.gameScene!;
    if (scene.stocked > 0) return "DONE";
    if (scene.cartAtShelf) return "RESTOCK";
    if (scene.loadedProducts.length > 0) return "CART_TO_SALES";
    return "BOX_TO_CART";
  }

  private updateTutorial(force = false): void {
    const scene = this.gameScene!;
    if (scene.shiftEnded) {
      this.clearTutorial();
      return;
    }

    const stage = this.resolveTutorialStage();
    if (!force && stage === this.tutorialStage) return;
    this.tutorialStage = stage;
    this.clearTutorial();

    if (stage === "DONE") {
      this.showMicroMessage("NICE! KEEP THE SHELVES FULL", 1200);
      return;
    }

    this.tutorialGraphics.setVisible(true).setAlpha(1);
    this.tutorialBg.setVisible(true);
    this.tutorialText.setVisible(true);

    if (stage === "BOX_TO_CART") {
      const box = scene.boxes.find((item) => item.image.visible && !item.loaded);
      if (!box) return;
      this.tutorialText.setText("1. DRAG A BOX INTO THE CART");
      this.drawPath(box.image.x, box.image.y - 55, scene.cart.x, scene.cart.y - 130, 0xffd75a);
      this.drawTarget(scene.cart.x, scene.cart.y - 130, 56, 0x8fe36f);
      this.drawTarget(box.image.x, box.image.y - 55, 48, 0xffd75a);
    } else if (stage === "CART_TO_SALES") {
      this.tutorialText.setText("2. MOVE THE LOADED CART TO SALES");
      this.drawPath(scene.cart.x, scene.cart.y - 120, 770, 760, 0xffd75a);
      this.drawTarget(scene.cart.x, scene.cart.y - 120, 64, 0xffd75a);
    } else {
      const slot = scene.shelfSlots.find(
        (candidate) => !candidate.product && scene.loadedProducts.includes(candidate.productId)
      ) ?? scene.shelfSlots.find((candidate) => !candidate.product);
      if (!slot) return;
      this.tutorialText.setText(`3. TAP THE MATCHING ${PRODUCTS[slot.productId].label} SLOT`);
      this.drawPath(scene.cart.x, scene.cart.y - 120, slot.hitArea.x, slot.hitArea.y, 0xffd75a);
      this.drawTarget(slot.hitArea.x, slot.hitArea.y, 58, 0x8fe36f);
    }

    this.tutorialTween = this.tweens.add({
      targets: this.tutorialGraphics,
      alpha: 0.38,
      duration: 430,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut"
    });
  }

  private clearTutorial(): void {
    this.tutorialTween?.stop();
    this.tutorialTween = undefined;
    this.tutorialGraphics?.clear().setVisible(false).setAlpha(1);
    this.tutorialBg?.setVisible(false);
    this.tutorialText?.setVisible(false);
  }

  private drawPath(startX: number, startY: number, endX: number, endY: number, color: number): void {
    const graphics = this.tutorialGraphics;
    graphics.lineStyle(9, color, 0.95);
    graphics.beginPath();
    graphics.moveTo(startX, startY);
    graphics.lineTo(endX, endY);
    graphics.strokePath();

    const angle = Phaser.Math.Angle.Between(startX, startY, endX, endY);
    const tipLength = 28;
    const spread = 0.55;
    graphics.fillStyle(color, 1);
    graphics.fillTriangle(
      endX,
      endY,
      endX - Math.cos(angle - spread) * tipLength,
      endY - Math.sin(angle - spread) * tipLength,
      endX - Math.cos(angle + spread) * tipLength,
      endY - Math.sin(angle + spread) * tipLength
    );
  }

  private drawTarget(x: number, y: number, radius: number, color: number): void {
    this.tutorialGraphics.lineStyle(6, color, 0.95);
    this.tutorialGraphics.strokeCircle(x, y, radius);
  }

  private detectRestockFeedback(): void {
    const scene = this.gameScene!;
    if (scene.stocked <= this.previousStocked) {
      this.previousStocked = scene.stocked;
      return;
    }

    const added = scene.stocked - this.previousStocked;
    this.previousStocked = scene.stocked;

    const newSlots = scene.shelfSlots.filter((slot) => {
      if (!slot.product || this.knownProducts.has(slot.product)) return false;
      this.knownProducts.add(slot.product);
      return true;
    });

    newSlots.forEach((slot, index) => {
      if (!slot.product) return;
      const product = slot.product;
      const finalScaleX = product.scaleX;
      const finalScaleY = product.scaleY;
      product.setScale(finalScaleX * 0.72, finalScaleY * 0.72);

      this.tweens.add({
        targets: product,
        scaleX: finalScaleX * 1.08,
        scaleY: finalScaleY * 1.08,
        duration: 150,
        delay: index * 60,
        ease: "Back.Out",
        yoyo: true,
        onComplete: () => product.setScale(finalScaleX, finalScaleY)
      });

      const ring = this.add.rectangle(slot.hitArea.x, slot.hitArea.y, 124, 132, 0x8ff08a, 0.08)
        .setStrokeStyle(6, 0x8ff08a, 1)
        .setDepth(310);
      this.tweens.add({
        targets: ring,
        alpha: 0,
        scaleX: 1.2,
        scaleY: 1.2,
        duration: 480,
        ease: "Cubic.Out",
        onComplete: () => ring.destroy()
      });
    });

    this.showFloatingFeedback(1000, 820, `SHELF +${added}`, 0x8ff08a);
    this.playSuccessTone();
    this.tryVibrate(18);
  }

  private detectCartFeedback(): void {
    const scene = this.gameScene!;
    const current = scene.loadedProducts.length;
    if (current === this.previousCartCount) return;

    this.previousCartCount = current;
    const text = scene.cartCountText;
    if (!text?.active) return;

    this.tweens.killTweensOf(text);
    text.setScale(1);
    this.tweens.add({
      targets: text,
      scaleX: 1.28,
      scaleY: 1.28,
      duration: 110,
      yoyo: true,
      ease: "Back.Out"
    });
  }

  private updatePressure(): void {
    const scene = this.gameScene!;
    if (scene.shiftEnded || (scene.phase !== "OPEN" && scene.phase !== "RUSH")) {
      this.hidePressure();
      return;
    }

    const missing = scene.shelfSlots.filter((slot) => !slot.product);
    if (missing.length < 2) {
      this.hidePressure();
      return;
    }

    const soldOutProduct = (Object.keys(PRODUCTS) as ProductId[]).find((productId) => {
      const slots = scene.shelfSlots.filter((slot) => slot.productId === productId);
      return slots.length > 0 && slots.every((slot) => !slot.product);
    });

    const label = soldOutProduct
      ? `SOLD OUT · ${PRODUCTS[soldOutProduct].label}`
      : `LOW STOCK · ${missing.length}/${scene.shelfSlots.length} EMPTY`;

    this.pressureBg.setVisible(true);
    this.pressureText.setText(label).setVisible(true);

    if (!this.pressureTween && missing.length >= 4) {
      this.pressureTween = this.tweens.add({
        targets: [this.pressureBg, this.pressureText],
        alpha: 0.55,
        duration: 360,
        yoyo: true,
        repeat: -1,
        ease: "Sine.InOut"
      });
    } else if (missing.length < 4 && this.pressureTween) {
      this.pressureTween.stop();
      this.pressureTween = undefined;
      this.pressureBg.setAlpha(1);
      this.pressureText.setAlpha(1);
    }
  }

  private hidePressure(): void {
    this.pressureTween?.stop();
    this.pressureTween = undefined;
    this.pressureBg?.setVisible(false).setAlpha(1);
    this.pressureText?.setVisible(false).setAlpha(1);
  }

  private handleSlotAttempt(slot: RuntimeSlot): void {
    const scene = this.gameScene;
    if (!scene || scene.shiftEnded || !scene.cartAtShelf || slot.product) return;
    if (scene.loadedProducts.includes(slot.productId)) return;
    if (scene.loadedProducts.length === 0) return;

    this.showFloatingFeedback(slot.hitArea.x, slot.hitArea.y - 25, "WRONG STOCK", 0xff7a6e);
    this.tryVibrate([18, 35, 18]);
  }

  private showFloatingFeedback(x: number, y: number, message: string, color: number): void {
    const text = this.add.text(x, y, message, {
      fontFamily: "Arial",
      fontSize: "27px",
      color: `#${color.toString(16).padStart(6, "0")}`,
      fontStyle: "bold",
      stroke: "#172020",
      strokeThickness: 6
    }).setOrigin(0.5).setDepth(320);

    this.tweens.add({
      targets: text,
      y: y - 68,
      alpha: 0,
      scaleX: 1.12,
      scaleY: 1.12,
      duration: 720,
      ease: "Cubic.Out",
      onComplete: () => text.destroy()
    });
  }

  private showMicroMessage(message: string, duration: number): void {
    this.tutorialBg.setVisible(true);
    this.tutorialText.setText(message).setVisible(true);
    this.time.delayedCall(duration, () => {
      if (this.tutorialStage === "DONE") {
        this.tutorialBg.setVisible(false);
        this.tutorialText.setVisible(false);
      }
    });
  }

  private playSuccessTone(): void {
    try {
      const AudioContextClass = window.AudioContext
        ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;

      const context = new AudioContextClass();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(660, context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(880, context.currentTime + 0.08);
      gain.gain.setValueAtTime(0.035, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.12);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.13);
      oscillator.addEventListener("ended", () => void context.close());
    } catch {
      // Audio feedback is optional; gameplay must never depend on it.
    }
  }

  private tryVibrate(pattern: number | number[]): void {
    try {
      navigator.vibrate?.(pattern);
    } catch {
      // Haptics are optional.
    }
  }
}
