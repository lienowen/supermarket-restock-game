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

const ASSET_KEYS = Object.freeze({
  coolerBack: "restock-cooler-empty-hd-v3",
  coolerGlass: "restock-cooler-glass-hd-v3",
  colaBottle: "restock-cola-bottle-hd-v2"
});

const COOLER_CENTRE_X = 1180;
const COOLER_CENTRE_Y = 500;
const COOLER_WIDTH = 620;
const COOLER_HEIGHT = 620;
const SLOT_XS = [1070, 1290] as const;
const SLOT_YS = [330, 475, 620] as const;
const SHELF_BASELINE_YS = [395, 540, 685] as const;
const SLOT_WIDTH = 178;
const SLOT_HEIGHT = 112;
const BASE_DEPTH = 18;

const createSlots = (): readonly IntegratedCoolerSlot[] => Object.freeze(
  SLOT_XS.flatMap((x, bayIndex) => SLOT_YS.map((y, shelfIndex) => Object.freeze({
    x,
    y,
    bayIndex,
    shelfIndex
  })))
);

/**
 * World-integrated cooler presentation. The supermarket background, employee,
 * cart and case remain visible while the six real shelf slots are stocked.
 */
export class IntegratedBeverageCoolerView {
  private readonly slots = createSlots();
  private readonly rowHolders: Phaser.GameObjects.Container[] = [];
  private readonly rowItems: Phaser.GameObjects.Image[][] = [];
  private readonly rowTargets: Phaser.GameObjects.Rectangle[] = [];
  private readonly rowPlates: Phaser.GameObjects.Graphics[] = [];
  private readonly countLabels: Phaser.GameObjects.Text[] = [];
  private readonly groundingShadow: Phaser.GameObjects.Rectangle;
  private readonly coolerBack: Phaser.GameObjects.Image;
  private readonly coolerGlass: Phaser.GameObjects.Image;
  private readonly shelfRuleLabel: Phaser.GameObjects.Text;
  private previousFilledRows = new Set<number>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly config: BeverageCoolerViewConfig
  ) {
    this.groundingShadow = scene.add.rectangle(
      COOLER_CENTRE_X + 12,
      COOLER_CENTRE_Y + 14,
      COOLER_WIDTH + 24,
      COOLER_HEIGHT + 24,
      0x08110e,
      0.18
    )
      .setDepth(BASE_DEPTH)
      .setName("restock-cooler-world-shadow");

    this.coolerBack = scene.add.image(
      COOLER_CENTRE_X,
      COOLER_CENTRE_Y,
      ASSET_KEYS.coolerBack
    )
      .setDisplaySize(COOLER_WIDTH, COOLER_HEIGHT)
      .setDepth(BASE_DEPTH + 1)
      .setName("restock-cooler-empty-back-hd");

    this.coolerGlass = scene.add.image(
      COOLER_CENTRE_X,
      COOLER_CENTRE_Y,
      ASSET_KEYS.coolerGlass
    )
      .setDisplaySize(COOLER_WIDTH, COOLER_HEIGHT)
      .setAlpha(0.16)
      .setDepth(BASE_DEPTH + 5)
      .setName("restock-cooler-front-glass-hd");

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

    document.body.dataset.restockCoolerView = "world-integrated";
  }

  create(): void {
    this.slots.forEach((slot, rowIndex) => {
      const holder = this.scene.add.container(slot.x, slot.y)
        .setDepth(BASE_DEPTH + 3)
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
        .setDepth(BASE_DEPTH + 7)
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
      this.rowPlates.push(this.createRowPlate(slot));
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
    this.disableTargets();
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
      plate.setVisible(active).setAlpha(active ? 0.46 + (1 - state.remainingRatio) * 0.34 : 0);
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
    const flash = this.scene.add.graphics().setDepth(BASE_DEPTH + 10);
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
    this.groundingShadow.destroy();
    this.coolerBack.destroy();
    this.coolerGlass.destroy();
    this.shelfRuleLabel.destroy();
  }

  private disableTargets(): void {
    this.rowTargets.forEach((target) => {
      target.setVisible(true).setAlpha(0.001);
      if (target.input?.enabled) target.disableInteractive();
    });
  }

  private createRowPlate(slot: IntegratedCoolerSlot): Phaser.GameObjects.Graphics {
    const plate = this.scene.add.graphics()
      .setDepth(BASE_DEPTH + 6)
      .setVisible(false)
      .setName(`beverage-cooler-row-glow-${slot.bayIndex}-${slot.shelfIndex}`);
    plate.fillStyle(0xffd95e, 0.08);
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
      .setDepth(BASE_DEPTH + 9)
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
    const bottleHeight = Phaser.Math.Linear(82, 96, slot.shelfIndex / 2);
    const sourceX = this.config.stockSource.x;
    const sourceY = this.config.stockSource.y - 62;
    const bottle = this.scene.add.image(
      animate ? sourceX : localTarget.x,
      animate ? sourceY : localTarget.y,
      ASSET_KEYS.colaBottle
    )
      .setOrigin(0.5, 1)
      .setDisplaySize(40, bottleHeight)
      .setAlpha(animate ? 0.76 : 1)
      .setDepth(BASE_DEPTH + 4)
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
    const liftY = Math.min(sourceY - 72, worldTarget.y - 92);
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
    const positions = [-48, 0, 48] as const;
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
    this.playRowSparkles(rowIndex);
  }

  private playItemLanding(point: CoolerStockPoint): void {
    const ring = this.scene.add.circle(point.x, point.y + 3, 11, 0xffd95e, 0.28)
      .setDepth(BASE_DEPTH + 6)
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

  private playRowSparkles(rowIndex: number): void {
    const centre = this.rowCentre(rowIndex);
    [-45, -22, 0, 22, 45].forEach((offset, index) => {
      const sparkle = this.scene.add.circle(
        centre.x + offset,
        centre.y - 2,
        3 + (index % 2),
        0xffe18a,
        0.86
      ).setDepth(BASE_DEPTH + 10);
      this.scene.tweens.add({
        targets: sparkle,
        y: centre.y - 38 - (index % 3) * 6,
        alpha: 0,
        scaleX: 0.4,
        scaleY: 0.4,
        duration: 330 + index * 24,
        ease: "Cubic.Out",
        onComplete: () => sparkle.destroy()
      });
    });
  }
}
