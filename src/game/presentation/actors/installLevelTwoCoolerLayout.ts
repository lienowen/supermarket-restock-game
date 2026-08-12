import Phaser from "phaser";
import { IntegratedBeverageCoolerView } from "../fixtures/IntegratedBeverageCoolerView";
import type { CoolerStockPoint } from "../fixtures/IntegratedBeverageCoolerView";

const LEVEL_TWO_ID = "starter-level-002";
const LEVEL_TWO_SLOTS = Object.freeze([
  Object.freeze({ x: 1090, y: 355 }),
  Object.freeze({ x: 1090, y: 445 }),
  Object.freeze({ x: 1090, y: 535 }),
  Object.freeze({ x: 1365, y: 355 }),
  Object.freeze({ x: 1365, y: 445 }),
  Object.freeze({ x: 1365, y: 535 })
]);

const isLevelTwo = (): boolean => document.body.dataset.activeLevel === LEVEL_TWO_ID;

interface CoolerPrototypeInternals {
  createStockBottle(
    this: IntegratedBeverageCoolerView,
    rowIndex: number,
    itemIndex: number,
    animate: boolean
  ): Phaser.GameObjects.Image;
  rowCentre(this: IntegratedBeverageCoolerView, rowIndex: number): CoolerStockPoint;
}

const prototype = IntegratedBeverageCoolerView.prototype as unknown as CoolerPrototypeInternals;
const previousCreateStockBottle = prototype.createStockBottle;
const previousRowCentre = prototype.rowCentre;

prototype.rowCentre = function levelTwoRowCentre(
  this: IntegratedBeverageCoolerView,
  rowIndex: number
): CoolerStockPoint {
  if (!isLevelTwo()) return previousRowCentre.call(this, rowIndex);
  const point = LEVEL_TWO_SLOTS[rowIndex];
  if (!point) return previousRowCentre.call(this, rowIndex);
  return point;
};

prototype.createStockBottle = function levelTwoBackgroundAlignedBottle(
  this: IntegratedBeverageCoolerView,
  rowIndex: number,
  itemIndex: number,
  animate: boolean
): Phaser.GameObjects.Image {
  if (!isLevelTwo()) {
    return previousCreateStockBottle.call(this, rowIndex, itemIndex, animate);
  }

  // The row containers are moved onto the authored L2 cooler after scene create.
  // Creating directly inside the holder avoids the old-background world target
  // and keeps the final bottle position stable on mobile and desktop.
  const bottle = previousCreateStockBottle.call(this, rowIndex, itemIndex, false);
  if (!animate) return bottle;

  const targetScaleX = bottle.scaleX;
  const targetScaleY = bottle.scaleY;
  bottle
    .setAlpha(0.55)
    .setScale(targetScaleX * 0.72, targetScaleY * 0.72);

  const scene = (this as unknown as { readonly scene: Phaser.Scene }).scene;
  scene.tweens.add({
    targets: bottle,
    alpha: 1,
    scaleX: targetScaleX,
    scaleY: targetScaleY,
    duration: 180,
    ease: "Back.Out"
  });
  return bottle;
};
