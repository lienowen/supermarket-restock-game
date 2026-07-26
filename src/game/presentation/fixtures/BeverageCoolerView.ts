import Phaser from "phaser";
import {
  BEVERAGE_BOTTLE_CROP,
  COOLER_STOCK_SLOT_OFFSETS,
  resolveCoolerStockSlots,
  type CoolerStockSlot
} from "../interactions/RestockTargetResolver";

export interface BeverageCoolerViewConfig {
  readonly centreX: number;
  readonly baseY: number;
  readonly backgroundY: number;
  readonly frameWidth: number;
  readonly frameHeight: number;
  readonly displayWidth: number;
  readonly displayHeight: number;
  readonly departmentLabel: string;
  readonly subtitleLabel: string;
  readonly rowYs: readonly number[];
  readonly ambientPositions: readonly number[];
  readonly restockStartX: number;
  readonly restockStepX: number;
  readonly restockItemCount: number;
  readonly coolerAssetKey: string;
  readonly ambientProductKeys: readonly string[];
  readonly restockProductKey: string;
  readonly onRowSelected?: (rowIndex: number) => void;
}

export interface BeverageCoolerRushState {
  readonly filledRowIndexes: readonly number[];
  readonly activeRowIndex?: number;
  readonly remainingRatio: number;
  readonly interactionEnabled: boolean;
}

/**
 * Six interactive stock slots arranged as two real glass-door bays with three
 * shelf segments each. Product sprites are cropped to their visible pixels,
 * masked against the busy photographed stock, and grounded on shelf lips.
 */
export class BeverageCoolerView {
  private readonly rows: Phaser.GameObjects.Container[] = [];
  private readonly rowBackings: Phaser.GameObjects.Graphics[] = [];
  private readonly rowPlates: Phaser.GameObjects.Graphics[] = [];
  private readonly rowTargets: Phaser.GameObjects.Rectangle[] = [];
  private readonly slots: readonly CoolerStockSlot[];
  private previousFilledRows = new Set<number>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly config: BeverageCoolerViewConfig
  ) {
    this.slots = resolveCoolerStockSlots(config.centreX);
    if (config.rowYs.length !== COOLER_STOCK_SLOT_OFFSETS.length) {
      throw new Error(
        `Beverage cooler requires ${COOLER_STOCK_SLOT_OFFSETS.length} task slots, ` +
        `received ${config.rowYs.length}`
      );
    }
  }

  create(): void {
    const rowHeight = this.rowHeight();
    this.slots.forEach((slot, rowIndex) => {
      const shelfWidth = this.shelfWidth(rowIndex);
      this.rowBackings.push(this.createRowBacking(slot, rowIndex, rowHeight));

      const target = this.scene.add.rectangle(
        slot.x,
        slot.y,
        shelfWidth + 34,
        rowHeight + 20,
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
      row.setAlpha(filled ? 1 : active ? 0.22 : 0.025);
    });

    this.rowBackings.forEach((backing, index) => {
      const filled = filledRows.has(index);
      const active = state.activeRowIndex === index && !filled;
      backing.setAlpha(filled ? 0.84 : active ? 0.95 : 0.56);
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
    const width = this.shelfWidth(rowIndex) + 30;
    const height = this.rowHeight() + 12;
    const flash = this.scene.add.graphics().setDepth(14);
    flash.fillStyle(0xe45d52, 0.14);
    flash.fillRoundedRect(centre.x - width / 2, centre.y - height / 2, width, height, 8);
    flash.lineStyle(3, 0xff8f86, 0.9);
    flash.strokeRoundedRect(centre.x - width / 2, centre.y - height / 2, width, height, 8);
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
    this.rowBackings.forEach((backing) => backing.destroy());
    this.rowPlates.forEach((plate) => plate.destroy());
    this.rowTargets.forEach((target) => target.destroy());
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

  private createRowBacking(
    slot: CoolerStockSlot,
    rowIndex: number,
    rowHeight: number
  ): Phaser.GameObjects.Graphics {
    const width = this.shelfWidth(rowIndex) + 24;
    const height = rowHeight + 14;
    const backing = this.scene.add.graphics().setDepth(4);
    backing.fillStyle(0x10211d, 0.72);
    backing.fillRoundedRect(slot.x - width / 2, slot.y - height / 2, width, height, 7);
    backing.lineStyle(1, 0x9db7ad, 0.34);
    backing.strokeRoundedRect(slot.x - width / 2, slot.y - height / 2, width, height, 7);
    backing.lineStyle(3, 0xc7d7d0, 0.46);
    backing.lineBetween(
      slot.x - width / 2 + 5,
      slot.y + height / 2 - 5,
      slot.x + width / 2 - 5,
      slot.y + height / 2 - 5
    );
    return backing;
  }

  private createRowPlate(
    slot: CoolerStockSlot,
    rowIndex: number,
    rowHeight: number
  ): Phaser.GameObjects.Graphics {
    const width = this.shelfWidth(rowIndex) + 28;
    const height = rowHeight + 10;
    const plate = this.scene.add.graphics().setDepth(10).setAlpha(0);
    plate.fillStyle(0xffd95e, 0.07);
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
    const count = Phaser.Math.Clamp(this.config.restockItemCount, 3, 3);
    const shelfWidth = this.shelfWidth(rowIndex);
    const spacing = shelfWidth / (count - 1);
    const startX = -shelfWidth / 2;
    const progress = this.verticalProgress(rowIndex);
    const bottleHeight = Phaser.Math.Linear(50, 56, progress);
    const bottleWidth = bottleHeight * (BEVERAGE_BOTTLE_CROP.width / BEVERAGE_BOTTLE_CROP.height);
    const objects: Phaser.GameObjects.GameObject[] = [];

    for (let index = 0; index < count; index += 1) {
      const bottle = this.scene.add.image(
        startX + index * spacing,
        rowHeight / 2 + 2,
        this.config.restockProductKey
      )
        .setCrop(
          BEVERAGE_BOTTLE_CROP.x,
          BEVERAGE_BOTTLE_CROP.y,
          BEVERAGE_BOTTLE_CROP.width,
          BEVERAGE_BOTTLE_CROP.height
        )
        .setOrigin(0.5, 1)
        .setDisplaySize(bottleWidth, bottleHeight)
        .setDepth(5);
      objects.push(bottle);
    }

    return this.scene.add.container(slot.x, slot.y, objects)
      .setAlpha(0.025)
      .setDepth(5)
      .setName(`beverage-cooler-row-${rowIndex}`);
  }

  private shelfWidth(rowIndex: number): number {
    return Phaser.Math.Linear(50, 56, this.verticalProgress(rowIndex));
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
    [-28, -14, 0, 14, 28].forEach((offset, index) => {
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
