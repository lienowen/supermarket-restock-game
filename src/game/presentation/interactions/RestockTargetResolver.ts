import type { RestockSceneSnapshot } from "../../application/RestockSceneController";
import type { PresentationPoint } from "../context/StarterMarketPresentationContext";
import {
  COOLER_STOCK_SLOT_COUNT,
  COOLER_STOCK_TARGET_HEIGHT,
  resolveCoolerStockSlots
} from "../visual/CoolerStockLayout";

export interface InteractionTargetBounds extends PresentationPoint {
  readonly width: number;
  readonly height: number;
}

export interface RestockTargetResolverConfig {
  readonly backroomBox: PresentationPoint;
  readonly cartStart: PresentationPoint;
  readonly cartDestination: PresentationPoint;
  readonly coolerCentreX: number;
  /** @deprecated Slot geometry is owned by CoolerStockLayout. */
  readonly coolerRowYs?: readonly number[];
  readonly coolerTargetWidth: number;
}

export class RestockTargetResolver {
  constructor(private readonly config: RestockTargetResolverConfig) {
    if (config.coolerTargetWidth <= 0) {
      throw new Error("Restock cooler target width must be positive");
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
        const slotIndex = Math.min(snapshot.stockedRows, COOLER_STOCK_SLOT_COUNT - 1);
        const slot = resolveCoolerStockSlots(this.config.coolerCentreX)[slotIndex];
        return Object.freeze({
          x: slot.x,
          y: slot.y,
          width: this.config.coolerTargetWidth,
          height: COOLER_STOCK_TARGET_HEIGHT
        });
      }
      case "complete":
        return undefined;
    }
  }
}
