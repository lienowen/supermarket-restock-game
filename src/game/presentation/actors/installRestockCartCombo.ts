import Phaser from "phaser";
import type { NavigationPoint } from "../../application/PlayerNavigationController";
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

const FIRST_DELIVERY_LEVEL_ID = "starter-level-001";
const FIRST_DELIVERY_WORKER_POSITION: NavigationPoint = Object.freeze({ x: 660, y: 790 });
const CART_OPEN_COMBO_SOURCE_KEY = "equipment-restock-cart-cola-open-combo-fixed-v1";
const CART_OPEN_COMBO_SOURCE_PATH = "assets/game/production-v3/level1-recut-fixed/cart-cola-open-combo.png";
const CART_OPEN_COMBO_CUT_KEY = "cut-restock-cart-cola-open-combo-fixed-v1";

interface RestockTextureInternals {
  readonly workerIdleCut: string;
  readonly workerPush: string;
  readonly workerCarry: string;
  readonly workerOpen: string;
  readonly workerStock: string;
}

interface NavigationInternals {
  setPosition(point: NavigationPoint): void;
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
}

interface RestockActorPrototypeInternals {
  placeWorkerAtRestockStation(this: RestockActorView): void;
  setStableWorker(this: RestockActorView): void;
}

interface StarterMarketSceneInternals {
  readonly controller: StarterMarketScene["controller"];
  pendingAction: boolean;
  canInteract(snapshot: RestockSceneSnapshot): boolean;
  dispatchSceneAction(action: RestockSceneAction, feedback?: boolean): boolean;
}

interface StarterMarketScenePrototypeInternals {
  performCurrentAction(this: StarterMarketScene): void;
}

const isFirstDelivery = (): boolean => (
  document.body.dataset.activeLevel === FIRST_DELIVERY_LEVEL_ID
);

const placeFirstDeliveryWorkerOnFloor = (view: RestockActorInternals): void => {
  view.navigation.setEnabled(false);
  view.navigation.setPosition(FIRST_DELIVERY_WORKER_POSITION);
  view.navigation.setVisible(true);
};

const actorPrototype = RestockActorView.prototype as unknown as RestockActorPrototypeInternals;
const originalPlaceWorkerAtRestockStation = actorPrototype.placeWorkerAtRestockStation;
const originalSetStableWorker = actorPrototype.setStableWorker;

actorPrototype.placeWorkerAtRestockStation = function keepWorkerOnFloor(
  this: RestockActorView
): void {
  if (!isFirstDelivery()) {
    originalPlaceWorkerAtRestockStation.call(this);
    return;
  }
  placeFirstDeliveryWorkerOnFloor(this as unknown as RestockActorInternals);
};

actorPrototype.setStableWorker = function setFixedFirstDeliveryWorker(
  this: RestockActorView
): void {
  if (!isFirstDelivery()) {
    originalSetStableWorker.call(this);
    return;
  }
  const view = this as unknown as RestockActorInternals;
  placeFirstDeliveryWorkerOnFloor(view);
  view.navigation.setTexture(view.textures.workerIdleCut);
  view.navigation.setDisplaySize(190, 300);
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

const originalPosition = RestockActorView.prototype.position;
RestockActorView.prototype.position = function fixedFirstDeliveryPosition(
  this: RestockActorView
): NavigationPoint {
  return isFirstDelivery()
    ? FIRST_DELIVERY_WORKER_POSITION
    : originalPosition.call(this);
};

const originalIsNear = RestockActorView.prototype.isNear;
RestockActorView.prototype.isNear = function simpleFirstDeliveryInteraction(
  this: RestockActorView,
  point: NavigationPoint,
  radius: number
): boolean {
  return isFirstDelivery() ? true : originalIsNear.call(this, point, radius);
};

const originalSetDestination = RestockActorView.prototype.setDestination;
RestockActorView.prototype.setDestination = function ignoreFirstDeliveryNavigation(
  this: RestockActorView,
  point: NavigationPoint
): void {
  if (!isFirstDelivery()) {
    originalSetDestination.call(this, point);
    return;
  }
  placeFirstDeliveryWorkerOnFloor(this as unknown as RestockActorInternals);
};

const originalUpdate = RestockActorView.prototype.update;
RestockActorView.prototype.update = function keepFirstDeliveryStatic(
  this: RestockActorView,
  deltaMs: number
): void {
  if (!isFirstDelivery()) {
    originalUpdate.call(this, deltaMs);
    return;
  }
  placeFirstDeliveryWorkerOnFloor(this as unknown as RestockActorInternals);
};

const originalSync = RestockActorView.prototype.sync;
RestockActorView.prototype.sync = function syncSimpleFirstDeliveryPoses(
  this: RestockActorView,
  snapshot: RestockSceneSnapshot
): void {
  if (!isFirstDelivery()) {
    originalSync.call(this, snapshot);
    return;
  }

  const view = this as unknown as RestockActorInternals;
  originalSync.call(this, snapshot);
  placeFirstDeliveryWorkerOnFloor(view);

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
    case "park":
      view.navigation.setTexture(view.textures.workerPush);
      view.navigation.setDisplaySize(226, 300);
      break;
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
  }

  document.body.dataset.restockActorComposition = "baked-cart-open-case-fixed";
  document.body.dataset.restockActorControl = "simple-fixed-action-poses";
  document.body.dataset.restockLoadVisual = "single-composite-texture";
};

const scenePrototype = StarterMarketScene.prototype as unknown as StarterMarketScenePrototypeInternals;
const originalPerformCurrentAction = scenePrototype.performCurrentAction;
scenePrototype.performCurrentAction = function performSimpleFirstDeliveryStep(
  this: StarterMarketScene
): void {
  if (!isFirstDelivery()) {
    originalPerformCurrentAction.call(this);
    return;
  }

  const scene = this as unknown as StarterMarketSceneInternals;
  const snapshot = scene.controller.snapshot();
  if (!scene.canInteract(snapshot)) return;

  const action = scene.controller.actionForCurrentStep();
  if (!action || action === "RESTOCK_ROW" || !scene.dispatchSceneAction(action)) return;
  scene.pendingAction = false;
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
