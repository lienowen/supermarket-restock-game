import Phaser from "phaser";
import {
  BEVERAGE_BOTTLE_CROP,
  COOLER_STOCK_ITEMS_PER_SLOT,
  COOLER_STOCK_SLOT_COUNT,
  COOLER_STOCK_TARGET_HEIGHT,
  COOLER_STOCK_TARGET_WIDTH,
  resolveCoolerStockBounds,
  resolveCoolerStockSlots,
  type CoolerStockPoint,
  type CoolerStockSlot
} from "../visual/CoolerStockLayout";

export interface BeverageCoolerViewConfig {
  readonly centreX: number;
  readonly restockProductKey: string;
  readonly stockSource: CoolerStockPoint;
  readonly onRowSelected?: (rowIndex: number) => void;
  /** @deprecated The coherent background owns the cooler frame. */
  readonly baseY?: number;
  /** @deprecated The coherent background owns the cooler frame. */
  readonly backgroundY?: number;
  /** @deprecated The coherent background owns the cooler frame. */
  readonly frameWidth?: number;
  /** @deprecated The coherent background owns the cooler frame. */
  readonly frameHeight?: number;
  /** @deprecated The coherent background owns the cooler frame. */
  readonly displayWidth?: number;
  /** @deprecated The coherent background owns the cooler frame. */
  readonly displayHeight?: number;
  /** @deprecated Department labels are rendered by the environment. */
  readonly departmentLabel?: string;
  /** @deprecated Department labels are rendered by the environment. */
  readonly subtitleLabel?: string;
  /** @deprecated Slot geometry is owned by CoolerStockLayout. */
  readonly rowYs?: readonly number[];
  /** @deprecated Ambient products are already part of the background. */
  readonly ambientPositions?: readonly number[];
  /** @deprecated Slot geometry is owned by CoolerStockLayout. */
  readonly restockStartX?: number;
  /** @deprecated Slot geometry is owned by CoolerStockLayout. */
  readonly restockStepX?: number;
  /** @deprecated Item count is owned by CoolerStockLayout. */
  readonly restockItemCount?: number;
  /** @deprecated The coherent background owns the cooler fixture. */
  readonly coolerAssetKey?: string;
  /** @deprecated Ambient products are already part of the background. */
  readonly ambientProductKeys?: readonly string[];
}

export interface BeverageCoolerRushState {
  readonly filledRowIndexes: readonly number[];
  readonly rowItemCounts: readonly number[];
  readonly activeRowIndex?: number;
  readonly remainingRatio: number;
  readonly interactionEnabled: boolean;
}

/**
 * Six interactive stock slots arranged as two real glass-door bays with three
 * shelf segments each. Empty shelves own no product sprites. Every successful
 * stock action creates one cropped product sprite and moves it from the open
 * case into its final grounded shelf position.
 */
export class BeverageCoolerView {
  private readonly rowHolders: Phaser.GameObjects.Container[] = [];
  private readonly rowItems: Phaser.GameObjects.Image[][] = [];
  private readonly bayBackings: Phaser.GameObjects.Graphics[] = [];
  private readonly rowPlates: Phaser.GameObjects.Graphics[] = [];
  private readonly rowTargets: Phaser.GameObjects.Rectangle[] = [];
  private readonly countLabels: Phaser.GameObjects.Text[] = [];
  private readonly slots: readonly CoolerStockSlot[];
  private inputBlocker?: Phaser.GameObjects.Rectangle;
  private previousFilledRows = new Set<number>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly config: BeverageCoolerViewConfig
  ) {
    this.slots = resolveCoolerStockSlots(config.centreX);
    if (this.slots.length !== COOLER_STOCK_SLOT_COUNT) {
      throw new Error(`Beverage cooler requires ${COOLER_STOCK_SLOT_COUNT} task slots`);
    }
  }

  create(): void {
    const rowHeight = this.rowHeight();
    this.createInputBlocker();
    this.createBayBackings(rowHeight);

    this.slots.forEach((slot, rowIndex) => {
      const shelfWidth = this.shelfWidth(rowIndex);
      const target = this.scene.add.rectangle(
        slot.x,
        slot.y,
        Math.max(COOLER_STOCK_TARGET_WIDTH, shelfWidth + 28),
        COOLER_STOCK_TARGET_HEIGHT,
        0xffffff,
        0.001
      )
        .setDepth(9)
        .setName(`beverage-cooler-row-target-${rowIndex}`);
      target.on(
        "pointerdown",
        (
          _pointer: Phaser.Input.Pointer,
          _localX: number,
          _localY: number,
          event: Phaser.Types.Input.EventData
        ) => {
          event.stopPropagation();
          this.config.onRowSelected?.(rowIndex);
        }
      );
      this.rowTargets.push(target);
      this.rowPlates.push(this.createRowPlate(slot, rowIndex, rowHeight));
      this.rowHolders.push(
        this.scene.add.container(slot.x, slot.y)
          .setDepth(5)
          .setName(`beverage-cooler-row-${rowIndex}`)
      );
      this.rowItems.push([]);
      this.countLabels.push(this.createCountLabel(slot, rowIndex));
    });

    this.syncRush({
      filledRowIndexes: [],
      rowItemCounts: Array.from({ length: this.slots.length }, () => 0),
      activeRowIndex: undefined,
      remainingRatio: 1,
      interactionEnabled: false
    });
  }

  sync(stockedRows: number): void {
    const safeRows = Math.max(0, Math.min(stockedRows, this.slots.length));
    const counts = this.slots.map((_, index) => (
      index < safeRows ? COOLER_STOCK_ITEMS_PER_SLOT : 0
    ));
    this.syncItemCounts(counts, false);
    this.rowTargets.forEach((target) => target.disableInteractive());
    this.rowPlates.forEach((plate) => plate.setAlpha(0));
    this.countLabels.forEach((label) => label.setVisible(false));
  }

  syncRush(state: BeverageCoolerRushState): void {
    const filledRows = new Set(state.filledRowIndexes);
    this.syncItemCounts(state.rowItemCounts, true);

    this.rowTargets.forEach((target, index) => {
      const enabled = state.interactionEnabled && !filledRows.has(index);
      target.setAlpha(0.001);
      if (enabled && !target.input?.enabled) {
        target.setInteractive({ useHandCursor: true });
      } else if (!enabled && target.input?.enabled) {
        target.disableInteractive();
      }
    });

    this.rowPlates.forEach((plate, index) => {
      const active = state.activeRowIndex === index && !filledRows.has(index);
      plate.setAlpha(active ? 0.42 + (1 - state.remainingRatio) * 0.48 : 0);
    });

    this.countLabels.forEach((label, index) => {
      const count = this.safeItemCount(state.rowItemCounts[index]);
      const active = state.activeRowIndex === index && !filledRows.has(index);
      label
        .setText(`${count}/${COOLER_STOCK_ITEMS_PER_SLOT}`)
        .setVisible(active)
        .setAlpha(active ? 0.96 : 0);
    });

    filledRows.forEach((rowIndex) => {
      if (!this.previousFilledRows.has(rowIndex)) this.animateFilledRow(rowIndex);
    });
    this.previousFilledRows = filledRows;
  }

  rowCentre(rowIndex: number): { readonly x: number; readonly y: number } {
    const slot = this.slots[rowIndex];
    if (!slot) throw new Error(`Unknown cooler row ${rowIndex}`);
    return Object.freeze({ x: slot.x, y: slot.y });
  }

  showMistake(rowIndex: number): void {
    const centre = this.rowCentre(rowIndex);
    const width = this.shelfWidth(rowIndex) + 28;
    const height = this.rowHeight() + 10;
    const flash = this.scene.add.graphics().setDepth(14);
    flash.fillStyle(0xe45d52, 0.14);
    flash.fillRoundedRect(centre.x - width / 2, centre.y - height / 2, width, height, 7);
    flash.lineStyle(3, 0xff8f86, 0.9);
    flash.strokeRoundedRect(centre.x - width / 2, centre.y - height / 2, width, height, 7);
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 300,
      ease: "Quad.Out",
      onComplete: () => flash.destroy()
    });
  }

  destroy(): void {
    this.rowHolders.forEach((holder) => holder.destroy(true));
    this.bayBackings.forEach((backing) => backing.destroy());
    this.rowPlates.forEach((plate) => plate.destroy());
    this.rowTargets.forEach((target) => target.destroy());
    this.countLabels.forEach((label) => label.destroy());
    this.inputBlocker?.destroy();
  }

  private createInputBlocker(): void {
    const bounds = resolveCoolerStockBounds(this.config.centreX);
    this.inputBlocker = this.scene.add.rectangle(
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 2,
      bounds.width,
      bounds.height,
      0xffffff,
      0.001
    )
      .setDepth(8)
      .setInteractive()
      .setName("beverage-cooler-stock-input-blocker");
    this.inputBlocker.on(
      "pointerdown",
      (
        _pointer: Phaser.Input.Pointer,
        _localX: number,
        _localY: number,
        event: Phaser.Types.Input.EventData
      ) => event.stopPropagation()
    );
  }

  private animateFilledRow(rowIndex: number): void {
    const holder = this.rowHolders[rowIndex];
    if (!holder) return;
    holder.setScale(0.96);
    this.scene.tweens.add({
      targets: holder,
      scaleX: 1.04,
      scaleY: 1.04,
      yoyo: true,
      duration: 120,
      ease: "Sine.Out"
    });
    this.playRowSparkles(rowIndex);
  }

  private createBayBackings(rowHeight: number): void {
    const bayIndexes = [...new Set(this.slots.map((slot) => slot.bayIndex))];
    bayIndexes.forEach((bayIndex) => {
      const baySlots = this.slots.filter((slot) => slot.bayIndex === bayIndex);
      const firstSlot = baySlots[0];
      const lastSlot = baySlots.at(-1);
      if (!firstSlot || !lastSlot) return;

      const width = 76;
      const top = firstSlot.y - rowHeight / 2 - 8;
      const bottom = lastSlot.y + rowHeight / 2 + 8;
      const backing = this.scene.add.graphics().setDepth(4).setAlpha(0.78);
      backing.fillStyle(0x10251f, 0.36);
      backing.fillRoundedRect(firstSlot.x - width / 2, top, width, bottom - top, 8);
      backing.lineStyle(1, 0x9db7ad, 0.22);
      backing.strokeRoundedRect(firstSlot.x - width / 2, top, width, bottom - top, 8);
      backing.lineStyle(2, 0xc6d5cf, 0.32);
      baySlots.forEach((slot) => {
        const shelfY = slot.y + rowHeight / 2 + 3;
        backing.lineBetween(firstSlot.x - width / 2 + 6, shelfY, firstSlot.x + width / 2 - 6, shelfY);
      });
      this.bayBackings.push(backing);
    });
  }

  private createRowPlate(
    slot: CoolerStockSlot,
    rowIndex: number,
    rowHeight: number
  ): Phaser.GameObjects.Graphics {
    const width = this.shelfWidth(rowIndex) + 26;
    const height = rowHeight + 8;
    const plate = this.scene.add.graphics().setDepth(10).setAlpha(0);
    plate.fillStyle(0xffd95e, 0.06);
    plate.fillRoundedRect(slot.x - width / 2, slot.y - height / 2, width, height, 7);
    plate.lineStyle(3, 0xffd95e, 0.92);
    plate.strokeRoundedRect(slot.x - width / 2, slot.y - height / 2, width, height, 7);
    return plate;
  }

  private createCountLabel(slot: CoolerStockSlot, rowIndex: number): Phaser.GameObjects.Text {
    return this.scene.add.text(
      slot.x + this.shelfWidth(rowIndex) / 2 + 10,
      slot.y - this.rowHeight() / 2 - 3,
      `0/${COOLER_STOCK_ITEMS_PER_SLOT}`,
      {
        fontFamily: "Arial, sans-serif",
        fontSize: "11px",
        fontStyle: "bold",
        color: "#26352d",
        backgroundColor: "#ffd95e",
        padding: { x: 5, y: 2 }
      }
    )
      .setOrigin(1, 1)
      .setDepth(13)
      .setVisible(false)
      .setName(`beverage-cooler-row-count-${rowIndex}`);
  }

  private syncItemCounts(counts: readonly number[], animateNewItems: boolean): void {
    this.slots.forEach((_slot, rowIndex) => {
      const desired = this.safeItemCount(counts[rowIndex]);
      const items = this.rowItems[rowIndex];
      if (!items) return;

      while (items.length > desired) {
        items.pop()?.destroy();
      }
      while (items.length < desired) {
        const itemIndex = items.length;
        const bottle = this.createStockBottle(rowIndex, itemIndex, animateNewItems);
        items.push(bottle);
      }
    });
  }

  private createStockBottle(
    rowIndex: number,
    itemIndex: number,
    animate: boolean
  ): Phaser.GameObjects.Image {
    const holder = this.rowHolders[rowIndex];
    const slot = this.slots[rowIndex];
    if (!holder || !slot) throw new Error(`Missing cooler shelf holder ${rowIndex}`);

    const target = this.itemLocalPosition(rowIndex, itemIndex);
    const targetScale = this.bottleScale(rowIndex);
    const bottle = this.scene.add.image(
      animate ? this.config.stockSource.x : target.x,
      animate ? this.config.stockSource.y - 28 : target.y,
      this.config.restockProductKey
    )
      .setCrop(
        BEVERAGE_BOTTLE_CROP.x,
        BEVERAGE_BOTTLE_CROP.y,
        BEVERAGE_BOTTLE_CROP.width,
        BEVERAGE_BOTTLE_CROP.height
      )
      .setDisplayOrigin(
        BEVERAGE_BOTTLE_CROP.x + BEVERAGE_BOTTLE_CROP.width / 2,
        BEVERAGE_BOTTLE_CROP.y + BEVERAGE_BOTTLE_CROP.height
      )
      .setScale(
        animate ? targetScale.x * 0.72 : targetScale.x,
        animate ? targetScale.y * 0.72 : targetScale.y
      )
      .setAlpha(animate ? 0.72 : 1)
      .setDepth(14)
      .setName(`beverage-cooler-row-${rowIndex}-item-${itemIndex}`);

    if (!animate) {
      holder.add(bottle);
      bottle.setPosition(target.x, target.y).setDepth(0);
      return bottle;
    }

    const worldTarget = { x: slot.x + target.x, y: slot.y + target.y };
    const liftY = Math.min(this.config.stockSource.y - 90, worldTarget.y - 90);
    this.scene.tweens.add({
      targets: bottle,
      x: worldTarget.x,
      y: liftY,
      alpha: 1,
      scaleX: targetScale.x * 0.92,
      scaleY: targetScale.y * 0.92,
      duration: 170,
      ease: "Quad.Out",
      onComplete: () => {
        this.scene.tweens.add({
          targets: bottle,
          y: worldTarget.y,
          scaleX: targetScale.x,
          scaleY: targetScale.y,
          duration: 130,
          ease: "Back.Out",
          onComplete: () => {
            holder.add(bottle);
            bottle.setPosition(target.x, target.y).setDepth(0);
            this.playItemLanding(worldTarget);
          }
        });
      }
    });
    return bottle;
  }

  private itemLocalPosition(rowIndex: number, itemIndex: number): CoolerStockPoint {
    const shelfWidth = this.shelfWidth(rowIndex);
    const spacing = shelfWidth / (COOLER_STOCK_ITEMS_PER_SLOT - 1);
    return Object.freeze({
      x: -shelfWidth / 2 + itemIndex * spacing,
      y: this.rowHeight() / 2 + 3
    });
  }

  private bottleScale(rowIndex: number): CoolerStockPoint {
    const progress = this.verticalProgress(rowIndex);
    const bottleHeight = Phaser.Math.Linear(52, 58, progress);
    const bottleWidth = bottleHeight * (BEVERAGE_BOTTLE_CROP.width / BEVERAGE_BOTTLE_CROP.height);
    return Object.freeze({
      x: bottleWidth / BEVERAGE_BOTTLE_CROP.width,
      y: bottleHeight / BEVERAGE_BOTTLE_CROP.height
    });
  }

  private safeItemCount(value: number | undefined): number {
    if (!Number.isFinite(value)) return 0;
    return Phaser.Math.Clamp(Math.floor(value ?? 0), 0, COOLER_STOCK_ITEMS_PER_SLOT);
  }

  private shelfWidth(rowIndex: number): number {
    return Phaser.Math.Linear(48, 54, this.verticalProgress(rowIndex));
  }

  private verticalProgress(rowIndex: number): number {
    const slot = this.slots[rowIndex];
    if (!slot) return 0;
    return Phaser.Math.Clamp(slot.shelfIndex / 2, 0, 1);
  }

  private rowHeight(): number {
    return 54;
  }

  private playItemLanding(point: CoolerStockPoint): void {
    const ring = this.scene.add.circle(point.x, point.y + 4, 8, 0xffd95e, 0.24)
      .setDepth(13)
      .setScale(0.5, 0.22);
    this.scene.tweens.add({
      targets: ring,
      scaleX: 1.5,
      scaleY: 0.5,
      alpha: 0,
      duration: 180,
      ease: "Quad.Out",
      onComplete: () => ring.destroy()
    });
  }

  private playRowSparkles(rowIndex: number): void {
    const centre = this.rowCentre(rowIndex);
    [-26, -13, 0, 13, 26].forEach((offset, index) => {
      const sparkle = this.scene.add.circle(
        centre.x + offset,
        centre.y - 3,
        3 + (index % 2),
        0xffe18a,
        0.82
      ).setDepth(15);
      this.scene.tweens.add({
        targets: sparkle,
        y: centre.y - 24 - (index % 3) * 5,
        alpha: 0,
        scaleX: 0.4,
        scaleY: 0.4,
        duration: 330 + index * 26,
        ease: "Cubic.Out",
        onComplete: () => sparkle.destroy()
      });
    });
  }
}
