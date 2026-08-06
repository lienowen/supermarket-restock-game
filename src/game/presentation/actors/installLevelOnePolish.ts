import Phaser from "phaser";
import type { RestockSceneSnapshot } from "../../application/RestockSceneController";
import { playActionFeedback } from "../effects/ActionFeedback";
import {
  IntegratedBeverageCoolerView,
  type BeverageCoolerViewConfig,
  type CoolerStockPoint
} from "../fixtures/IntegratedBeverageCoolerView";
import { RestockActorView } from "./RestockActorView";

const FIRST_DELIVERY_LEVEL_ID = "starter-level-001";
const PRODUCT_KEY = "restock-cola-bottle-hd-v2";
const SLOT_WIDTH = 230;
const SLOT_HEIGHT = 112;
const BASE_DEPTH = 20;

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
}

interface RestockActorInternals {
  readonly scene: Phaser.Scene;
  readonly cart: Phaser.GameObjects.Image;
}

const isFirstDelivery = (): boolean => (
  document.body.dataset.activeLevel === FIRST_DELIVERY_LEVEL_ID
);

const actorSnapshots = new WeakMap<RestockActorView, RestockSceneSnapshot>();
const originalActorSync = RestockActorView.prototype.sync;

RestockActorView.prototype.sync = function syncWithLevelOneFeedback(
  this: RestockActorView,
  snapshot: RestockSceneSnapshot
): void {
  const previous = actorSnapshots.get(this);
  originalActorSync.call(this, snapshot);

  if (
    isFirstDelivery() &&
    previous &&
    !previous.boxOpened &&
    snapshot.boxOpened
  ) {
    const view = this as unknown as RestockActorInternals;
    const targetScaleX = view.cart.scaleX;
    const targetScaleY = view.cart.scaleY;
    view.cart
      .setAlpha(0.8)
      .setScale(targetScaleX * 0.93, targetScaleY * 0.93);
    view.scene.tweens.add({
      targets: view.cart,
      alpha: 1,
      scaleX: targetScaleX,
      scaleY: targetScaleY,
      duration: 190,
      ease: "Back.Out"
    });
    playActionFeedback(
      view.scene,
      { x: view.cart.x, y: view.cart.y - 62 },
      "interact",
      { label: "CASE OPENED", emphasis: 1.18 }
    );
    view.scene.cameras.main.flash(120, 255, 217, 94, false);
    document.body.dataset.restockOpenFeedback = "case-open-pop";
  }

  actorSnapshots.set(this, snapshot);
};

const coolerPrototype = IntegratedBeverageCoolerView.prototype as unknown as CoolerPrototypeInternals;
const originalCreateStockBottle = coolerPrototype.createStockBottle;
const originalAnimateFilledRow = coolerPrototype.animateFilledRow;

coolerPrototype.createStockBottle = function createStaggeredLevelOneBottle(
  this: IntegratedBeverageCoolerView,
  rowIndex: number,
  itemIndex: number,
  animate: boolean
): Phaser.GameObjects.Image {
  if (!isFirstDelivery() || !animate) {
    return originalCreateStockBottle.call(this, rowIndex, itemIndex, animate);
  }

  const view = this as unknown as CoolerInternals;
  const holder = view.rowHolders[rowIndex];
  const slot = view.slots[rowIndex];
  if (!holder || !slot) {
    return originalCreateStockBottle.call(this, rowIndex, itemIndex, animate);
  }

  const localTarget = view.itemLocalPosition(rowIndex, itemIndex);
  const bottleHeight = Phaser.Math.Linear(76, 90, slot.shelfIndex / 2);
  const sourceX = view.config.stockSource.x - 18 + (itemIndex - 1) * 10;
  const sourceY = view.config.stockSource.y - 96;
  const bottle = view.scene.add.image(sourceX, sourceY, PRODUCT_KEY)
    .setOrigin(0.5, 1)
    .setDisplaySize(36, bottleHeight)
    .setAlpha(0.72)
    .setDepth(BASE_DEPTH + 3)
    .setAngle((itemIndex - 1) * -4)
    .setName(`beverage-cooler-row-${rowIndex}-item-${itemIndex}`);

  const targetScaleX = bottle.scaleX;
  const targetScaleY = bottle.scaleY;
  bottle.setScale(targetScaleX * 0.7, targetScaleY * 0.7);

  const worldTarget = {
    x: slot.x + localTarget.x,
    y: slot.y + localTarget.y
  };
  const liftY = Math.min(sourceY - 68, worldTarget.y - 82);
  const delay = itemIndex * 80;

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

  document.body.dataset.restockBottleAnimation = "three-bottle-stagger";
  return bottle;
};

coolerPrototype.animateFilledRow = function animateLevelOneShelfCompletion(
  this: IntegratedBeverageCoolerView,
  rowIndex: number
): void {
  originalAnimateFilledRow.call(this, rowIndex);
  if (!isFirstDelivery()) return;

  const view = this as unknown as CoolerInternals;
  const slot = view.slots[rowIndex];
  if (!slot) return;

  const flash = view.scene.add.graphics().setDepth(BASE_DEPTH + 10);
  flash.fillStyle(0x62c77d, 0.15);
  flash.fillRoundedRect(
    slot.x - SLOT_WIDTH / 2,
    slot.y - SLOT_HEIGHT / 2,
    SLOT_WIDTH,
    SLOT_HEIGHT,
    12
  );
  flash.lineStyle(5, 0x8ce39f, 0.96);
  flash.strokeRoundedRect(
    slot.x - SLOT_WIDTH / 2,
    slot.y - SLOT_HEIGHT / 2,
    SLOT_WIDTH,
    SLOT_HEIGHT,
    12
  );

  const badge = view.scene.add.text(
    slot.x + SLOT_WIDTH / 2 - 8,
    slot.y - SLOT_HEIGHT / 2 + 8,
    "✓ 3/3",
    {
      fontFamily: "Arial, sans-serif",
      fontSize: "16px",
      fontStyle: "bold",
      color: "#17332a",
      backgroundColor: "#8ce39f",
      padding: { x: 8, y: 4 }
    }
  )
    .setOrigin(1, 0)
    .setDepth(BASE_DEPTH + 11)
    .setScale(0.62)
    .setAlpha(0);

  view.scene.tweens.add({
    targets: flash,
    alpha: 0,
    duration: 650,
    ease: "Quad.Out",
    onComplete: () => flash.destroy()
  });
  view.scene.tweens.add({
    targets: badge,
    alpha: 1,
    scaleX: 1,
    scaleY: 1,
    duration: 180,
    hold: 520,
    yoyo: true,
    ease: "Back.Out",
    onComplete: () => badge.destroy()
  });

  document.body.dataset.restockShelfFeedback = "green-complete-badge";
};
