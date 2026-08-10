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

const FIRST_DELIVERY_LEVEL_ID = "starter-level-001";
const CART_OPEN_COMBO_SOURCE_KEY = "equipment-restock-cart-cola-open-combo-fixed-v1";
const CART_OPEN_COMBO_SOURCE_PATH = "assets/game/production-v3/level1-recut-fixed/cart-cola-open-combo.png";
const CART_OPEN_COMBO_CUT_KEY = "cut-restock-cart-cola-open-combo-fixed-v1";

interface RestockActorInternals {
  readonly scene: Phaser.Scene;
  readonly config: RestockActorViewConfig;
  readonly cart: Phaser.GameObjects.Image;
  readonly cartFront: Phaser.GameObjects.Image;
  readonly cartShadow: Phaser.GameObjects.Ellipse;
  readonly caseBox: Phaser.GameObjects.Image;
}

interface FirstDeliverySceneInternals {
  readonly context?: {
    readonly campaignLevel?: { readonly level?: { readonly id?: string } };
    readonly levelAssets?: {
      readonly product?: { readonly key: string; readonly path: string };
    };
  };
}

const isFirstDelivery = (): boolean => (
  document.body.dataset.activeLevel === FIRST_DELIVERY_LEVEL_ID
);

const isFirstDeliveryScene = (scene: StarterMarketScene): boolean => (
  (scene as unknown as FirstDeliverySceneInternals)
    .context?.campaignLevel?.level?.id === FIRST_DELIVERY_LEVEL_ID
);

/**
 * Level 1 originally used this installer as both an art patch and a gameplay
 * override. Mature pass keeps only the art responsibility here. The final open
 * cart composite and HD stock bottle are late-stage art, so they now begin
 * loading after the first playable frame instead of blocking initial preload.
 */
const originalCreate = StarterMarketScene.prototype.create;
StarterMarketScene.prototype.create = function createWithDeferredFirstDeliveryArt(
  this: StarterMarketScene
): void {
  originalCreate.call(this);
  if (!isFirstDeliveryScene(this)) return;

  const context = (this as unknown as FirstDeliverySceneInternals).context;
  const product = context?.levelAssets?.product;
  let queued = false;

  if (product && !this.textures.exists(product.key)) {
    this.load.image(product.key, product.path);
    queued = true;
  }
  if (!this.textures.exists(CART_OPEN_COMBO_SOURCE_KEY)) {
    this.load.image(CART_OPEN_COMBO_SOURCE_KEY, CART_OPEN_COMBO_SOURCE_PATH);
    queued = true;
  }

  if (!queued) {
    document.body.dataset.levelOneDeferredArt = "ready";
    return;
  }

  document.body.dataset.levelOneDeferredArt = "loading";
  this.load.once(Phaser.Loader.Events.COMPLETE, () => {
    if (!this.sys.isActive()) return;
    document.body.dataset.levelOneDeferredArt = "ready";
  });
  this.load.once(Phaser.Loader.Events.FILE_LOAD_ERROR, () => {
    document.body.dataset.levelOneDeferredArt = "error";
  });
  this.load.start();
};

const originalSync = RestockActorView.prototype.sync;
RestockActorView.prototype.sync = function syncFirstDeliveryCartCombo(
  this: RestockActorView,
  snapshot: RestockSceneSnapshot
): void {
  originalSync.call(this, snapshot);
  if (!isFirstDelivery()) return;

  const view = this as unknown as RestockActorInternals;
  const needsOpenCart = snapshot.step === "restock" || (
    snapshot.step === "open" && snapshot.boxOpened
  );

  if (needsOpenCart && view.scene.textures.exists(CART_OPEN_COMBO_SOURCE_KEY)) {
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
  }
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
