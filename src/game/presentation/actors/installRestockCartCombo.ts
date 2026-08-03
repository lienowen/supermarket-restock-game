import Phaser from "phaser";
import type { RestockSceneSnapshot } from "../../application/RestockSceneController";
import { prepareTrimmedTexture } from "../assets/TrimmedTextureFactory";
import { StarterMarketScene } from "../scenes/StarterMarketScene";
import {
  ShiftHud,
  type ShiftHudCopy,
  type ShiftHudSnapshot
} from "../ui/ShiftHud";
import {
  RestockActorView,
  type RestockActorViewConfig
} from "./RestockActorView";

const CART_OPEN_COMBO_SOURCE_KEY = "equipment-restock-cart-cola-open-combo-v3";
const CART_OPEN_COMBO_SOURCE_PATH = "assets/game/production-v3/cooler-restock/cart_cola_open_combo.png";
const CART_OPEN_COMBO_CUT_KEY = "cut-restock-cart-cola-open-combo-v3";

interface RestockActorInternals {
  readonly scene: Phaser.Scene;
  readonly config: RestockActorViewConfig;
  readonly cart: Phaser.GameObjects.Image;
  readonly cartFront: Phaser.GameObjects.Image;
  readonly cartShadow: Phaser.GameObjects.Ellipse;
  readonly caseBox: Phaser.GameObjects.Image;
}

const originalPreload = StarterMarketScene.prototype.preload;
StarterMarketScene.prototype.preload = function preloadWithOpenCartCombo(
  this: StarterMarketScene
): void {
  originalPreload.call(this);
  if (!this.textures.exists(CART_OPEN_COMBO_SOURCE_KEY)) {
    this.load.image(CART_OPEN_COMBO_SOURCE_KEY, CART_OPEN_COMBO_SOURCE_PATH);
  }
};

const originalSync = RestockActorView.prototype.sync;
RestockActorView.prototype.sync = function syncWithBakedOpenCart(
  this: RestockActorView,
  snapshot: RestockSceneSnapshot
): void {
  originalSync.call(this, snapshot);

  const view = this as unknown as RestockActorInternals;
  const isColaDelivery = view.config.caseAssetKey === "prop-cola-case-closed";
  const needsOpenCart = snapshot.step === "restock" || (
    snapshot.step === "open" && snapshot.boxOpened
  );
  if (
    !isColaDelivery ||
    !needsOpenCart ||
    !view.scene.textures.exists(CART_OPEN_COMBO_SOURCE_KEY)
  ) return;

  const textureKey = prepareTrimmedTexture(
    view.scene,
    CART_OPEN_COMBO_SOURCE_KEY,
    CART_OPEN_COMBO_CUT_KEY,
    10,
    true
  );
  const x = view.config.cartDestination.x - 265;
  const y = view.config.cartDestination.y + 28;

  view.cart
    .setTexture(textureKey)
    .setOrigin(0.5, 0.96)
    .setDisplaySize(330, 394)
    .setPosition(x, y)
    .setAlpha(1)
    .setVisible(true);
  view.cartFront.setVisible(false);
  view.caseBox.setVisible(false).setAlpha(1);
  view.cartShadow
    .setPosition(x, y + 5)
    .setSize(205, 38)
    .setVisible(true);

  document.body.dataset.restockActorComposition = "baked-cart-open-case";
  document.body.dataset.restockLoadVisual = "single-composite-texture";
};

const RESTOCK_STEP_PROGRESS: Readonly<Record<string, number>> = Object.freeze({
  collect: 1,
  load: 2,
  push: 3,
  park: 3,
  open: 4
});

const originalHudUpdate = ShiftHud.prototype.update;
ShiftHud.prototype.update = function updateWithWorkflowProgress(
  this: ShiftHud,
  snapshot: ShiftHudSnapshot,
  copy: ShiftHudCopy
): void {
  const stepNumber = document.body.dataset.activeMode === "restock"
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
