import Phaser from "phaser";
import { tightenCommercialProductImage } from "../assets/CommercialProductTextureCrop";
import { CommercialShelfSortScene } from "./CommercialShelfSortScene";

const PLAY_AREA_TOP = 300;
const PLAY_AREA_HEIGHT = 860;

/**
 * Production presentation wrapper.
 *
 * The rules and interaction scene stay unchanged. This wrapper continuously
 * normalizes newly-created product sprites after board re-renders so padded
 * source canvases and disconnected generation fragments never determine the
 * player-facing scale. Compact boards are centered inside the same play area
 * used by five-row layouts.
 */
export class CommercialShelfSortProductionScene extends CommercialShelfSortScene {
  private presentationScanElapsedMs = 0;

  create(): void {
    super.create();
    this.normalizePresentation();
  }

  update(_time: number, delta: number): void {
    this.presentationScanElapsedMs += delta;
    if (this.presentationScanElapsedMs < 40) return;
    this.presentationScanElapsedMs = 0;
    this.normalizePresentation();
  }

  private normalizePresentation(): void {
    this.cropVisibleProducts();
    this.centerShelfBoard();
  }

  private cropVisibleProducts(): void {
    for (const gameObject of this.children.list) {
      if (!(gameObject instanceof Phaser.GameObjects.Image)) continue;
      if (typeof gameObject.getData("productId") !== "string") continue;
      tightenCommercialProductImage(gameObject);
    }
  }

  private centerShelfBoard(): void {
    const bayContainers = this.children.list.filter((gameObject): gameObject is Phaser.GameObjects.Container => (
      gameObject instanceof Phaser.GameObjects.Container &&
      gameObject.list.some((child) => (
        child instanceof Phaser.GameObjects.Text && /^(BAY-\d+|LOCKED)$/.test(child.text)
      ))
    ));

    if (bayContainers.length === 0) return;
    if (bayContainers.every((container) => container.getData("commercialBoardCentered") === true)) return;

    const top = Math.min(...bayContainers.map((container) => (
      container.y - Math.max(1, container.input?.hitArea?.height ?? container.height) / 2
    )));
    const bottom = Math.max(...bayContainers.map((container) => (
      container.y + Math.max(1, container.input?.hitArea?.height ?? container.height) / 2
    )));
    const currentCenter = (top + bottom) / 2;
    const targetCenter = PLAY_AREA_TOP + PLAY_AREA_HEIGHT / 2;
    const offsetY = targetCenter - currentCenter;

    for (const container of bayContainers) {
      container.y += offsetY;
      container.setData("commercialBoardCentered", true);
    }
  }
}
