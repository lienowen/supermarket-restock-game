import Phaser from "phaser";
import type {
  NavigationPoint,
  PlayerNavigationSnapshot
} from "../../application/PlayerNavigationController";
import type {
  RestockSceneAction,
  RestockSceneSnapshot
} from "../../application/RestockSceneController";
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

const CART_OPEN_COMBO_SOURCE_KEY = "equipment-restock-cart-cola-open-combo-fixed-v1";
const CART_OPEN_COMBO_SOURCE_PATH = "assets/game/production-v3/level1-recut-fixed/cart-cola-open-combo.png";
const CART_OPEN_COMBO_CUT_KEY = "cut-restock-cart-cola-open-combo-fixed-v1";
const PUSH_CART_OFFSET_X = -265;
const PUSH_CART_OFFSET_Y = 20;

interface RestockTextureInternals {
  readonly workerIdleCut: string;
  readonly workerWalk: readonly [string, string];
  readonly workerPush: string;
  readonly workerCarry: string;
  readonly workerOpen: string;
  readonly workerStock: string;
}

interface NavigationInternals {
  readonly config: {
    walkAssetKeys?: readonly [string, string];
  };
  update(deltaMs: number): void;
  snapshot(): PlayerNavigationSnapshot;
  position(): NavigationPoint;
  isNear(point: NavigationPoint, radius: number): boolean;
  setPosition(point: NavigationPoint): void;
  setDestination(point: NavigationPoint): void;
  setTexture(assetKey: string): void;
  setDisplaySize(width: number, height: number): void;
  setVisible(visible: boolean): void;
  setEnabled(enabled: boolean): void;
}

interface RestockActorInternals {
  readonly scene: Phaser.Scene;
  readonly config: RestockActorViewConfig;
  readonly textures: RestockTextureInternals;
  readonly navigation: NavigationInternals;
  readonly cart: Phaser.GameObjects.Image;
  readonly cartFront: Phaser.GameObjects.Image;
  readonly cartShadow: Phaser.GameObjects.Ellipse;
  readonly caseBox: Phaser.GameObjects.Image;
  readonly handProduct: Phaser.GameObjects.Image;
  readonly loadDropZone: Phaser.GameObjects.Rectangle;
}

interface RestockActorPrototypeInternals {
  placeWorkerAtRestockStation(this: RestockActorView): void;
  setStableWorker(this: RestockActorView): void;
}

interface StarterMarketSceneInternals {
  readonly controller: StarterMarketScene["controller"];
  readonly context: {
    readonly world: {
      readonly cartStart: NavigationPoint;
      readonly cartCooler: NavigationPoint;
    };
  };
  actors?: RestockActorView;
  pendingAction: boolean;
  canInteract(snapshot: RestockSceneSnapshot): boolean;
  dispatchSceneAction(action: RestockSceneAction, feedback?: boolean): boolean;
}

interface StarterMarketScenePrototypeInternals {
  performCurrentAction(this: StarterMarketScene): void;
}

const actorSteps = new WeakMap<RestockActorView, RestockSceneSnapshot["step"]>();
const initializedActors = new WeakSet<RestockActorView>();

const actorPrototype = RestockActorView.prototype as unknown as RestockActorPrototypeInternals;
actorPrototype.placeWorkerAtRestockStation = function keepNavigationPosition(): void {
  // First Delivery now uses the configured navigation path instead of snapping
  // the worker back to a fixed foreground position every frame.
};
actorPrototype.setStableWorker = function keepCurrentWorkerPosition(
  this: RestockActorView
): void {
  const view = this as unknown as RestockActorInternals;
  view.navigation.setTexture(view.textures.workerIdleCut);
  view.navigation.setDisplaySize(190, 300);
  view.navigation.setVisible(true);
};

const originalPreload = StarterMarketScene.prototype.preload;
StarterMarketScene.prototype.preload = function preloadWithOpenCartCombo(
  this: StarterMarketScene
): void {
  originalPreload.call(this);
  if (!this.textures.exists(CART_OPEN_COMBO_SOURCE_KEY)) {
    this.load.image(CART_OPEN_COMBO_SOURCE_KEY, CART_OPEN_COMBO_SOURCE_PATH);
  }
};

RestockActorView.prototype.position = function navigationPosition(
  this: RestockActorView
): NavigationPoint {
  return (this as unknown as RestockActorInternals).navigation.position();
};

RestockActorView.prototype.isNear = function navigationIsNear(
  this: RestockActorView,
  point: NavigationPoint,
  radius: number
): boolean {
  return (this as unknown as RestockActorInternals).navigation.isNear(point, radius);
};

RestockActorView.prototype.setDestination = function navigateToTarget(
  this: RestockActorView,
  point: NavigationPoint
): void {
  const view = this as unknown as RestockActorInternals;
  view.navigation.setEnabled(true);
  view.navigation.setDestination(point);
};

RestockActorView.prototype.update = function updateNavigationAndCart(
  this: RestockActorView,
  deltaMs: number
): void {
  const view = this as unknown as RestockActorInternals;
  view.navigation.update(deltaMs);

  const step = actorSteps.get(this);
  if (step !== "push" && step !== "park") return;

  const worker = view.navigation.position();
  const cartX = worker.x + PUSH_CART_OFFSET_X;
  const cartY = worker.y + PUSH_CART_OFFSET_Y;
  view.cart.setPosition(cartX, cartY);
  view.cartShadow.setPosition(cartX, cartY + 5);
};

const originalSync = RestockActorView.prototype.sync;
RestockActorView.prototype.sync = function syncWithGuidedMovementAndOpenCart(
  this: RestockActorView,
  snapshot: RestockSceneSnapshot
): void {
  const view = this as unknown as RestockActorInternals;
  if (!initializedActors.has(this)) {
    initializedActors.add(this);
    view.navigation.config.walkAssetKeys = view.textures.workerWalk;
    view.navigation.setEnabled(true);
    view.navigation.setPosition(view.config.workerStart);
  }

  actorSteps.set(this, snapshot.step);
  originalSync.call(this, snapshot);

  switch (snapshot.step) {
    case "collect":
      view.navigation.setTexture(view.textures.workerIdleCut);
      view.navigation.setDisplaySize(190, 300);
      break;
    case "load":
      view.navigation.setTexture(view.textures.workerCarry);
      view.navigation.setDisplaySize(218, 300);
      view.caseBox.setVisible(false);
      break;
    case "push":
    case "park": {
      view.navigation.setTexture(view.textures.workerPush);
      view.navigation.setDisplaySize(226, 300);
      const worker = view.navigation.position();
      const cartX = worker.x + PUSH_CART_OFFSET_X;
      const cartY = worker.y + PUSH_CART_OFFSET_Y;
      view.cart.setPosition(cartX, cartY);
      view.cartShadow.setPosition(cartX, cartY + 5);
      break;
    }
    case "open":
      view.navigation.setTexture(view.textures.workerOpen);
      view.navigation.setDisplaySize(202, 300);
      break;
    case "restock":
      view.navigation.setTexture(view.textures.workerStock);
      view.navigation.setDisplaySize(174, 300);
      break;
    case "complete":
      view.navigation.setTexture(view.textures.workerIdleCut);
      view.navigation.setDisplaySize(190, 300);
      break;
  }

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
    false
  );
  const x = view.config.cartDestination.x - 265;
  const y = view.config.cartDestination.y + 28;

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

  document.body.dataset.restockActorComposition = "baked-cart-open-case-fixed";
  document.body.dataset.restockActorControl = "guided-path-movement";
  document.body.dataset.restockLoadVisual = "single-composite-texture";
};

const scenePrototype = StarterMarketScene.prototype as unknown as StarterMarketScenePrototypeInternals;
scenePrototype.performCurrentAction = function performSeparatedRestockStep(
  this: StarterMarketScene
): void {
  const scene = this as unknown as StarterMarketSceneInternals;
  const snapshot = scene.controller.snapshot();
  if (!scene.canInteract(snapshot)) return;

  const action = scene.controller.actionForCurrentStep();
  if (!action || action === "RESTOCK_ROW" || !scene.dispatchSceneAction(action)) return;

  switch (action) {
    case "PICK_BOX":
      scene.pendingAction = false;
      scene.actors?.setDestination(scene.context.world.cartStart);
      return;
    case "LOAD_CART":
      scene.pendingAction = false;
      return;
    case "PUSH_CART":
      scene.pendingAction = false;
      scene.actors?.setDestination(scene.context.world.cartCooler);
      return;
    case "PARK_CART":
    case "OPEN_BOX":
      scene.pendingAction = false;
      return;
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
