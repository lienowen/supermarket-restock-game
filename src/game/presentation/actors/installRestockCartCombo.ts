import Phaser from "phaser";
import type { RestockSceneSnapshot } from "../../application/RestockSceneController";
import { prepareTrimmedTexture } from "../assets/TrimmedTextureFactory";
import { ShiftHud, type ShiftHudCopy, type ShiftHudSnapshot } from "../ui/ShiftHud";
import { RestockActorView, type RestockActorViewConfig } from "./RestockActorView";

const FIRST_DELIVERY_LEVEL_ID = "starter-level-001";
const CART_OPEN_COMBO_SOURCE_KEY = "equipment-restock-cart-cola-open-combo-fixed-v1";
const CART_OPEN_COMBO_SOURCE_PATH = "assets/game/production-v3/level1-recut-fixed/cart-cola-open-combo.png";
const CART_OPEN_COMBO_CUT_KEY = "cut-restock-cart-cola-open-combo-fixed-v1";
const cartComboLoadingScenes = new WeakSet<Phaser.Scene>();

interface RestockActorInternals {
  readonly scene: Phaser.Scene;
  readonly config: RestockActorViewConfig;
  readonly cart: Phaser.GameObjects.Image;
  readonly cartFront: Phaser.GameObjects.Image;
  readonly cartShadow: Phaser.GameObjects.Ellipse;
  readonly caseBox: Phaser.GameObjects.Image;
}

const isFirstDelivery = (): boolean => (
  document.body.dataset.activeLevel === FIRST_DELIVERY_LEVEL_ID
);

const warmOpenCartCombo = (scene: Phaser.Scene): void => {
  if (
    scene.textures.exists(CART_OPEN_COMBO_SOURCE_KEY) ||
    cartComboLoadingScenes.has(scene)
  ) return;

  cartComboLoadingScenes.add(scene);
  scene.load.once("complete", () => cartComboLoadingScenes.delete(scene));
  scene.load.image(CART_OPEN_COMBO_SOURCE_KEY, CART_OPEN_COMBO_SOURCE_PATH);
  scene.load.start();
};

/**
 * The open-cart composite is only needed late in Level 1. Keep it out of the
 * cold homepage request set and warm it while the player is already pushing /
 * parking the cart so the open step normally finds the texture ready.
 */
const originalSync = RestockActorView.prototype.sync;
RestockActorView.prototype.sync = function syncFirstDeliveryCartCombo(
  this: RestockActorView,
  snapshot: RestockSceneSnapshot
): void {
  originalSync.call(this, snapshot);
  if (!isFirstDelivery()) return;

  const view = this as unknown as RestockActorInternals;
  const shouldWarmOpenCart = ["push", "park", "open", "restock"].includes(snapshot.step);
  if (shouldWarmOpenCart && !view.scene.textures.exists(CART_OPEN_COMBO_SOURCE_KEY)) {
    warmOpenCartCombo(view.scene);
  }

  const needsOpenCart = snapshot.step === "restock" || (
    snapshot.step === "open" && snapshot.boxOpened
  );
  if (!needsOpenCart || !view.scene.textures.exists(CART_OPEN_COMBO_SOURCE_KEY)) return;

  const textureKey = prepareTrimmedTexture(
    view.scene,
    CART_OPEN_COMBO_SOURCE_KEY,
    CART_OPEN_COMBO_CUT_KEY,
    10,
    false
  );
  const x = view.config.cartDestination.x;
  const y = view.config.cartDestination.y + 20;

  view.cart
    .setTexture(textureKey)
    .setOrigin(0.5, 0.96)
    .setDisplaySize(330, 344)
    .setPosition(x, y)
    .setAlpha(1)
    .setVisible(true);
  view.cartFront.setVisible(false);
  view.caseBox.setVisible(false).setAlpha(1);
  view.cartShadow
    .setPosition(x, y + 5)
    .setSize(205, 38)
    .setVisible(true);

  document.body.dataset.restockActorComposition = "routed-worker-open-cart-combo";
  document.body.dataset.restockLoadVisual = "routed-cart-composite";
};

const RESTOCK_STEP_PROGRESS: Readonly<Record<string, number>> = Object.freeze({
  collect: 1,
  load: 2,
  push: 3,
  park: 4,
  open: 5
});

const originalHudUpdate = ShiftHud.prototype.update;
ShiftHud.prototype.update = function updateWithWorkflowProgress(
  this: ShiftHud,
  snapshot: ShiftHudSnapshot,
  copy: ShiftHudCopy
): void {
  const stepNumber = isFirstDelivery()
    ? RESTOCK_STEP_PROGRESS[snapshot.step]
    : undefined;
  if (stepNumber !== undefined) {
    originalHudUpdate.call(this, {
      ...snapshot,
      stockedRows: stepNumber,
      totalRows: 5,
      progressUnit: "STEPS"
    }, copy);
    return;
  }
  originalHudUpdate.call(this, snapshot, copy);
};
