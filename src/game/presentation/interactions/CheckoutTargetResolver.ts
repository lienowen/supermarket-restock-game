import type { CheckoutSceneSnapshot } from "../../application/CheckoutSceneController";
import type { PresentationPoint } from "../context/StarterMarketPresentationContext";

export interface CheckoutInteractionTarget {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export class CheckoutTargetResolver {
  constructor(private readonly servicePoint: PresentationPoint) {}

  resolve(snapshot: CheckoutSceneSnapshot): CheckoutInteractionTarget | undefined {
    if (snapshot.step === "complete") return undefined;
    return Object.freeze({
      x: this.servicePoint.x,
      y: this.servicePoint.y,
      width: 260,
      height: 190
    });
  }
}
