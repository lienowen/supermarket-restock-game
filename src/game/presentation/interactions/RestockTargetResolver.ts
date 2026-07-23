import type { RestockSceneSnapshot } from "../../application/RestockSceneController";
import type { PresentationPoint } from "../context/StarterMarketPresentationContext";

export interface InteractionTargetBounds extends PresentationPoint {
  readonly width: number;
  readonly height: number;
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
        const rowIndex = Math.min(snapshot.stockedRows, snapshot.totalRows - 1);
        return Object.freeze({
          x: this.config.coolerCentreX,
          y: this.config.coolerRowYs[rowIndex],
          width: this.config.coolerTargetWidth,
          height: 68
        });
      }
      case "complete":
        return undefined;
    }
  }
}
