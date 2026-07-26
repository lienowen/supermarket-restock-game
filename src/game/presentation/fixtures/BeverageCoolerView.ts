import Phaser from "phaser";
import {
  BEVERAGE_BOTTLE_CROP,
  COOLER_STOCK_ITEMS_PER_SLOT,
  COOLER_STOCK_SLOT_COUNT,
  COOLER_STOCK_TARGET_HEIGHT,
  COOLER_STOCK_TARGET_WIDTH,
  resolveCoolerStockBounds,
  resolveCoolerStockSlots,
  type CoolerStockSlot
} from "../visual/CoolerStockLayout";

export interface BeverageCoolerViewConfig {
  readonly centreX: number;
  readonly restockProductKey: string;
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
  readonly activeRowIndex?: number;
  readonly remainingRatio: number;
  readonly interactionEnabled: boolean;
}

/**
 * Six interactive stock slots arranged as two real glass-door bays with three
 * shelf segments each. Product sprites are cropped to their visible pixels and
 * grounded on continuous shelf lips inside each door.
 */
export class BeverageCoolerView {
  private readonly rows: Phaser.GameObjects.Container[] = [];
  private readonly bayBackings: Phaser.GameObjects.Graphics[] = [];
  private readonly rowPlates: Phaser.GameObjects.Graphics[] = [];
  private readonly rowTargets: Phaser.GameObjects.Rectangle[] = [];
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
      this.rows.push(this.createRestockRow(slot, rowIndex, rowHeight));
    });

    this.syncRush({
      filledRowIndexes: [],
      activeRowIndex: undefined,
      remainingRatio: 1,
      interactionEnabled: false
    });
  }

  sync(stockedRows: number): void {
    this.syncRush({
      filledRowIndexes: Array.from(
        { length: Math.max(0, Math.min(stockedRows, this.rows.length)) },
        (_, index) => index
      ),
      activeRowIndex: undefined,
      remainingRatio: 1,
      interactionEnabled: false
    });
  }

  syncRush(state: BeverageCoolerRushState): void {
    const filledRows = new Set(state.filledRowIndexes);
    this.rows.forEach((row, index) => {
      const filled = filledRows.has(index);
      const active = state.activeRowIndex === index && !filled;
      row.setAlpha(filled ? 1 : active ? 0.2 : 0.018);
    });

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
    this.rows.forEach((row) => row.destroy(true));
    this.bayBackings.forEach((backing) => backing.destroy());
    this.rowPlates.forEach((plate) => plate.destroy());
    this.rowTargets.forEach((target) => target.destroy());
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
    const row = this.rows[rowIndex];
    if (!row) return;
    row.setScale(0.84).setAlpha(1);
    this.scene.tweens.add({
      targets: row,
      scaleX: 1,
      scaleY: 1,
      duration: 250,
      ease: "Back.Out"
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

  private createRestockRow(
    slot: CoolerStockSlot,
    rowIndex: number,
    rowHeight: number
  ): Phaser.GameObjects.Container {
    const count = COOLER_STOCK_ITEMS_PER_SLOT;
    const shelfWidth = this.shelfWidth(rowIndex);
    const spacing = shelfWidth / (count - 1);
    const startX = -shelfWidth / 2;
    const progress = this.verticalProgress(rowIndex);
    const bottleHeight = Phaser.Math.Linear(52, 58, progress);
    const bottleWidth = bottleHeight * (BEVERAGE_BOTTLE_CROP.width / BEVERAGE_BOTTLE_CROP.height);
    const objects: Phaser.GameObjects.GameObject[] = [];

    for (let index = 0; index < count; index += 1) {
      const bottle = this.scene.add.image(
        startX + index * spacing,
        rowHeight / 2 + 3,
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
          bottleWidth / BEVERAGE_BOTTLE_CROP.width,
          bottleHeight / BEVERAGE_BOTTLE_CROP.height
        )
        .setDepth(5);
      objects.push(bottle);
    }

    return this.scene.add.container(slot.x, slot.y, objects)
      .setAlpha(0.018)
      .setDepth(5)
      .setName(`beverage-cooler-row-${rowIndex}`);
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
