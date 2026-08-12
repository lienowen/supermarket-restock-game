import type { RestockStarterMarketPresentationContext } from "../context/StarterMarketPresentationContext";
import {
  StarterMarketScene,
  type SceneCampaignSessionContext
} from "./StarterMarketScene";

const OLD_COOLER_SLOTS = Object.freeze([
  Object.freeze({ x: 900, y: 325 }),
  Object.freeze({ x: 900, y: 460 }),
  Object.freeze({ x: 900, y: 595 }),
  Object.freeze({ x: 1195, y: 325 }),
  Object.freeze({ x: 1195, y: 460 }),
  Object.freeze({ x: 1195, y: 595 })
]);

// Coordinates measured against bg-restock-water-l2.png after it is fitted to
// the 1600x900 logical canvas. The two columns follow the authored cooler bays.
const LEVEL_TWO_COOLER_SLOTS = Object.freeze([
  Object.freeze({ x: 1090, y: 355 }),
  Object.freeze({ x: 1090, y: 445 }),
  Object.freeze({ x: 1090, y: 535 }),
  Object.freeze({ x: 1365, y: 355 }),
  Object.freeze({ x: 1365, y: 445 }),
  Object.freeze({ x: 1365, y: 535 })
]);

const levelTwoContext = (
  context: RestockStarterMarketPresentationContext
): RestockStarterMarketPresentationContext => Object.freeze({
  ...context,
  world: Object.freeze({
    ...context.world,
    // Left staging pad -> centre aisle -> right cooler. These are gameplay
    // coordinates only; the static supermarket structure remains in the background.
    backroomBox: Object.freeze({ x: 190, y: 700 }),
    cartStart: Object.freeze({ x: 520, y: 790 }),
    cartCooler: Object.freeze({ x: 930, y: 790 }),
    workerStart: Object.freeze({ x: 650, y: 790 }),
    workerCooler: Object.freeze({ x: 1030, y: 790 }),
    beverageCooler: Object.freeze({ x: 1225, y: 500 })
  })
});

interface MovableGameObject {
  readonly x: number;
  readonly y: number;
  setPosition(x: number, y: number): unknown;
}

interface VisibleGameObject {
  setVisible(visible: boolean): unknown;
}

/**
 * L2 keeps the shared restock controller and all L1 actor/cart/product art.
 * Only the authored scene coordinates differ. This prevents Level 2 layout
 * work from changing the proven Level 1 scene.
 */
export class LevelTwoRestockScene extends StarterMarketScene {
  constructor(
    context: RestockStarterMarketPresentationContext,
    campaignSession?: SceneCampaignSessionContext
  ) {
    super(levelTwoContext(context), campaignSession);
  }

  create(): void {
    super.create();
    this.alignInteractiveCoolerToBackground();
    document.body.dataset.levelTwoLayout = "authored-background-v1";
  }

  private alignInteractiveCoolerToBackground(): void {
    LEVEL_TWO_COOLER_SLOTS.forEach((target, index) => {
      const original = OLD_COOLER_SLOTS[index];
      if (!original) return;
      const dx = target.x - original.x;
      const dy = target.y - original.y;

      this.moveNamedObject(`beverage-cooler-row-${index}`, dx, dy);
      this.moveNamedObject(`beverage-cooler-row-target-${index}`, dx, dy);
      this.moveNamedObject(`beverage-cooler-row-glow-${index}`, dx, dy);
      this.moveNamedObject(`beverage-cooler-row-count-${index}`, dx, dy);
    });

    // The new L2 plate already contains the refrigerator shelves and trim.
    // Keep only dynamic bottles / targets above it so no second cooler is drawn.
    this.setNamedVisibility("restock-cooler-shelf-foreground", false);
    this.setNamedVisibility("restock-cooler-shelf-rule", false);
    document.body.dataset.levelTwoCooler = "background-integrated";
  }

  private moveNamedObject(name: string, dx: number, dy: number): void {
    const object = this.children.getByName(name) as unknown as Partial<MovableGameObject> | null;
    if (
      !object ||
      typeof object.x !== "number" ||
      typeof object.y !== "number" ||
      typeof object.setPosition !== "function"
    ) return;
    object.setPosition(object.x + dx, object.y + dy);
  }

  private setNamedVisibility(name: string, visible: boolean): void {
    const object = this.children.getByName(name) as unknown as Partial<VisibleGameObject> | null;
    if (!object || typeof object.setVisible !== "function") return;
    object.setVisible(visible);
  }
}
