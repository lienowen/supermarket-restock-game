import type { RestockSceneSnapshot } from "../../application/RestockSceneController";
import type { PresentationPoint } from "../context/StarterMarketPresentationContext";

export interface InteractionTargetBounds extends PresentationPoint {
  readonly width: number;
  readonly height: number;
}

export interface CoolerStockSlot extends PresentationPoint {
  readonly bayIndex: number;
  readonly shelfIndex: number;
}

export const BEVERAGE_BOTTLE_CROP = Object.freeze({
  x: 188,
  y: 374,
  width: 136,
  height: 356
});

export const COOLER_STOCK_SLOT_OFFSETS = Object.freeze([
  Object.freeze({ x: -5, y: 300, bayIndex: 0, shelfIndex: 0 }),
  Object.freeze({ x: -5, y: 420, bayIndex: 0, shelfIndex: 1 }),
  Object.freeze({ x: -5, y: 540, bayIndex: 0, shelfIndex: 2 }),
  Object.freeze({ x: 80, y: 300, bayIndex: 1, shelfIndex: 0 }),
  Object.freeze({ x: 80, y: 420, bayIndex: 1, shelfIndex: 1 }),
  Object.freeze({ x: 80, y: 540, bayIndex: 1, shelfIndex: 2 })
] as const);

export function resolveCoolerStockSlots(centreX: number): readonly CoolerStockSlot[] {
  return Object.freeze(COOLER_STOCK_SLOT_OFFSETS.map((slot) => Object.freeze({
    x: centreX + slot.x,
    y: slot.y,
    bayIndex: slot.bayIndex,
    shelfIndex: slot.shelfIndex
  })));
}

export interface RestockTargetResolverConfig {
  readonly backroomBox: PresentationPoint;
  readonly cartStart: PresentationPoint;
  readonly cartDestination: PresentationPoint;
  readonly coolerCentreX: number;
  readonly coolerRowYs: readonly number[];
  readonly coolerTargetWidth: number;
}

export class RestockTargetResolver {
  constructor(private readonly config: RestockTargetResolverConfig) {
    if (config.coolerRowYs.length === 0) {
      throw new Error("Restock target resolver requires at least one cooler row");
    }
  }

  resolve(snapshot: RestockSceneSnapshot): InteractionTargetBounds | undefined {
    switch (snapshot.step) {
      case "collect":
        return Object.freeze({
          x: this.config.backroomBox.x,
          y: this.config.backroomBox.y - 130,
          width: 215,
          height: 250
        });
      case "load":
      case "push":
        return Object.freeze({
          x: this.config.cartStart.x + 72,
          y: this.config.cartStart.y - 165,
          width: 330,
          height: 310
        });
      case "park":
        return Object.freeze({
          x: this.config.cartDestination.x,
          y: this.config.cartDestination.y,
          width: 280,
          height: 230
        });
      case "open":
        return Object.freeze({
          x: this.config.cartDestination.x + 24,
          y: this.config.cartDestination.y - 132,
          width: 205,
          height: 240
        });
      case "restock": {
        const slotIndex = Math.min(snapshot.stockedRows, COOLER_STOCK_SLOT_OFFSETS.length - 1);
        const slot = resolveCoolerStockSlots(this.config.coolerCentreX)[slotIndex];
        return Object.freeze({
          x: slot.x,
          y: slot.y,
          width: this.config.coolerTargetWidth,
          height: 74
        });
      }
      case "complete":
        return undefined;
    }
  }
}
