import Phaser from "phaser";
import { tightenCommercialProductImage } from "../assets/CommercialProductTextureCrop";
import { CommercialShelfSortScene } from "./CommercialShelfSortScene";

const GAME_WIDTH = 750;
const COMPACT_BOARD_TOP = 350;
const TALL_BOARD_TOP = 320;
const BOARD_GAP = 8;
const PRODUCT_SCALE_MULTIPLIER = 0.78;

/**
 * Production presentation wrapper.
 *
 * The base scene owns rules, input, persistence and modal flows. This wrapper
 * replaces the engineering-style collection of independent white boxes with a
 * single coherent supermarket cabinet, normalizes product artwork, and keeps
 * every supported layout inside the portrait play area.
 */
export class CommercialShelfSortProductionScene extends CommercialShelfSortScene {
  private presentationScanElapsedMs = 0;
  private cabinetBackdrop?: Phaser.GameObjects.Graphics;
  private cabinetSignature = "";

  create(): void {
    super.create();
    document.body.dataset.commercialVisuals = "commercial-shelf-v3";
    this.normalizePresentation();
  }

  update(_time: number, delta: number): void {
    this.presentationScanElapsedMs += delta;
    if (this.presentationScanElapsedMs < 80) return;
    this.presentationScanElapsedMs = 0;
    this.normalizePresentation();
  }

  private normalizePresentation(): void {
    this.normalizeVisibleProducts();
    this.normalizeShelfCabinet();
  }

  private normalizeVisibleProducts(): void {
    for (const gameObject of this.children.list) {
      if (!(gameObject instanceof Phaser.GameObjects.Image)) continue;
      const productId = gameObject.getData("productId");
      if (typeof productId !== "string") continue;
      if (gameObject.getData("commercialVisualNormalized") === true) continue;

      tightenCommercialProductImage(gameObject);
      gameObject.setScale(
        gameObject.scaleX * PRODUCT_SCALE_MULTIPLIER,
        gameObject.scaleY * PRODUCT_SCALE_MULTIPLIER
      );
      gameObject.setData("commercialVisualNormalized", true);
    }
  }

  private shelfBayContainers(): Phaser.GameObjects.Container[] {
    return this.children.list.filter((gameObject): gameObject is Phaser.GameObjects.Container => (
      gameObject instanceof Phaser.GameObjects.Container &&
      typeof gameObject.getData("shelfBayId") === "string"
    ));
  }

  private normalizeShelfCabinet(): void {
    const bayContainers = this.shelfBayContainers();
    if (bayContainers.length === 0) return;

    const ordered = [...bayContainers].sort((left, right) => (
      Math.abs(left.y - right.y) > 4 ? left.y - right.y : left.x - right.x
    ));
    const originalColumns = [...new Set(ordered.map((container) => Math.round(container.x)))].length;
    const columns = Math.max(1, Math.min(originalColumns, ordered.length));
    const rows = Math.ceil(ordered.length / columns);

    const hitArea = ordered[0]?.input?.hitArea as { width?: number; height?: number } | undefined;
    const cellWidth = Math.max(1, Number(hitArea?.width ?? ordered[0]?.width ?? 180));
    const cellHeight = Math.max(1, Number(hitArea?.height ?? ordered[0]?.height ?? 180));
    const gridWidth = columns * cellWidth + (columns - 1) * BOARD_GAP;
    const gridHeight = rows * cellHeight + (rows - 1) * BOARD_GAP;
    const gridLeft = (GAME_WIDTH - gridWidth) / 2;
    const gridTop = rows <= 2 ? COMPACT_BOARD_TOP : TALL_BOARD_TOP;

    ordered.forEach((container, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      container.x = gridLeft + cellWidth / 2 + column * (cellWidth + BOARD_GAP);
      container.y = gridTop + cellHeight / 2 + row * (cellHeight + BOARD_GAP);
      this.hideEngineeringBayShell(container);
    });

    const signature = [
      ordered.map((container) => container.getData("shelfBayId")).join("|"),
      columns,
      rows,
      Math.round(cellWidth),
      Math.round(cellHeight),
      Math.round(gridLeft),
      Math.round(gridTop)
    ].join(":");

    if (signature === this.cabinetSignature && this.cabinetBackdrop?.active) return;
    this.cabinetSignature = signature;
    this.drawCabinetBackdrop(gridLeft, gridTop, cellWidth, cellHeight, columns, rows);
  }

  private hideEngineeringBayShell(container: Phaser.GameObjects.Container): void {
    const shadow = container.list[0];
    const frame = container.list[1];
    if (shadow) shadow.setVisible(false);
    if (frame) frame.setVisible(false);

    for (const child of container.list) {
      if (!(child instanceof Phaser.GameObjects.Arc)) continue;
      child.setAlpha(Math.min(child.alpha, 0.12));
    }
  }

  private drawCabinetBackdrop(
    gridLeft: number,
    gridTop: number,
    cellWidth: number,
    cellHeight: number,
    columns: number,
    rows: number
  ): void {
    this.cabinetBackdrop?.destroy();

    const gridWidth = columns * cellWidth + (columns - 1) * BOARD_GAP;
    const gridHeight = rows * cellHeight + (rows - 1) * BOARD_GAP;
    const outerX = gridLeft - 12;
    const outerY = gridTop - 14;
    const outerWidth = gridWidth + 24;
    const outerHeight = gridHeight + 28;
    const cabinet = this.add.graphics().setDepth(-4);

    cabinet.fillStyle(0x4f2f20, 0.22);
    cabinet.fillRoundedRect(outerX + 5, outerY + 10, outerWidth, outerHeight, 24);

    cabinet.fillStyle(0x7b4328, 1);
    cabinet.fillRoundedRect(outerX, outerY, outerWidth, outerHeight, 24);
    cabinet.lineStyle(3, 0x5d321f, 1);
    cabinet.strokeRoundedRect(outerX, outerY, outerWidth, outerHeight, 24);

    cabinet.fillStyle(0xd98a4f, 1);
    cabinet.fillRoundedRect(outerX + 7, outerY + 7, outerWidth - 14, outerHeight - 14, 19);

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const x = gridLeft + column * (cellWidth + BOARD_GAP);
        const y = gridTop + row * (cellHeight + BOARD_GAP);

        cabinet.fillStyle(0xfff5db, 1);
        cabinet.fillRoundedRect(x + 5, y + 5, cellWidth - 10, cellHeight - 34, 10);

        cabinet.fillStyle(0xffffff, 0.38);
        cabinet.fillRoundedRect(x + 11, y + 11, cellWidth - 22, 8, 4);

        cabinet.lineStyle(2, 0x9d5a36, 0.45);
        cabinet.strokeRoundedRect(x + 5, y + 5, cellWidth - 10, cellHeight - 34, 10);
      }
    }

    cabinet.fillStyle(0x6c3b25, 1);
    cabinet.fillRoundedRect(outerX + 18, outerY + outerHeight - 8, outerWidth - 36, 14, 6);

    this.cabinetBackdrop = cabinet;
  }
}
