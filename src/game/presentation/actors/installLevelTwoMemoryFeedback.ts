import Phaser from "phaser";
import {
  IntegratedBeverageCoolerView,
  type BeverageCoolerRushState,
  type CoolerStockPoint
} from "../fixtures/IntegratedBeverageCoolerView";
import { RestockRushMeter } from "../ui/RestockRushMeter";

const PROMOTION_RESTOCK_LEVEL_ID = "starter-level-002";
const SLOT_WIDTH = 230;
const SLOT_HEIGHT = 112;
const BASE_DEPTH = 20;

interface CoolerSlot extends CoolerStockPoint {
  readonly shelfIndex: number;
}

interface CoolerInternals {
  readonly scene: Phaser.Scene;
  readonly slots: readonly CoolerSlot[];
  readonly rowHolders: Phaser.GameObjects.Container[];
  readonly lastRushState?: BeverageCoolerRushState;
}

interface CoolerPrototypeInternals {
  animateFilledRow(this: IntegratedBeverageCoolerView, rowIndex: number): void;
  showMistake(this: IntegratedBeverageCoolerView, rowIndex: number): void;
}

const memoryStreaks = new WeakMap<IntegratedBeverageCoolerView, number>();

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

  memoryStreaks.set(this, 0);
  const view = this as unknown as CoolerInternals;
  const slot = view.slots[rowIndex];
  if (!slot) return;

  const flash = view.scene.add.graphics().setDepth(BASE_DEPTH + 9);
  flash.fillStyle(0xe45d52, 0.16);
  flash.fillRoundedRect(
    slot.x - SLOT_WIDTH / 2,
    slot.y - SLOT_HEIGHT / 2,
    SLOT_WIDTH,
    SLOT_HEIGHT,
    12
  );
  flash.lineStyle(4, 0xff8f86, 0.94);
  flash.strokeRoundedRect(
    slot.x - SLOT_WIDTH / 2,
    slot.y - SLOT_HEIGHT / 2,
    SLOT_WIDTH,
    SLOT_HEIGHT,
    12
  );
  view.scene.tweens.add({
    targets: flash,
    alpha: 0,
    duration: 320,
    ease: "Quad.Out",
    onComplete: () => flash.destroy()
  });

  document.body.dataset.levelTwoMistakeRule = "same-order-single-message";
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
  const slot = view.slots[rowIndex];
  const holder = view.rowHolders[rowIndex];
  if (!slot || !holder) return;

  holder.setScale(0.97);
  view.scene.tweens.add({
    targets: holder,
    scaleX: 1.05,
    scaleY: 1.05,
    yoyo: true,
    duration: 140,
    ease: "Sine.Out"
  });

  const streak = (memoryStreaks.get(this) ?? 0) + 1;
  memoryStreaks.set(this, streak);
  const completedShelves = view.lastRushState?.filledRowIndexes.length ?? 0;
  const totalShelves = view.slots.length;

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

  const badgeLabel = streak > 1
    ? `MEMORY x${streak} · ${completedShelves}/${totalShelves}`
    : `CORRECT · ${completedShelves}/${totalShelves}`;
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

  if (streak >= 3) view.scene.cameras.main.flash(80, 117, 217, 255, false);

  const displayComplete = completedShelves === totalShelves;
  if (displayComplete) {
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
    document.body.dataset.levelTwoCompletionFeedback = "always-full-cooler-water-glow";
  }

  document.body.dataset.levelTwoMemoryFeedback = `progress-${completedShelves}-streak-${streak}`;
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
