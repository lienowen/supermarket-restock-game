import Phaser from "phaser";
import { tightenCommercialProductImage } from "../assets/CommercialProductTextureCrop";
import { CommercialShelfSortScene } from "./CommercialShelfSortScene";

/**
 * Production presentation wrapper.
 *
 * The rules and interaction scene stay unchanged. This wrapper continuously
 * normalizes newly-created product sprites after board re-renders so padded
 * source canvases and disconnected generation fragments never determine the
 * player-facing scale.
 */
export class CommercialShelfSortProductionScene extends CommercialShelfSortScene {
  private cropScanElapsedMs = 0;

  create(): void {
    super.create();
    this.cropVisibleProducts();
  }

  update(_time: number, delta: number): void {
    this.cropScanElapsedMs += delta;
    if (this.cropScanElapsedMs < 40) return;
    this.cropScanElapsedMs = 0;
    this.cropVisibleProducts();
  }

  private cropVisibleProducts(): void {
    for (const gameObject of this.children.list) {
      if (!(gameObject instanceof Phaser.GameObjects.Image)) continue;
      if (typeof gameObject.getData("productId") !== "string") continue;
      tightenCommercialProductImage(gameObject);
    }
  }
}
