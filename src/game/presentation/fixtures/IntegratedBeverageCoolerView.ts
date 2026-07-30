import Phaser from "phaser";
import { COOLER_STOCK_ITEMS_PER_SLOT } from "../visual/CoolerStockLayout";

export interface CoolerStockPoint {
  readonly x: number;
  readonly y: number;
}

interface IntegratedCoolerSlot extends CoolerStockPoint {
  readonly bayIndex: number;
  readonly shelfIndex: number;
}

export interface BeverageCoolerViewConfig {
  readonly centreX: number;
  readonly restockProductKey: string;
  readonly stockSource: CoolerStockPoint;
  readonly onRowSelected?: (rowIndex: number) => void;
  readonly baseY?: number;
  readonly backgroundY?: number;
  readonly frameWidth?: number;
  readonly frameHeight?: number;
  readonly displayWidth?: number;
  readonly displayHeight?: number;
  readonly departmentLabel?: string;
  readonly subtitleLabel?: string;
  readonly rowYs?: readonly number[];
  readonly ambientPositions?: readonly number[];
  readonly restockStartX?: number;
  readonly restockStepX?: number;
  readonly restockItemCount?: number;
  readonly coolerAssetKey?: string;
  readonly ambientProductKeys?: readonly string[];
}

export interface BeverageCoolerRushState {
  readonly filledRowIndexes: readonly number[];
  readonly rowItemCounts: readonly number[];
  readonly activeRowIndex?: number;
  readonly remainingRatio: number;
  readonly interactionEnabled: boolean;
}

const PRODUCT_KEY = "restock-cola-bottle-hd-v2";
const COOLER_CENTRE_X = 1065;
const SLOT_XS = [900, 1195] as const;
const SLOT_YS = [325, 460, 595] as const;
const SHELF_BASELINE_YS = [392, 527, 662] as const;
const SLOT_WIDTH = 230;
const SLOT_HEIGHT = 112;
const BASE_DEPTH = 20;
const GLASS_TOP = 218;
const GLASS_HEIGHT = 552;
const GLASS_PANELS = Object.freeze([
  Object.freeze({ x: 782, width: 276 }),
  Object.freeze({ x: 1073, width: 286 })
]);

const createSlots = (): readonly IntegratedCoolerSlot[] => Object.freeze(
  SLOT_XS.flatMap((x, bayIndex) => SLOT_YS.map((y, shelfIndex) => Object.freeze({
    x,
    y,
    bayIndex,
    shelfIndex
  })))
);

/**
 * Uses the empty cooler already baked into the HD supermarket background.
 * Interactive products are rendered between the photographed cabinet and a
 * lightweight foreground glass/shelf layer so they read as being inside it.
 */
export class IntegratedBeverageCoolerView {
  private readonly slots = createSlots();
  private readonly rowHolders: Phaser.GameObjects.Container[] = [];
  private readonly rowItems: Phaser.GameObjects.Image[][] = [];
  private readonly rowTargets: Phaser.GameObjects.Rectangle[] = [];
  private readonly rowPlates: Phaser.GameObjects.Graphics[] = [];
  private readonly countLabels: Phaser.GameObjects.Text[] = [];
  private readonly glassForeground: Phaser.GameObjects.Graphics;
  private readonly shelfRuleLabel: Phaser.GameObjects.Text;
  private previousFilledRows = new Set<number>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly config: BeverageCoolerViewConfig
  ) {
    this.glassForeground = this.createGlassForeground();
    this.shelfRuleLabel = scene.add.text(
      COOLER_CENTRE_X,
      126,
      "6 SHELVES · 3 BOTTLES PER SHELF",
      {
        fontFamily: "Arial, sans-serif",
        fontSize: "14px",
        fontStyle: "bold",
        color: "#28372f",
        backgroundColor: "#f4d26a",
        padding: { x: 13, y: 6 }
      }
    )
      .setOrigin(0.5)
      .setDepth(96)
      .setName("restock-cooler-shelf-rule");

    document.body.dataset.restockCoolerView = "background-integrated";
    document.body.dataset.restockCoolerForeground = "glass-and-shelf-lips";
  }

  create(): void {
    this.slots.forEach((slot, rowIndex) => {
      const holder = this.scene.add.container(slot.x, slot.y)
        .setDepth(BASE_DEPTH + 2)
        .setName(`beverage-cooler-row-${rowIndex}`);
      this.rowHolders.push(holder);
      this.rowItems.push([]);

      const target = this.scene.add.rectangle(
        slot.x,
        slot.y,
        SLOT_WIDTH,
        SLOT_HEIGHT,
        0xffffff,
        0.001
      )
        .setDepth(BASE_DEPTH + 6)
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
      this.rowPlates.push(this.createRowPlate(slot, rowIndex));
      this.countLabels.push(this.createCountLabel(slot, rowIndex));
    });

    this.sync(0);
  }

  sync(stockedRows: number): void {
    const safeRows = Phaser.Math.Clamp(Math.floor(stockedRows), 0, this.slots.length);
    const counts = this.slots.map((_, index) => (
      index < safeRows ? COOLER_STOCK_ITEMS_PER_SLOT : 0
    ));
    this.syncItemCounts(counts, false);
    this.rowTargets.forEach((target) => {
      target.setVisible(true).setAlpha(0.001);
      if (target.input?.enabled) target.disableInteractive();
    });
    this.rowPlates.forEach((plate) => plate.setVisible(false));
    this.countLabels.forEach((label) => label.setVisible(false));
  }

  syncRush(state: BeverageCoolerRushState): void {
    const filledRows = new Set(state.filledRowIndexes);
    this.syncItemCounts(state.rowItemCounts, true);

    this.rowTargets.forEach((target, index) => {
      const enabled = state.interactionEnabled && !filledRows.has(index);
      target.setVisible(true).setAlpha(0.001);
      if (enabled && !target.input?.enabled) {
        target.setInteractive({ useHandCursor: true });
      } else if (!enabled && target.input?.enabled) {
        target.disableInteractive();
      }
    });

    this.rowPlates.forEach((plate, index) => {
      const active = state.activeRowIndex === index && !filledRows.has(index);
      plate.setVisible(active).setAlpha(active ? 0.42 + (1 - state.remainingRatio) * 0.36 : 0);
    });

    this.countLabels.forEach((label, index) => {
      const count = this.safeItemCount(state.rowItemCounts[index]);
      const active = state.activeRowIndex === index && !filledRows.has(index);
      label
        .setText(`${count}/${COOLER_STOCK_ITEMS_PER_SLOT}`)
        .setVisible(active)
        .setAlpha(active ? 0.98 : 0);
    });

    filledRows.forEach((rowIndex) => {
      if (!this.previousFilledRows.has(rowIndex)) this.animateFilledRow(rowIndex);
    });
    this.previousFilledRows = filledRows;
  }

  rowCentre(rowIndex: number): CoolerStockPoint {
    const slot = this.slots[rowIndex];
    if (!slot) throw new Error(`Unknown cooler row ${rowIndex}`);
    return Object.freeze({ x: slot.x, y: slot.y });
  }

  showMistake(rowIndex: number): void {
    const centre = this.rowCentre(rowIndex);
    const flash = this.scene.add.graphics().setDepth(BASE_DEPTH + 9);
    flash.fillStyle(0xe45d52, 0.16);
    flash.fillRoundedRect(
      centre.x - SLOT_WIDTH / 2,
      centre.y - SLOT_HEIGHT / 2,
      SLOT_WIDTH,
      SLOT_HEIGHT,
      12
    );
    flash.lineStyle(4, 0xff8f86, 0.94);
    flash.strokeRoundedRect(
      centre.x - SLOT_WIDTH / 2,
      centre.y - SLOT_HEIGHT / 2,
      SLOT_WIDTH,
      SLOT_HEIGHT,
      12
    );
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 320,
      ease: "Quad.Out",
      onComplete: () => flash.destroy()
    });
  }

  destroy(): void {
    this.rowHolders.forEach((holder) => holder.destroy(true));
    this.rowTargets.forEach((target) => target.destroy());
    this.rowPlates.forEach((plate) => plate.destroy());
    this.countLabels.forEach((label) => label.destroy());
    this.glassForeground.destroy();
    this.shelfRuleLabel.destroy();
  }

  private createGlassForeground(): Phaser.GameObjects.Graphics {
    const foreground = this.scene.add.graphics()
      .setDepth(BASE_DEPTH + 4)
      .setName("restock-cooler-glass-foreground");

    GLASS_PANELS.forEach((panel, panelIndex) => {
      foreground.fillStyle(0xd7f6ff, 0.026);
      foreground.fillRect(panel.x, GLASS_TOP, panel.width, GLASS_HEIGHT);
      foreground.lineStyle(2, 0xffffff, 0.11);
      foreground.strokeRect(panel.x + 2, GLASS_TOP + 2, panel.width - 4, GLASS_HEIGHT - 4);

      foreground.lineStyle(5, 0xffffff, 0.045);
      foreground.lineBetween(
        panel.x + 24,
        GLASS_TOP + 18,
        panel.x + panel.width - 42,
        GLASS_TOP + 188
      );
      foreground.lineStyle(3, 0xcff5ff, 0.035);
      foreground.lineBetween(
        panel.x + panel.width * 0.62,
        GLASS_TOP + 26,
        panel.x + panel.width - 18,
        GLASS_TOP + 132 + panelIndex * 18
      );

      SHELF_BASELINE_YS.forEach((baselineY) => {
        foreground.lineStyle(7, 0x111817, 0.42);
        foreground.lineBetween(panel.x + 8, baselineY + 3, panel.x + panel.width - 8, baselineY + 3);
        foreground.lineStyle(3, 0xe8f0ee, 0.72);
        foreground.lineBetween(panel.x + 8, baselineY, panel.x + panel.width - 8, baselineY);
        foreground.lineStyle(1, 0xffffff, 0.58);
        foreground.lineBetween(panel.x + 10, baselineY - 2, panel.x + panel.width - 10, baselineY - 2);
      });
    });

    foreground.fillStyle(0x101716, 0.7);
    foreground.fillRoundedRect(1054, GLASS_TOP - 8, 20, GLASS_HEIGHT + 16, 5);
    foreground.fillStyle(0x202a28, 0.86);
    foreground.fillRoundedRect(1042, 342, 9, 128, 4);
    foreground.fillRoundedRect(1077, 342, 9, 128, 4);
    foreground.lineStyle(2, 0xffffff, 0.14);
    foreground.strokeRoundedRect(1042, 342, 9, 128, 4);
    foreground.strokeRoundedRect(1077, 342, 9, 128, 4);

    return foreground;
  }

  private createRowPlate(
    slot: IntegratedCoolerSlot,
    rowIndex: number
  ): Phaser.GameObjects.Graphics {
    const plate = this.scene.add.graphics()
      .setDepth(BASE_DEPTH + 5)
      .setVisible(false)
      .setName(`beverage-cooler-row-glow-${rowIndex}`);
    plate.fillStyle(0xffd95e, 0.07);
    plate.fillRoundedRect(
      slot.x - SLOT_WIDTH / 2,
      slot.y - SLOT_HEIGHT / 2,
      SLOT_WIDTH,
      SLOT_HEIGHT,
      12
    );
    plate.lineStyle(4, 0xffd95e, 0.94);
    plate.strokeRoundedRect(
      slot.x - SLOT_WIDTH / 2,
      slot.y - SLOT_HEIGHT / 2,
      SLOT_WIDTH,
      SLOT_HEIGHT,
      12
    );
    return plate;
  }

  private createCountLabel(slot: IntegratedCoolerSlot, rowIndex: number): Phaser.GameObjects.Text {
    return this.scene.add.text(
      slot.x + SLOT_WIDTH / 2 - 8,
      slot.y - SLOT_HEIGHT / 2 + 8,
      `0/${COOLER_STOCK_ITEMS_PER_SLOT}`,
      {
        fontFamily: "Arial, sans-serif",
        fontSize: "14px",
        fontStyle: "bold",
        color: "#26352d",
        backgroundColor: "#ffd95e",
        padding: { x: 7, y: 3 }
      }
    )
      .setOrigin(1, 0)
      .setDepth(BASE_DEPTH + 8)
      .setVisible(false)
      .setName(`beverage-cooler-row-count-${rowIndex}`);
  }

  private syncItemCounts(counts: readonly number[], animateNewItems: boolean): void {
    this.slots.forEach((_slot, rowIndex) => {
      const desired = this.safeItemCount(counts[rowIndex]);
      const items = this.rowItems[rowIndex];
      if (!items) return;

      while (items.length > desired) items.pop()?.destroy();
      while (items.length < desired) {
        const itemIndex = items.length;
        items.push(this.createStockBottle(rowIndex, itemIndex, animateNewItems));
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

    const localTarget = this.itemLocalPosition(rowIndex, itemIndex);
    const bottleHeight = Phaser.Math.Linear(76, 90, slot.shelfIndex / 2);
    const sourceX = this.config.stockSource.x - 18;
    const sourceY = this.config.stockSource.y - 96;
    const bottle = this.scene.add.image(
      animate ? sourceX : localTarget.x,
      animate ? sourceY : localTarget.y,
      PRODUCT_KEY
    )
      .setOrigin(0.5, 1)
      .setDisplaySize(36, bottleHeight)
      .setAlpha(animate ? 0.78 : 1)
      .setDepth(BASE_DEPTH + 3)
      .setName(`beverage-cooler-row-${rowIndex}-item-${itemIndex}`);

    if (!animate) {
      holder.add(bottle);
      bottle.setPosition(localTarget.x, localTarget.y).setDepth(0);
      return bottle;
    }

    const worldTarget = {
      x: slot.x + localTarget.x,
      y: slot.y + localTarget.y
    };
    bottle.setScale(0.72);
    const liftY = Math.min(sourceY - 70, worldTarget.y - 88);
    this.scene.tweens.add({
      targets: bottle,
      x: worldTarget.x,
      y: liftY,
      alpha: 1,
      scaleX: 0.92,
      scaleY: 0.92,
      duration: 210,
      ease: "Quad.Out",
      onComplete: () => {
        this.scene.tweens.add({
          targets: bottle,
          y: worldTarget.y,
          scaleX: 1,
          scaleY: 1,
          duration: 160,
          ease: "Back.Out",
          onComplete: () => {
            holder.add(bottle);
            bottle.setPosition(localTarget.x, localTarget.y).setDepth(0);
            this.playItemLanding(worldTarget);
          }
        });
      }
    });
    return bottle;
  }

  private itemLocalPosition(rowIndex: number, itemIndex: number): CoolerStockPoint {
    const slot = this.slots[rowIndex];
    if (!slot) throw new Error(`Missing cooler shelf geometry ${rowIndex}`);
    const positions = [-54, 0, 54] as const;
    const shelfBaselineY = SHELF_BASELINE_YS[slot.shelfIndex] ?? slot.y;
    return Object.freeze({
      x: positions[itemIndex] ?? 0,
      y: shelfBaselineY - slot.y
    });
  }

  private safeItemCount(value: number | undefined): number {
    if (!Number.isFinite(value)) return 0;
    return Phaser.Math.Clamp(Math.floor(value ?? 0), 0, COOLER_STOCK_ITEMS_PER_SLOT);
  }

  private animateFilledRow(rowIndex: number): void {
    const holder = this.rowHolders[rowIndex];
    if (!holder) return;
    holder.setScale(0.97);
    this.scene.tweens.add({
      targets: holder,
      scaleX: 1.05,
      scaleY: 1.05,
      yoyo: true,
      duration: 140,
      ease: "Sine.Out"
    });
  }

  private playItemLanding(point: CoolerStockPoint): void {
    const ring = this.scene.add.circle(point.x, point.y + 2, 10, 0xffd95e, 0.28)
      .setDepth(BASE_DEPTH + 5)
      .setScale(0.5, 0.22);
    this.scene.tweens.add({
      targets: ring,
      scaleX: 1.6,
      scaleY: 0.5,
      alpha: 0,
      duration: 210,
      ease: "Quad.Out",
      onComplete: () => ring.destroy()
    });
  }
}
