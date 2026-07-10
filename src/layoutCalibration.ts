import Phaser from "phaser";
import { Assets } from "./assets";
import { GAME_RULES, type ProductId } from "./gameConfig";
import { GameScene } from "./scenes/GameScene";
import { PolishOverlayScene } from "./scenes/PolishOverlayScene";

type BoxItemLike = {
  productId?: ProductId;
  image: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
  homeX: number;
  homeY: number;
  loaded?: boolean;
};

type ShelfSlotLike = {
  productId: ProductId;
  hitArea: Phaser.GameObjects.Rectangle;
  product?: Phaser.GameObjects.Image;
};

type CartVisualState = "EMPTY" | "LOADING" | "READY" | "FULL";
type CartGuideMode = "CART_TO_SALES" | "CART_TO_WAREHOUSE";
type TutorialStage = "BOX_TO_CART" | "CART_TO_SALES" | "RESTOCK" | "DONE";

type SceneInternals = Phaser.Scene & {
  worker: Phaser.GameObjects.Image;
  cart: Phaser.GameObjects.Container;
  cartSprite: Phaser.GameObjects.Image;
  cartCountText: Phaser.GameObjects.Text;
  cartAtShelf: boolean;
  movingCart: boolean;
  restockBusy: boolean;
  shiftEnded: boolean;
  phase: "PREPARE" | "OPEN" | "RUSH" | "CLOSING" | "RESULT";
  loadedProducts: ProductId[];
  selectedBox?: BoxItemLike;
  boxes: BoxItemLike[];
  shelfSlots: ShelfSlotLike[];
  guideTween?: Phaser.Tweens.Tween;
  guideGraphics: Phaser.GameObjects.Graphics;
  guideLabelBg: Phaser.GameObjects.Rectangle;
  guideLabel: Phaser.GameObjects.Text;
  guideMode: "NONE" | CartGuideMode | "RESTOCK";
  departureRequirement: () => number;
  showTransientHint: (message: string) => void;
  clearGuide: () => void;
  updateHud: () => void;
  endShift: () => void;
  setWorkerTexture: (texture: string, maxWidth: number, maxHeight: number) => void;
  __groundingHandler?: () => void;
  __cartShadow?: Phaser.GameObjects.Ellipse;
  __cartStateLabel?: Phaser.GameObjects.Text;
  __cartVisualState?: CartVisualState;
};

type ScenePrototype = {
  create: () => void;
  spawnBox: (productId: ProductId, positionIndex: number, renewable: boolean) => BoxItemLike;
  setWorkerTexture: (texture: string, maxWidth: number, maxHeight: number) => void;
  snapCart: (destination: "WAREHOUSE" | "SALES") => void;
  showCartGuide: (mode: CartGuideMode) => void;
};

type OverlayGameScene = {
  stocked: number;
  shiftEnded: boolean;
  cartAtShelf: boolean;
  loadedProducts: ProductId[];
  selectedBox?: BoxItemLike;
  boxes: BoxItemLike[];
  shelfSlots: ShelfSlotLike[];
  cart: Phaser.GameObjects.Container;
};

type OverlayInternals = Phaser.Scene & {
  gameScene?: OverlayGameScene;
  tutorialStage?: TutorialStage;
  tutorialTween?: Phaser.Tweens.Tween;
  tutorialGraphics: Phaser.GameObjects.Graphics;
  tutorialBg: Phaser.GameObjects.Rectangle;
  tutorialText: Phaser.GameObjects.Text;
  __tutorialSignature?: string;
};

type OverlayPrototype = {
  resolveTutorialStage: () => TutorialStage;
  updateTutorial: (force?: boolean) => void;
};

const WAREHOUSE_WORKER_GROUND = { x: 410, y: 950 };
const SALES_WORKER_GROUND = { x: 720, y: 925 };
const WAREHOUSE_CART_GROUND = { x: 505, y: 962 };
const SALES_CART_GROUND = { x: 760, y: 948 };
const MAX_WORKER_WIDTH = 188;
const MAX_WORKER_HEIGHT = 355;
const BOX_FLOOR_NUDGE = 8;
const BOX_MAGNET_RADIUS = 185;

const prototype = GameScene.prototype as unknown as ScenePrototype;
const originalCreate = prototype.create;
const originalSpawnBox = prototype.spawnBox;
const originalSetWorkerTexture = prototype.setWorkerTexture;

prototype.setWorkerTexture = function setWorkerTextureCalibrated(
  texture: string,
  maxWidth: number,
  maxHeight: number
): void {
  // The push sprite contains a second cart. Keep one real interactive cart only.
  const safeTexture = texture === Assets.characters.workerPush
    ? Assets.characters.workerIdle
    : texture;

  originalSetWorkerTexture.call(
    this,
    safeTexture,
    Math.min(maxWidth, MAX_WORKER_WIDTH),
    Math.min(maxHeight, MAX_WORKER_HEIGHT)
  );
};

prototype.spawnBox = function spawnGroundedBox(
  productId: ProductId,
  positionIndex: number,
  renewable: boolean
): BoxItemLike {
  const item = originalSpawnBox.call(this, productId, positionIndex, renewable);
  const scene = this as unknown as SceneInternals;
  calibrateBox(item);
  configureBoxDrag(scene, item);
  return item;
};

prototype.snapCart = function snapCartSmooth(
  destination: "WAREHOUSE" | "SALES"
): void {
  const scene = this as unknown as SceneInternals;
  const cartTarget = destination === "SALES" ? SALES_CART_GROUND : WAREHOUSE_CART_GROUND;
  const workerTarget = destination === "SALES" ? SALES_WORKER_GROUND : WAREHOUSE_WORKER_GROUND;

  // One position tween per object. The previous implementation had two tweens
  // fighting over cart/worker Y, which caused subtle jumps after drag release.
  scene.tweens.killTweensOf(scene.cart);
  scene.tweens.killTweensOf(scene.worker);
  scene.movingCart = true;
  scene.cart.setDepth(38);

  scene.tweens.add({
    targets: scene.cart,
    x: cartTarget.x,
    y: cartTarget.y,
    duration: 310,
    ease: "Cubic.Out"
  });

  scene.tweens.add({
    targets: scene.worker,
    x: workerTarget.x,
    y: workerTarget.y,
    duration: 310,
    ease: "Cubic.Out",
    onComplete: () => {
      scene.cart.setDepth(18);
      scene.cartAtShelf = destination === "SALES";
      scene.movingCart = false;
      scene.setWorkerTexture(
        Assets.characters.workerIdle,
        destination === "SALES" ? 205 : 220,
        destination === "SALES" ? 420 : 440
      );

      if (destination === "WAREHOUSE" && scene.phase === "CLOSING") {
        scene.endShift();
        return;
      }

      scene.updateHud();
    }
  });
};

prototype.showCartGuide = function showCompactStaticCartGuide(mode: CartGuideMode): void {
  const scene = this as unknown as SceneInternals;
  if (scene.guideMode === mode) return;

  scene.clearGuide();
  scene.guideMode = mode;
  scene.guideTween?.stop();
  scene.guideTween = undefined;
  scene.cartSprite.setAlpha(1);

  const toSales = mode === "CART_TO_SALES";
  const startX = scene.cart.x;
  const startY = scene.cart.y - 105;
  const endX = toSales ? 715 : 625;
  const endY = 765;
  const midX = (startX + endX) / 2;
  const midY = Math.min(startY, endY) - 34;

  scene.guideGraphics.clear();
  scene.guideGraphics.lineStyle(5, 0xffd75a, 0.9);
  scene.guideGraphics.beginPath();
  scene.guideGraphics.moveTo(startX, startY);
  scene.guideGraphics.lineTo(midX, midY);
  scene.guideGraphics.lineTo(endX, endY);
  scene.guideGraphics.strokePath();
  drawArrowHead(scene.guideGraphics, midX, midY, endX, endY, 0xffd75a, 18);
  scene.guideGraphics.setVisible(true);

  // Bottom HUD already explains the action; avoid another large label over gameplay.
  scene.guideLabelBg.setVisible(false);
  scene.guideLabel.setVisible(false);
};

prototype.create = function createWithGroundCalibration(): void {
  originalCreate.call(this);
  const scene = this as unknown as SceneInternals;

  scene.boxes.forEach((item) => {
    calibrateBox(item);
    configureBoxDrag(scene, item);
  });
  capWorker(scene.worker);
  configureCartInteraction(scene);
  ensureCartShadow(scene);
  ensureCartStateLabel(scene);

  scene.cart.y = scene.cartAtShelf ? SALES_CART_GROUND.y : WAREHOUSE_CART_GROUND.y;
  placeIdleWorker(scene);
  updateCartShadow(scene);
  updateCartVisualState(scene, true);

  if (scene.__groundingHandler) {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, scene.__groundingHandler);
  }

  const groundingHandler = (): void => {
    if (!scene.worker?.active || !scene.cart?.active) return;

    updateCartShadow(scene);
    updateCartVisualState(scene);

    if (scene.movingCart || scene.restockBusy || scene.selectedBox) return;
    if (scene.tweens.isTweening(scene.worker)) return;

    placeIdleWorker(scene);
  };

  scene.__groundingHandler = groundingHandler;
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, groundingHandler);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, groundingHandler);
    if (scene.__groundingHandler === groundingHandler) scene.__groundingHandler = undefined;
    scene.__cartShadow?.destroy();
    scene.__cartShadow = undefined;
    scene.__cartStateLabel?.destroy();
    scene.__cartStateLabel = undefined;
  });
};

function configureBoxDrag(scene: SceneInternals, item: BoxItemLike): void {
  const image = item.image;
  if (image.getData("smoothDragConfigured")) return;
  image.setData("smoothDragConfigured", true);

  // Box interaction is drag-only. Remove the old click-select route so one gesture
  // always means the same thing on desktop and touch devices.
  image.removeAllListeners("pointerdown");

  image.on("drag", () => {
    if (image.getData("dragBlocked") || !scene.cart?.active) return;

    const targetX = scene.cart.x;
    const targetY = scene.cart.y - 105;
    const distance = Phaser.Math.Distance.Between(image.x, image.y, targetX, targetY);

    if (distance < BOX_MAGNET_RADIUS) {
      const closeness = 1 - distance / BOX_MAGNET_RADIUS;
      const strength = 0.08 + closeness * 0.2;
      image.x = Phaser.Math.Linear(image.x, targetX, strength);
      image.y = Phaser.Math.Linear(image.y, targetY, strength);

      // Faster body follow removes the "object moves first, worker catches up later" feel.
      scene.worker.x = Phaser.Math.Linear(scene.worker.x, image.x + 92, 0.55);
      scene.worker.y = Phaser.Math.Linear(scene.worker.y, image.y, 0.55);
    }
  });
}

function configureCartInteraction(scene: SceneInternals): void {
  // Match the visible cart body and give touch users a forgiving hit area.
  scene.cart.disableInteractive();
  scene.cart.removeAllListeners("pointerdown");
  scene.cart.removeAllListeners("pointerup");

  scene.cart.setInteractive(
    new Phaser.Geom.Rectangle(-175, -270, 350, 310),
    Phaser.Geom.Rectangle.Contains
  );
  scene.input.setDraggable(scene.cart);
  scene.input.dragDistanceThreshold = 4;
  scene.input.dragTimeThreshold = 0;
  if (scene.cart.input) scene.cart.input.cursor = "grab";

  // Drag-only cart movement. No hidden tap-to-teleport fallback.
  scene.cart.on("dragstart", () => {
    if (scene.cart.getData("dragBlocked")) return;
    if (scene.cart.input) scene.cart.input.cursor = "grabbing";
    scene.tweens.killTweensOf(scene.cart);
    scene.cart.setScale(1);
    scene.tweens.add({
      targets: scene.cart,
      scaleX: 1.012,
      scaleY: 1.012,
      duration: 90,
      ease: "Sine.Out"
    });
  });

  scene.cart.on("drag", () => {
    if (scene.cart.getData("dragBlocked")) return;
    scene.worker.x = Phaser.Math.Linear(scene.worker.x, scene.cart.x - 108, 0.62);
    scene.worker.y = Phaser.Math.Linear(scene.worker.y, scene.cart.y, 0.62);
  });

  scene.cart.on("dragend", () => {
    if (scene.cart.input) scene.cart.input.cursor = "grab";
    scene.tweens.add({
      targets: scene.cart,
      scaleX: 1,
      scaleY: 1,
      duration: 120,
      ease: "Sine.Out"
    });
  });
}

function ensureCartShadow(scene: SceneInternals): void {
  scene.__cartShadow?.destroy();
  scene.__cartShadow = scene.add.ellipse(0, 0, 205, 22, 0x101515, 0.2)
    .setDepth(17);
}

function updateCartShadow(scene: SceneInternals): void {
  if (!scene.__cartShadow?.active) return;
  scene.__cartShadow
    .setPosition(scene.cart.x + 6, scene.cart.y + 3)
    .setDepth(Math.max(1, scene.cart.depth - 1))
    .setVisible(scene.cart.visible);
}

function ensureCartStateLabel(scene: SceneInternals): void {
  scene.__cartStateLabel?.destroy();
  const label = scene.add.text(0, -232, "EMPTY", {
    fontFamily: "Arial",
    fontSize: "16px",
    color: "#ffffff",
    fontStyle: "bold",
    backgroundColor: "#344140",
    padding: { x: 7, y: 3 }
  }).setOrigin(0.5);

  scene.cart.add(label);
  scene.__cartStateLabel = label;
}

function updateCartVisualState(scene: SceneInternals, force = false): void {
  const count = scene.loadedProducts.length;
  const required = scene.departureRequirement();
  const state: CartVisualState = count === 0
    ? "EMPTY"
    : count >= GAME_RULES.cartCapacity
      ? "FULL"
      : count >= required
        ? "READY"
        : "LOADING";

  scene.cartCountText.setText(`${count}/${GAME_RULES.cartCapacity}`);

  const palette: Record<CartVisualState, { bg: string; label: string }> = {
    EMPTY: { bg: "#344140", label: "EMPTY" },
    LOADING: { bg: "#8a6420", label: "LOADING" },
    READY: { bg: "#2f7d45", label: "READY" },
    FULL: { bg: "#1f6f8b", label: "FULL" }
  };
  const visual = palette[state];
  scene.cartCountText.setBackgroundColor(visual.bg);
  scene.__cartStateLabel?.setText(visual.label).setBackgroundColor(visual.bg);

  if (!force && state !== scene.__cartVisualState && (state === "READY" || state === "FULL")) {
    showCartReadyFeedback(scene, state === "FULL" ? "CART FULL" : "READY TO GO");
  }
  scene.__cartVisualState = state;
}

function showCartReadyFeedback(scene: SceneInternals, message: string): void {
  const text = scene.add.text(scene.cart.x, scene.cart.y - 275, message, {
    fontFamily: "Arial",
    fontSize: "24px",
    color: "#e9ffe9",
    fontStyle: "bold",
    stroke: "#173522",
    strokeThickness: 6
  }).setOrigin(0.5).setDepth(95).setScale(0.82);

  scene.tweens.add({
    targets: text,
    scaleX: 1,
    scaleY: 1,
    y: text.y - 18,
    duration: 220,
    ease: "Back.Out",
    onComplete: () => {
      scene.tweens.add({
        targets: text,
        alpha: 0,
        y: text.y - 34,
        delay: 520,
        duration: 280,
        ease: "Cubic.In",
        onComplete: () => text.destroy()
      });
    }
  });
}

function calibrateBox(item: BoxItemLike): void {
  if (!item.image.getData("groundCalibrated")) {
    item.homeY += BOX_FLOOR_NUDGE;
    item.image.setData("groundCalibrated", true);
  }

  item.image
    .setOrigin(0.5, 1)
    .setPosition(item.homeX, item.homeY)
    .setDepth(16 + item.homeY / 10000);

  item.shadow
    .setPosition(item.homeX, item.homeY + 3)
    .setDisplaySize(76, 12)
    .setAlpha(0.22)
    .setDepth(15 + item.homeY / 10000);
}

function placeIdleWorker(scene: SceneInternals): void {
  const target = scene.cartAtShelf ? SALES_WORKER_GROUND : WAREHOUSE_WORKER_GROUND;
  capWorker(scene.worker);
  scene.worker
    .setOrigin(0.5, 1)
    .setPosition(target.x, target.y)
    .setDepth(17.8);
}

function capWorker(worker: Phaser.GameObjects.Image): void {
  const sourceWidth = Math.max(1, worker.width);
  const sourceHeight = Math.max(1, worker.height);
  const scale = Math.min(MAX_WORKER_WIDTH / sourceWidth, MAX_WORKER_HEIGHT / sourceHeight);
  worker.setScale(scale).setOrigin(0.5, 1);
}

const overlayPrototype = PolishOverlayScene.prototype as unknown as OverlayPrototype;

overlayPrototype.resolveTutorialStage = function resolveTutorialStageCalibrated(): TutorialStage {
  const overlay = this as unknown as OverlayInternals;
  const scene = overlay.gameScene;
  if (!scene) return "BOX_TO_CART";
  if (scene.stocked > 0) return "DONE";
  if (scene.cartAtShelf) return "RESTOCK";
  if (scene.loadedProducts.length >= GAME_RULES.firstMoveRequirement) return "CART_TO_SALES";
  return "BOX_TO_CART";
};

overlayPrototype.updateTutorial = function updateResponsiveStaticTutorial(force = false): void {
  const overlay = this as unknown as OverlayInternals;
  const scene = overlay.gameScene;
  if (!scene) return;

  overlay.tutorialTween?.stop();
  overlay.tutorialTween = undefined;
  overlay.tutorialBg.setVisible(false);
  overlay.tutorialText.setVisible(false);

  if (scene.shiftEnded || scene.stocked > 0) {
    overlay.tutorialGraphics.clear().setVisible(false).setAlpha(1);
    overlay.tutorialStage = "DONE";
    overlay.__tutorialSignature = "DONE";
    return;
  }

  const stage = overlayPrototype.resolveTutorialStage.call(this);
  overlay.tutorialStage = stage;

  // While a box is actively being dragged, remove the guide instead of letting it
  // chase the pointer. This keeps the gesture visually calm.
  if (scene.selectedBox) {
    overlay.tutorialGraphics.clear().setVisible(false).setAlpha(1);
    overlay.__tutorialSignature = "DRAGGING";
    return;
  }

  let signature = stage;
  let startX = scene.cart.x;
  let startY = scene.cart.y - 110;
  let endX = startX;
  let endY = startY;
  let startRadius = 27;
  let endRadius = 31;
  let startColor = 0xffd75a;
  let endColor = 0x8fe36f;

  if (stage === "BOX_TO_CART") {
    const available = scene.boxes
      .filter((item) => item.image.active && item.image.visible && !item.loaded)
      .sort((a, b) => {
        const da = Phaser.Math.Distance.Between(a.image.x, a.image.y, scene.cart.x, scene.cart.y);
        const db = Phaser.Math.Distance.Between(b.image.x, b.image.y, scene.cart.x, scene.cart.y);
        return da - db;
      });
    const box = available[0];
    if (!box) {
      overlay.tutorialGraphics.clear().setVisible(false);
      return;
    }

    startX = box.image.x;
    startY = box.image.y - box.image.displayHeight * 0.45;
    endX = scene.cart.x;
    endY = scene.cart.y - 118;
    signature = `${stage}:${scene.loadedProducts.length}:${Math.round(startX)}:${Math.round(startY)}`;
  } else if (stage === "CART_TO_SALES") {
    endX = 712;
    endY = 765;
    startRadius = 31;
    endRadius = 24;
    signature = `${stage}:${Math.round(scene.cart.x)}:${Math.round(scene.cart.y)}`;
  } else if (stage === "RESTOCK") {
    const slot = scene.shelfSlots.find(
      (candidate) => !candidate.product && scene.loadedProducts.includes(candidate.productId)
    ) ?? scene.shelfSlots.find((candidate) => !candidate.product);
    if (!slot) {
      overlay.tutorialGraphics.clear().setVisible(false);
      return;
    }

    endX = slot.hitArea.x;
    endY = slot.hitArea.y;
    endRadius = 31;
    signature = `${stage}:${slot.productId}:${Math.round(endX)}:${Math.round(endY)}`;
  }

  if (!force && signature === overlay.__tutorialSignature) return;
  overlay.__tutorialSignature = signature;

  drawCompactGuide(
    overlay.tutorialGraphics,
    startX,
    startY,
    endX,
    endY,
    startColor,
    endColor,
    startRadius,
    endRadius
  );
};

function drawCompactGuide(
  graphics: Phaser.GameObjects.Graphics,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  startColor: number,
  endColor: number,
  startRadius: number,
  endRadius: number
): void {
  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2 - Math.min(42, Math.abs(endX - startX) * 0.08);

  graphics.clear();
  graphics.lineStyle(5, 0xffd75a, 0.9);
  graphics.beginPath();
  graphics.moveTo(startX, startY);
  graphics.lineTo(midX, midY);
  graphics.lineTo(endX, endY);
  graphics.strokePath();
  drawArrowHead(graphics, midX, midY, endX, endY, 0xffd75a, 18);

  graphics.lineStyle(4, startColor, 0.92);
  graphics.strokeCircle(startX, startY, startRadius);
  graphics.lineStyle(4, endColor, 0.92);
  graphics.strokeCircle(endX, endY, endRadius);
  graphics.setVisible(true).setAlpha(1);
}

function drawArrowHead(
  graphics: Phaser.GameObjects.Graphics,
  fromX: number,
  fromY: number,
  endX: number,
  endY: number,
  color: number,
  size: number
): void {
  const angle = Phaser.Math.Angle.Between(fromX, fromY, endX, endY);
  const spread = 0.55;
  graphics.fillStyle(color, 1);
  graphics.fillTriangle(
    endX,
    endY,
    endX - Math.cos(angle - spread) * size,
    endY - Math.sin(angle - spread) * size,
    endX - Math.cos(angle + spread) * size,
    endY - Math.sin(angle + spread) * size
  );
}
