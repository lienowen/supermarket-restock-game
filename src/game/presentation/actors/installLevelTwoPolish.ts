import Phaser from "phaser";
import type { NavigationPoint } from "../../application/PlayerNavigationController";
import type {
  RestockSceneAction,
  RestockSceneSnapshot
} from "../../application/RestockSceneController";
import { prepareTrimmedTexture } from "../assets/TrimmedTextureFactory";
import { StarterMarketScene } from "../scenes/StarterMarketScene";
import {
  RestockActorView,
  type RestockActorViewConfig
} from "./RestockActorView";

const PROMOTION_RESTOCK_LEVEL_ID = "starter-level-002";
const WATER_PRODUCT_KEY = "product-water-bottle";
const FIXED_WORKER_POSITION: NavigationPoint = Object.freeze({ x: 660, y: 790 });

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
  readonly caseBox: Phaser.GameObjects.Image;
  readonly handProduct: Phaser.GameObjects.Image;
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

interface PosePresentation {
  readonly sourceKey: string;
  readonly aliasKey: string;
  readonly width: number;
  readonly height: number;
}

const waterBottleSets = new WeakMap<RestockActorView, Phaser.GameObjects.Image[]>();

const isPromotionRestock = (): boolean => (
  document.body.dataset.activeLevel === PROMOTION_RESTOCK_LEVEL_ID
);

const resolvePose = (
  view: RestockActorInternals,
  step: RestockSceneSnapshot["step"]
): PosePresentation => {
  switch (step) {
    case "load":
      return {
        sourceKey: view.textures.workerCarry,
        aliasKey: "cut-level-two-worker-carry-clean-v1",
        width: 218,
        height: 300
      };
    case "push":
    case "park":
      return {
        sourceKey: view.textures.workerPush,
        aliasKey: "cut-level-two-worker-push-clean-v1",
        width: 226,
        height: 300
      };
    case "open":
      return {
        sourceKey: view.textures.workerOpen,
        aliasKey: "cut-level-two-worker-open-clean-v1",
        width: 202,
        height: 300
      };
    case "restock":
      return {
        sourceKey: view.textures.workerStock,
        aliasKey: "cut-level-two-worker-stock-clean-v1",
        width: 174,
        height: 300
      };
    case "collect":
    case "complete":
      return {
        sourceKey: view.textures.workerIdleCut,
        aliasKey: "cut-level-two-worker-idle-clean-v1",
        width: 190,
        height: 300
      };
  }
};

const ensureWaterBottles = (
  actor: RestockActorView,
  view: RestockActorInternals
): Phaser.GameObjects.Image[] => {
  const existing = waterBottleSets.get(actor);
  if (existing) return existing;
  if (!view.scene.textures.exists(WATER_PRODUCT_KEY)) return [];

  const bottles = [-24, 0, 24].map((offsetX, index) => (
    view.scene.add.image(
      view.config.cartDestination.x - 265 + offsetX,
      view.config.cartDestination.y - 66 - (index === 1 ? 5 : 0),
      WATER_PRODUCT_KEY
    )
      .setOrigin(0.5, 1)
      .setDisplaySize(20, 54)
      .setDepth(23)
      .setVisible(false)
      .setName(`level-two-open-water-bottle-${index + 1}`)
  ));
  waterBottleSets.set(actor, bottles);
  return bottles;
};

const syncWaterBottles = (
  actor: RestockActorView,
  view: RestockActorInternals,
  visible: boolean
): void => {
  const bottles = ensureWaterBottles(actor, view);
  bottles.forEach((bottle, index) => {
    bottle
      .setPosition(
        view.config.cartDestination.x - 265 + (index - 1) * 24,
        view.config.cartDestination.y - 66 - (index === 1 ? 5 : 0)
      )
      .setVisible(visible);
  });
};

const originalSync = RestockActorView.prototype.sync;
RestockActorView.prototype.sync = function syncPromotionRestockPoses(
  this: RestockActorView,
  snapshot: RestockSceneSnapshot
): void {
  originalSync.call(this, snapshot);
  if (!isPromotionRestock()) return;

  const view = this as unknown as RestockActorInternals;
  view.navigation.setEnabled(false);
  view.navigation.setPosition(FIXED_WORKER_POSITION);
  view.navigation.setVisible(true);

  const pose = resolvePose(view, snapshot.step);
  const cleanedTexture = prepareTrimmedTexture(
    view.scene,
    pose.sourceKey,
    pose.aliasKey,
    3,
    true
  );
  view.navigation.setTexture(cleanedTexture);
  view.navigation.setDisplaySize(pose.width, pose.height);

  const stocking = snapshot.step === "restock";
  if (stocking && view.scene.textures.exists(WATER_PRODUCT_KEY)) {
    view.handProduct
      .setTexture(WATER_PRODUCT_KEY)
      .setDisplaySize(21, 54)
      .setVisible(true);
    view.caseBox.setVisible(false);
  }
  syncWaterBottles(this, view, stocking);

  document.body.dataset.levelTwoActorControl = "fixed-action-poses";
  document.body.dataset.levelTwoProductVisual = "water-bottle-only";
};

const scenePrototype = StarterMarketScene.prototype as unknown as StarterMarketScenePrototypeInternals;
const originalPerformCurrentAction = scenePrototype.performCurrentAction;
scenePrototype.performCurrentAction = function performOnePromotionStep(
  this: StarterMarketScene
): void {
  if (!isPromotionRestock()) {
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
