import Phaser from "phaser";
import type { RestockSceneSnapshot } from "../../application/RestockSceneController";
import { prepareTrimmedTexture } from "../assets/TrimmedTextureFactory";
import { RestockActorView } from "./RestockActorView";

const FIRST_DELIVERY_LEVEL_ID = "starter-level-001";

interface WorkerTextureInternals {
  readonly workerIdleCut: string;
  readonly workerPush: string;
  readonly workerCarry: string;
  readonly workerOpen: string;
  readonly workerStock: string;
}

interface WorkerNavigationInternals {
  snapshot(): { readonly moving: boolean };
  setTexture(assetKey: string): void;
  setDisplaySize(width: number, height: number): void;
}

interface RestockActorInternals {
  readonly scene: Phaser.Scene;
  readonly textures: WorkerTextureInternals;
  readonly navigation: WorkerNavigationInternals;
}

interface PosePresentation {
  readonly sourceKey: string;
  readonly aliasKey: string;
  readonly width: number;
  readonly height: number;
}

const isFirstDelivery = (): boolean => (
  document.body.dataset.activeLevel === FIRST_DELIVERY_LEVEL_ID
);

const resolvePose = (
  view: RestockActorInternals,
  step: RestockSceneSnapshot["step"]
): PosePresentation => {
  switch (step) {
    case "load":
      return {
        sourceKey: view.textures.workerCarry,
        aliasKey: "cut-level-one-worker-carry-matte-clean-v2",
        width: 205,
        height: 300
      };
    case "push":
    case "park":
      return {
        sourceKey: view.textures.workerPush,
        aliasKey: "cut-level-one-worker-push-matte-clean-v2",
        width: 220,
        height: 300
      };
    case "open":
      return {
        sourceKey: view.textures.workerOpen,
        aliasKey: "cut-level-one-worker-open-matte-clean-v2",
        width: 202,
        height: 300
      };
    case "restock":
      return {
        sourceKey: view.textures.workerStock,
        aliasKey: "cut-level-one-worker-stock-matte-clean-v2",
        width: 174,
        height: 300
      };
    case "collect":
    case "complete":
      return {
        sourceKey: view.textures.workerIdleCut,
        aliasKey: "cut-level-one-worker-idle-matte-clean-v2",
        width: 190,
        height: 300
      };
  }
};

const originalSync = RestockActorView.prototype.sync;

RestockActorView.prototype.sync = function syncWithCleanWorkerMatte(
  this: RestockActorView,
  snapshot: RestockSceneSnapshot
): void {
  originalSync.call(this, snapshot);
  if (!isFirstDelivery()) return;

  const view = this as unknown as RestockActorInternals;
  const moving = view.navigation.snapshot().moving;

  // Walking to the case or carrying the case toward the cart must keep the
  // live walk frames chosen by RestockActorView. The cleanup installer is only
  // allowed to replace stable action poses; push is itself a moving action pose.
  if (moving && (snapshot.step === "collect" || snapshot.step === "load")) {
    document.body.dataset.levelOneWorkerMatte = "deferred-during-walk";
    return;
  }

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
  document.body.dataset.levelOneWorkerMatte = "connected-edge-clean-v2";
};
