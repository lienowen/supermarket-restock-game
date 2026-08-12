import Phaser from "phaser";
import {
  IntegratedBeverageCoolerView,
  type BeverageCoolerRushState,
  type CoolerStockPoint
} from "../fixtures/IntegratedBeverageCoolerView";
import { RestockRushMeter } from "../ui/RestockRushMeter";

const PROMOTION_RESTOCK_LEVEL_ID = "starter-level-002";
const SLOT_WIDTH = 230;
const SLOT_HEIGHT = 82;
const BASE_DEPTH = 20;

interface CoolerInternals {
  readonly scene: Phaser.Scene;
  readonly rowHolders: Phaser.GameObjects.Container[];
  readonly lastRushState?: BeverageCoolerRushState;
  rowCentre(rowIndex: number): CoolerStockPoint;
}

interface CoolerPrototypeInternals {
  animateFilledRow(this: IntegratedBeverageCoolerView, rowIndex: number): void;
  showMistake(this: IntegratedBeverageCoolerView, rowIndex: number): void;
}

const isPromotionRestock = (): boolean => (
  document.body.dataset.activeLevel === PROMOTION_RESTOCK_LEVEL_ID
);

const coolerPrototype = IntegratedBeverageCoolerView.prototype as unknown as CoolerPrototypeInternals;
const inheritedAnimateFilledRow = coolerPrototype.animateFilledRow;
const inheritedShowMistake = coolerPrototype.showMistake;

coolerPrototype.showMistake = function showSinglePromotionMistake(
  this: IntegratedBeverageCoolerView,
  rowIndex: number
): void {
  if (!isPromotionRestock()) {
    inheritedShowMistake.call(this, rowIndex);
    return;
  }

  const view = this as unknown as CoolerInternals;
  const point = view.rowCentre(rowIndex);
  const flash = view.scene.add.graphics().setDepth(BASE_DEPTH + 9);
  flash.fillStyle(0xe45d52, 0.14);
  flash.fillRoundedRect(
    point.x - SLOT_WIDTH / 2,
    point.y - SLOT_HEIGHT / 2,
    SLOT_WIDTH,
    SLOT_HEIGHT,
    10
  );
  flash.lineStyle(4, 0xff8f86, 0.92);
  flash.strokeRoundedRect(
    point.x - SLOT_WIDTH / 2,
    point.y - SLOT_HEIGHT / 2,
    SLOT_WIDTH,
    SLOT_HEIGHT,
    10
  );
  view.scene.tweens.add({
    targets: flash,
    alpha: 0,
    duration: 280,
    ease: "Quad.Out",
    onComplete: () => flash.destroy()
  });

  document.body.dataset.levelTwoMistakeRule = "local-shelf-only";
};

coolerPrototype.animateFilledRow = function animateAccuratePromotionProgress(
  this: IntegratedBeverageCoolerView,
  rowIndex: number
): void {
  if (!isPromotionRestock()) {
    inheritedAnimateFilledRow.call(this, rowIndex);
    return;
  }

  const view = this as unknown as CoolerInternals;
  const holder = view.rowHolders[rowIndex];
  if (!holder) return;
  const point = view.rowCentre(rowIndex);

  holder.setScale(0.97);
  view.scene.tweens.add({
    targets: holder,
    scaleX: 1.04,
    scaleY: 1.04,
    yoyo: true,
    duration: 125,
    ease: "Sine.Out"
  });

  const completedShelves = view.lastRushState?.filledRowIndexes.length ?? 0;
  const totalShelves = view.rowHolders.length;
  const flash = view.scene.add.graphics().setDepth(BASE_DEPTH + 10);
  flash.fillStyle(0x75d9ff, 0.1);
  flash.fillRoundedRect(
    point.x - SLOT_WIDTH / 2,
    point.y - SLOT_HEIGHT / 2,
    SLOT_WIDTH,
    SLOT_HEIGHT,
    10
  );
  flash.lineStyle(4, 0x9be7ff, 0.9);
  flash.strokeRoundedRect(
    point.x - SLOT_WIDTH / 2,
    point.y - SLOT_HEIGHT / 2,
    SLOT_WIDTH,
    SLOT_HEIGHT,
    10
  );

  const badge = view.scene.add.text(
    point.x,
    point.y - 52,
    `✓ ${completedShelves}/${totalShelves}`,
    {
      fontFamily: "Arial, sans-serif",
      fontSize: "15px",
      fontStyle: "bold",
      color: "#0d2a35",
      backgroundColor: "#9be7ff",
      padding: { x: 8, y: 4 }
    }
  )
    .setOrigin(0.5)
    .setDepth(BASE_DEPTH + 11)
    .setScale(0.76)
    .setAlpha(0);

  view.scene.tweens.add({
    targets: flash,
    alpha: 0,
    duration: 480,
    ease: "Quad.Out",
    onComplete: () => flash.destroy()
  });
  view.scene.tweens.add({
    targets: badge,
    alpha: 1,
    scaleX: 1,
    scaleY: 1,
    duration: 130,
    hold: 330,
    yoyo: true,
    ease: "Back.Out",
    onComplete: () => badge.destroy()
  });

  document.body.dataset.levelTwoMemoryFeedback = `compact-progress-${completedShelves}`;
};

const inheritedMeterMistake = RestockRushMeter.prototype.showMistake;
RestockRushMeter.prototype.showMistake = function showPromotionOrderReminder(
  this: RestockRushMeter,
  message = "STREAK LOST"
): void {
  inheritedMeterMistake.call(
    this,
    isPromotionRestock() ? "WRONG · SAME ORDER" : message
  );
};
