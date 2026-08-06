import Phaser from "phaser";
import type { NavigationPoint } from "../../application/PlayerNavigationController";
import type {
  RestockSceneAction,
  RestockSceneSnapshot
} from "../../application/RestockSceneController";
import { prepareTrimmedTexture } from "../assets/TrimmedTextureFactory";
import { playActionFeedback } from "../effects/ActionFeedback";
import {
  IntegratedBeverageCoolerView,
  type BeverageCoolerViewConfig,
  type CoolerStockPoint
} from "../fixtures/IntegratedBeverageCoolerView";
import { StarterMarketScene } from "../scenes/StarterMarketScene";
import {
  LevelCompleteOverlay,
  type LevelCompleteOverlayConfig
} from "../ui/LevelCompleteOverlay";
import {
  RestockActorView,
  type RestockActorViewConfig
} from "./RestockActorView";

const PROMOTION_RESTOCK_LEVEL_ID = "starter-level-002";
const WATER_PRODUCT_KEY = "product-water-bottle";
const COOLER_PRODUCT_ALIAS = "restock-cola-bottle-hd-v2";
const FIXED_WORKER_POSITION: NavigationPoint = Object.freeze({ x: 660, y: 790 });
const SLOT_WIDTH = 230;
const SLOT_HEIGHT = 112;
const BASE_DEPTH = 20;
const LEVEL_TWO_RESULTS_DELAY_MS = 1120;

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

interface CoolerSlot extends CoolerStockPoint {
  readonly shelfIndex: number;
}

interface CoolerInternals {
  readonly scene: Phaser.Scene;
  readonly config: BeverageCoolerViewConfig;
  readonly slots: readonly CoolerSlot[];
  readonly rowHolders: Phaser.GameObjects.Container[];
  itemLocalPosition(rowIndex: number, itemIndex: number): CoolerStockPoint;
  playItemLanding(point: CoolerStockPoint): void;
}

interface CoolerPrototypeInternals {
  createStockBottle(
    this: IntegratedBeverageCoolerView,
    rowIndex: number,
    itemIndex: number,
    animate: boolean
  ): Phaser.GameObjects.Image;
  animateFilledRow(this: IntegratedBeverageCoolerView, rowIndex: number): void;
  showMistake(this: IntegratedBeverageCoolerView, rowIndex: number): void;
}

interface LevelCompleteOverlayInternals {
  config: LevelCompleteOverlayConfig;
}

const waterBottleSets = new WeakMap<RestockActorView, Phaser.GameObjects.Image[]>();
const promotionStreaks = new WeakMap<IntegratedBeverageCoolerView, number>();

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

const coolerPrototype = IntegratedBeverageCoolerView.prototype as unknown as CoolerPrototypeInternals;
const originalCreateStockBottle = coolerPrototype.createStockBottle;
const originalAnimateFilledRow = coolerPrototype.animateFilledRow;
const originalShowMistake = coolerPrototype.showMistake;

coolerPrototype.createStockBottle = function createStaggeredWaterBottle(
  this: IntegratedBeverageCoolerView,
  rowIndex: number,
  itemIndex: number,
  animate: boolean
): Phaser.GameObjects.Image {
  if (!isPromotionRestock() || !animate) {
    return originalCreateStockBottle.call(this, rowIndex, itemIndex, animate);
  }

  const view = this as unknown as CoolerInternals;
  const holder = view.rowHolders[rowIndex];
  const slot = view.slots[rowIndex];
  if (!holder || !slot || !view.scene.textures.exists(COOLER_PRODUCT_ALIAS)) {
    return originalCreateStockBottle.call(this, rowIndex, itemIndex, animate);
  }

  const localTarget = view.itemLocalPosition(rowIndex, itemIndex);
  const bottleHeight = Phaser.Math.Linear(76, 90, slot.shelfIndex / 2);
  const sourceX = view.config.stockSource.x - 18 + (itemIndex - 1) * 11;
  const sourceY = view.config.stockSource.y - 96;
  const bottle = view.scene.add.image(sourceX, sourceY, COOLER_PRODUCT_ALIAS)
    .setOrigin(0.5, 1)
    .setDisplaySize(36, bottleHeight)
    .setAlpha(0.7)
    .setDepth(BASE_DEPTH + 3)
    .setAngle((itemIndex - 1) * -4)
    .setName(`beverage-cooler-row-${rowIndex}-item-${itemIndex}`);

  const targetScaleX = bottle.scaleX;
  const targetScaleY = bottle.scaleY;
  bottle.setScale(targetScaleX * 0.68, targetScaleY * 0.68);

  const worldTarget = {
    x: slot.x + localTarget.x,
    y: slot.y + localTarget.y
  };
  const liftY = Math.min(sourceY - 68, worldTarget.y - 82);
  const delay = itemIndex * 82;

  view.scene.tweens.add({
    targets: bottle,
    x: worldTarget.x,
    y: liftY,
    alpha: 1,
    angle: 0,
    scaleX: targetScaleX * 0.92,
    scaleY: targetScaleY * 0.92,
    delay,
    duration: 170,
    ease: "Quad.Out",
    onComplete: () => {
      view.scene.tweens.add({
        targets: bottle,
        y: worldTarget.y,
        scaleX: targetScaleX,
        scaleY: targetScaleY,
        duration: 125,
        ease: "Back.Out",
        onComplete: () => {
          holder.add(bottle);
          bottle.setPosition(localTarget.x, localTarget.y).setDepth(0);
          view.playItemLanding(worldTarget);
        }
      });
    }
  });

  document.body.dataset.levelTwoBottleAnimation = "water-three-step-stagger";
  return bottle;
};

coolerPrototype.showMistake = function showPromotionMistake(
  this: IntegratedBeverageCoolerView,
  rowIndex: number
): void {
  originalShowMistake.call(this, rowIndex);
  if (!isPromotionRestock()) return;
  promotionStreaks.set(this, 0);
  const view = this as unknown as CoolerInternals;
  const slot = view.slots[rowIndex];
  if (slot) {
    playActionFeedback(
      view.scene,
      { x: slot.x, y: slot.y - 52 },
      "mistake",
      { label: "ORDER STAYS THE SAME", emphasis: 1.06 }
    );
  }
  document.body.dataset.levelTwoMistakeRule = "keep-sequence-reset-combo";
};

coolerPrototype.animateFilledRow = function animatePromotionMemorySuccess(
  this: IntegratedBeverageCoolerView,
  rowIndex: number
): void {
  originalAnimateFilledRow.call(this, rowIndex);
  if (!isPromotionRestock()) return;

  const view = this as unknown as CoolerInternals;
  const slot = view.slots[rowIndex];
  if (!slot) return;

  const streak = (promotionStreaks.get(this) ?? 0) + 1;
  promotionStreaks.set(this, streak);

  const flash = view.scene.add.graphics().setDepth(BASE_DEPTH + 10);
  flash.fillStyle(0x75d9ff, 0.13);
  flash.fillRoundedRect(
    slot.x - SLOT_WIDTH / 2,
    slot.y - SLOT_HEIGHT / 2,
    SLOT_WIDTH,
    SLOT_HEIGHT,
    12
  );
  flash.lineStyle(5, 0x9be7ff, 0.96);
  flash.strokeRoundedRect(
    slot.x - SLOT_WIDTH / 2,
    slot.y - SLOT_HEIGHT / 2,
    SLOT_WIDTH,
    SLOT_HEIGHT,
    12
  );

  const badgeLabel = streak === 1 ? "CORRECT · 1/6" : `MEMORY x${streak}`;
  const badge = view.scene.add.text(
    slot.x,
    slot.y - SLOT_HEIGHT / 2 + 8,
    badgeLabel,
    {
      fontFamily: "Arial, sans-serif",
      fontSize: streak >= 4 ? "18px" : "16px",
      fontStyle: "bold",
      color: "#0d2a35",
      backgroundColor: "#9be7ff",
      padding: { x: 10, y: 5 }
    }
  )
    .setOrigin(0.5, 0)
    .setDepth(BASE_DEPTH + 11)
    .setScale(0.62)
    .setAlpha(0);

  view.scene.tweens.add({
    targets: flash,
    alpha: 0,
    duration: 620,
    ease: "Quad.Out",
    onComplete: () => flash.destroy()
  });
  view.scene.tweens.add({
    targets: badge,
    alpha: 1,
    scaleX: 1,
    scaleY: 1,
    duration: 170,
    hold: 430,
    yoyo: true,
    ease: "Back.Out",
    onComplete: () => badge.destroy()
  });

  if (streak >= 3) {
    view.scene.cameras.main.flash(80, 117, 217, 255, false);
  }
  if (streak === 6) {
    const coolerGlow = view.scene.add.graphics().setDepth(BASE_DEPTH + 20);
    coolerGlow.fillStyle(0x75d9ff, 0.11);
    coolerGlow.fillRoundedRect(760, 250, 570, 430, 24);
    coolerGlow.lineStyle(8, 0x9be7ff, 0.92);
    coolerGlow.strokeRoundedRect(760, 250, 570, 430, 24);

    const readyLabel = view.scene.add.text(1045, 470, "PROMOTION READY", {
      fontFamily: "Arial, sans-serif",
      fontSize: "34px",
      fontStyle: "bold",
      color: "#0d2a35",
      backgroundColor: "#9be7ff",
      padding: { x: 18, y: 10 }
    })
      .setOrigin(0.5)
      .setDepth(BASE_DEPTH + 21)
      .setScale(0.72)
      .setAlpha(0);

    view.scene.tweens.add({
      targets: coolerGlow,
      alpha: 0,
      duration: 980,
      ease: "Quad.Out",
      onComplete: () => coolerGlow.destroy()
    });
    view.scene.tweens.add({
      targets: readyLabel,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 220,
      hold: 520,
      yoyo: true,
      ease: "Back.Out",
      onComplete: () => readyLabel.destroy()
    });
    view.scene.cameras.main.flash(180, 117, 217, 255, false);
    document.body.dataset.levelTwoCompletionFeedback = "full-cooler-water-glow";
  }

  document.body.dataset.levelTwoMemoryFeedback = `streak-${streak}`;
};

const originalOverlayShow = LevelCompleteOverlay.prototype.show;
LevelCompleteOverlay.prototype.show = function showPromotionResultsAfterDisplay(
  this: LevelCompleteOverlay,
  delayMs = 180
): void {
  if (!isPromotionRestock()) {
    originalOverlayShow.call(this, delayMs);
    return;
  }

  const view = this as unknown as LevelCompleteOverlayInternals;
  const lines = view.config.rewardLabel
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const performanceLine = (lines[0] ?? "MEMORY COMPLETE").replace("RUSH", "MEMORY");
  const rewardLine = lines.at(-1) ?? view.config.rewardLabel;

  view.config = {
    ...view.config,
    statusLabel: "PROMOTION COMPLETE",
    levelTitle: "WATER DISPLAY READY",
    rewardLabel: `${performanceLine}\n${rewardLine}`
  };

  document.body.dataset.levelTwoCompletionSequence = "display-glow-then-results";
  originalOverlayShow.call(this, Math.max(delayMs, LEVEL_TWO_RESULTS_DELAY_MS));
};
