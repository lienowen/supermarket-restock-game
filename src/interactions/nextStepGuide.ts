import Phaser from "phaser";
import { GAME_RULES } from "../gameConfig";
import { GameScene } from "../scenes/GameScene";

type ShelfSlotLike = {
  productId: string;
  missingTag: Phaser.GameObjects.Image;
  product?: Phaser.GameObjects.Image;
};

type SceneInternals = Phaser.Scene & {
  loadedProducts: string[];
  cart: Phaser.GameObjects.Container;
  cartSprite: Phaser.GameObjects.Image;
  cartAtShelf: boolean;
  movingCart: boolean;
  shiftEnded: boolean;
  storeOpen: boolean;
  shelfSlots: ShelfSlotLike[];
  hintText: Phaser.GameObjects.Text;
  showTransientHint: (message: string) => void;
};

type ScenePrototype = {
  createCart: () => void;
  updateHud: () => void;
  tryRestockSlot: (slot: ShelfSlotLike) => void;
};

type GuidePhase = "loading" | "cart-ready" | "shelf-ready" | "return-cart" | "done";

type GuideState = {
  graphics: Phaser.GameObjects.Graphics;
  labelBg: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  phase: GuidePhase;
  cartTween?: Phaser.Tweens.Tween;
  missingTween?: Phaser.Tweens.Tween;
  highlightedMissing?: Phaser.GameObjects.Image;
  missingBaseScaleX?: number;
  missingBaseScaleY?: number;
};

const prototype = GameScene.prototype as unknown as ScenePrototype;
const originalCreateCart = prototype.createCart;
const originalUpdateHud = prototype.updateHud;
const originalTryRestockSlot = prototype.tryRestockSlot;

prototype.createCart = function createCartWithNextStepGuide(): void {
  originalCreateCart.call(this);
  const scene = this as unknown as SceneInternals;
  const state = createGuideState(scene);
  (scene as unknown as { __nextStepGuide?: GuideState }).__nextStepGuide = state;

  scene.cart.on("dragstart", () => {
    if (state.phase === "cart-ready" || state.phase === "return-cart") {
      hideCartGuide(scene, state);
      state.phase = "loading";
    }
  });
};

prototype.updateHud = function updateHudWithNextStepGuide(): void {
  originalUpdateHud.call(this);
  const scene = this as unknown as SceneInternals;
  const state = (scene as unknown as { __nextStepGuide?: GuideState }).__nextStepGuide;
  if (!state || scene.shiftEnded) return;

  const requiredDepartureCount = scene.storeOpen ? 1 : GAME_RULES.firstMoveRequirement;
  const cartReady =
    !scene.cartAtShelf &&
    !scene.movingCart &&
    scene.loadedProducts.length >= requiredDepartureCount;

  if (cartReady) {
    hideMissingGuide(state);
    if (state.phase !== "cart-ready") {
      state.phase = "cart-ready";
      showCartGuide(scene, state, "to-sales");
      scene.showTransientHint(
        scene.storeOpen
          ? "补货箱已装车。按住推车，穿过中间门口回到右侧卖场。"
          : "装货完成！按住推车，穿过中间门口拖到右侧卖场。"
      );
    }
    scene.hintText.setText("按住推车 → 穿过中间门口 → 拖到右侧卖场");
    return;
  }

  if (!scene.cartAtShelf) {
    hideCartGuide(scene, state);
    hideMissingGuide(state);
    state.phase = "loading";
    return;
  }

  const missingSlots = scene.shelfSlots.filter((slot) => !slot.product);
  const firstRestockable = missingSlots.find((slot) => scene.loadedProducts.includes(slot.productId));

  if (firstRestockable) {
    hideCartGuide(scene, state);
    if (
      state.phase !== "shelf-ready" ||
      state.highlightedMissing !== firstRestockable.missingTag
    ) {
      state.phase = "shelf-ready";
      showMissingGuide(scene, state, firstRestockable.missingTag);
      scene.showTransientHint("点击闪烁的 MISSING 货位，员工会从推车取对应商品补货。");
    }
    scene.hintText.setText("点击闪烁的 MISSING 货位开始补货");
    return;
  }

  if (missingSlots.length > 0) {
    hideMissingGuide(state);
    if (state.phase !== "return-cart") {
      state.phase = "return-cart";
      showCartGuide(scene, state, "to-warehouse");
      scene.showTransientHint("推车里没有对应商品。把推车拖回左侧仓库，装匹配的箱子再回来。");
    }
    scene.hintText.setText("没有匹配库存 → 把推车拖回左侧仓库补货");
    return;
  }

  hideCartGuide(scene, state);
  hideMissingGuide(state);
  state.phase = "done";
};

prototype.tryRestockSlot = function tryRestockSlotAndClearGuide(slot: ShelfSlotLike): void {
  const scene = this as unknown as SceneInternals;
  const state = (scene as unknown as { __nextStepGuide?: GuideState }).__nextStepGuide;

  const validGuidedRestock =
    state?.phase === "shelf-ready" &&
    slot.missingTag === state.highlightedMissing &&
    scene.cartAtShelf &&
    scene.loadedProducts.includes(slot.productId);

  if (validGuidedRestock && state) {
    hideMissingGuide(state);
    state.phase = "loading";
  }

  originalTryRestockSlot.call(this, slot);
};

function createGuideState(scene: SceneInternals): GuideState {
  const graphics = scene.add.graphics().setDepth(70).setVisible(false);
  const labelBg = scene.add.rectangle(0, 0, 330, 54, 0x17312a, 0.96)
    .setStrokeStyle(3, 0xffd75a)
    .setDepth(71)
    .setVisible(false);
  const label = scene.add.text(0, 0, "", {
    fontFamily: "Arial",
    fontSize: "22px",
    color: "#ffffff",
    fontStyle: "bold",
    align: "center"
  }).setOrigin(0.5).setDepth(72).setVisible(false);

  return {
    graphics,
    labelBg,
    label,
    phase: "loading"
  };
}

function showCartGuide(
  scene: SceneInternals,
  state: GuideState,
  direction: "to-sales" | "to-warehouse"
): void {
  hideMissingGuide(state);
  scene.tweens.killTweensOf(scene.cartSprite);
  scene.cartSprite.clearTint().setAlpha(1);

  state.graphics.clear();
  state.graphics.lineStyle(10, 0xffd75a, 0.95);
  state.graphics.beginPath();

  if (direction === "to-sales") {
    state.graphics.moveTo(scene.cart.x + 95, scene.cart.y - 65);
    state.graphics.lineTo(655, 760);
    state.graphics.lineTo(760, 760);
    state.graphics.strokePath();
    state.graphics.fillStyle(0xffd75a, 1);
    state.graphics.fillTriangle(775, 760, 742, 742, 742, 778);
    state.labelBg.setPosition(690, 700).setSize(330, 54).setVisible(true);
    state.label.setPosition(690, 700).setText("拖动推车到卖场 →").setVisible(true);
  } else {
    state.graphics.moveTo(scene.cart.x - 95, scene.cart.y - 65);
    state.graphics.lineTo(705, 760);
    state.graphics.lineTo(590, 760);
    state.graphics.strokePath();
    state.graphics.fillStyle(0xffd75a, 1);
    state.graphics.fillTriangle(575, 760, 608, 742, 608, 778);
    state.labelBg.setPosition(685, 700).setSize(360, 54).setVisible(true);
    state.label.setPosition(685, 700).setText("缺匹配商品，推回仓库 ←").setVisible(true);
  }

  state.graphics.setVisible(true);
  state.cartTween?.stop();
  state.cartTween = scene.tweens.add({
    targets: scene.cartSprite,
    alpha: 0.58,
    duration: 430,
    yoyo: true,
    repeat: -1,
    ease: "Sine.InOut"
  });
}

function hideCartGuide(scene: SceneInternals, state: GuideState): void {
  state.graphics.setVisible(false);
  state.labelBg.setVisible(false);
  state.label.setVisible(false);
  state.cartTween?.stop();
  state.cartTween = undefined;
  scene.tweens.killTweensOf(scene.cartSprite);
  scene.cartSprite.setAlpha(1).clearTint();
}

function showMissingGuide(
  scene: SceneInternals,
  state: GuideState,
  missingTag: Phaser.GameObjects.Image
): void {
  hideMissingGuide(state);
  state.highlightedMissing = missingTag;
  state.missingBaseScaleX = missingTag.scaleX;
  state.missingBaseScaleY = missingTag.scaleY;
  missingTag.setAlpha(1);

  state.labelBg.setPosition(missingTag.x, missingTag.y + 86).setSize(330, 54).setVisible(true);
  state.label.setPosition(missingTag.x, missingTag.y + 86).setText("点击这里补货 ↑").setVisible(true);

  state.missingTween = scene.tweens.add({
    targets: missingTag,
    alpha: 0.35,
    scaleX: state.missingBaseScaleX * 1.1,
    scaleY: state.missingBaseScaleY * 1.1,
    duration: 420,
    yoyo: true,
    repeat: -1,
    ease: "Sine.InOut"
  });
}

function hideMissingGuide(state: GuideState): void {
  state.missingTween?.stop();
  state.missingTween = undefined;

  if (state.highlightedMissing?.active) {
    state.highlightedMissing.setAlpha(1);
    if (state.missingBaseScaleX !== undefined && state.missingBaseScaleY !== undefined) {
      state.highlightedMissing.setScale(state.missingBaseScaleX, state.missingBaseScaleY);
    }
  }

  state.highlightedMissing = undefined;
  state.missingBaseScaleX = undefined;
  state.missingBaseScaleY = undefined;
}
