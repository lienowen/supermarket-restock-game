import Phaser from "phaser";
import { tightenCommercialProductImage } from "../assets/CommercialProductTextureCrop";
import { CommercialShelfSortScene } from "./CommercialShelfSortScene";

const PLAY_AREA_TOP = 300;
const PLAY_AREA_HEIGHT = 860;
const PRODUCT_SCALE_BOOST = 1.65;
const APPLE_TOP_TRIM_RATIO = 0.34;

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
      const productId = gameObject.getData("productId");
      if (typeof productId !== "string") continue;
      if (!tightenCommercialProductImage(gameObject)) continue;
      this.normalizeProductDisplay(gameObject, productId);
    }
  }

  private normalizeProductDisplay(image: Phaser.GameObjects.Image, productId: string): void {
    if (image.getData("commercialVisualNormalized") === true) return;

    if (productId === "apple") {
      const frameWidth = Math.max(1, image.frame.realWidth || image.frame.width);
      const frameHeight = Math.max(1, image.frame.realHeight || image.frame.height);
      const trimY = Math.round(frameHeight * APPLE_TOP_TRIM_RATIO);
      image.setCrop(0, trimY, frameWidth, Math.max(1, frameHeight - trimY));
      image.y += trimY * image.scaleY * 0.18;
    }

    image.setScale(image.scaleX * PRODUCT_SCALE_BOOST, image.scaleY * PRODUCT_SCALE_BOOST);
    image.setData("commercialVisualNormalized", true);
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
