import Phaser from "phaser";
import { COOLER_STOCK_ITEMS_PER_SLOT } from "../visual/CoolerStockLayout";

const HD_ASSETS = Object.freeze({
  marketBackground: "restock-market-bg-hd-v3",
  coolerBack: "restock-cooler-empty-hd-v3",
  coolerGlass: "restock-cooler-glass-hd-v3",
  colaBottle: "restock-cola-bottle-hd-v2",
  caseClosed: "restock-cola-case-closed-hd-v2",
  caseOpen: "restock-cola-case-open-hd-v2"
});

const HD_PATHS = Object.freeze({
  marketBackground: "assets/game/production-v3/cooler-restock/market_bg_hd.png",
  coolerBack: "assets/game/production-v3/cooler-restock/cooler_empty_back_hd.png",
  coolerGlass: "assets/game/production-v3/cooler-restock/cooler_front_glass_hd.png",
  colaBottle: "assets/game/production-v2/cooler-restock/cola_bottle_hd.png",
  caseClosed: "assets/game/production-v2/cooler-restock/cola_case_closed_hd.png",
  caseOpen: "assets/game/production-v2/cooler-restock/cola_case_open_hd.png"
});

export const HD_RESTOCK_ASSET_KEYS = HD_ASSETS;

export function preloadHdRestockAssets(scene: Phaser.Scene): void {
  scene.load.image(HD_ASSETS.marketBackground, HD_PATHS.marketBackground);
  scene.load.image(HD_ASSETS.coolerBack, HD_PATHS.coolerBack);
  scene.load.image(HD_ASSETS.coolerGlass, HD_PATHS.coolerGlass);
  scene.load.image(HD_ASSETS.colaBottle, HD_PATHS.colaBottle);
  scene.load.image(HD_ASSETS.caseClosed, HD_PATHS.caseClosed);
  scene.load.image(HD_ASSETS.caseOpen, HD_PATHS.caseOpen);
}

export function createHdRestockBackground(
  scene: Phaser.Scene,
  width: number,
  height: number
): Phaser.GameObjects.Image {
  document.body.dataset.restockWorldBackground = "production-v3-hd";
  return scene.add.image(width / 2, height / 2, HD_ASSETS.marketBackground)
    .setOrigin(0.5)
    .setDisplaySize(width, height)
    .setDepth(-28)
    .setName("restock-market-background-hd-v3");
}

export interface CoolerStockPoint {
  readonly x: number;
  readonly y: number;
}

interface HdCoolerSlot extends CoolerStockPoint {
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

const CLOSEUP_CENTRE_X = 800;
const CLOSEUP_CENTRE_Y = 466;
const CLOSEUP_WIDTH = 1040;
const CLOSEUP_HEIGHT = 694;
const SLOT_XS = [620, 980] as const;
const SLOT_YS = [300, 428, 543] as const;
const SHELF_BASELINE_YS = [367, 487, 598] as const;
const SLOT_WIDTH = 280;
const SLOT_HEIGHT = 112;
const BASE_DEPTH = 48;

const createSlots = (): readonly HdCoolerSlot[] => Object.freeze(
  SLOT_XS.flatMap((x, bayIndex) => SLOT_YS.map((y, shelfIndex) => Object.freeze({
    x,
    y,
    bayIndex,
    shelfIndex
  })))
);

/**
 * Dedicated restock close-up. The world remains visible while the employee
 * moves the case, then the view switches to a full readable cooler when the
 * actual stocking phase starts. Empty cabinet, product instances and glass are
 * separate layers, so shortage and full states are real state changes.
 */
export class BeverageCoolerView {
  private readonly slots = createSlots();
  private readonly rowHolders: Phaser.GameObjects.Container[] = [];
  private readonly rowItems: Phaser.GameObjects.Image[][] = [];
  private readonly rowTargets: Phaser.GameObjects.Rectangle[] = [];
  private readonly rowPlates: Phaser.GameObjects.Graphics[] = [];
  private readonly countLabels: Phaser.GameObjects.Text[] = [];
  private readonly panel: Phaser.GameObjects.Rectangle;
  private readonly coolerBack: Phaser.GameObjects.Image;
  private readonly coolerGlass: Phaser.GameObjects.Image;
  private readonly title: Phaser.GameObjects.Text;
  private readonly subtitle: Phaser.GameObjects.Text;
  private previousFilledRows = new Set<number>();
  private visible = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly config: BeverageCoolerViewConfig
  ) {
    this.panel = scene.add.rectangle(
      CLOSEUP_CENTRE_X,
      CLOSEUP_CENTRE_Y,
      CLOSEUP_WIDTH + 48,
      CLOSEUP_HEIGHT + 46,
      0x07130f,
      0.9
    )
      .setStrokeStyle(3, 0xd9b84f, 0.52)
      .setDepth(BASE_DEPTH)
      .setName("restock-cooler-closeup-panel");

    this.coolerBack = scene.add.image(
      CLOSEUP_CENTRE_X,
      CLOSEUP_CENTRE_Y,
      HD_ASSETS.coolerBack
    )
      .setDisplaySize(CLOSEUP_WIDTH, CLOSEUP_HEIGHT)
      .setDepth(BASE_DEPTH + 1)
      .setName("restock-cooler-empty-back-hd");

    this.coolerGlass = scene.add.image(
      CLOSEUP_CENTRE_X,
      CLOSEUP_CENTRE_Y,
      HD_ASSETS.coolerGlass
    )
      .setDisplaySize(CLOSEUP_WIDTH, CLOSEUP_HEIGHT)
      .setAlpha(0.28)
      .setDepth(BASE_DEPTH + 5)
      .setName("restock-cooler-front-glass-hd");

    this.title = scene.add.text(800, 160, "RESTOCK THE EMPTY COOLER", {
      fontFamily: "Arial, sans-serif",
      fontSize: "28px",
      fontStyle: "bold",
      color: "#f8faf8",
      backgroundColor: "#1f302b",
      padding: { x: 18, y: 9 }
    })
      .setOrigin(0.5)
      .setDepth(BASE_DEPTH + 8)
      .setName("restock-cooler-closeup-title");

    this.subtitle = scene.add.text(800, 202, "6 SHELVES · 3 BOTTLES PER SHELF", {
      fontFamily: "Arial, sans-serif",
      fontSize: "15px",
      fontStyle: "bold",
      color: "#314039",
      backgroundColor: "#f4d26a",
      padding: { x: 12, y: 5 }
    })
      .setOrigin(0.5)
      .setDepth(BASE_DEPTH + 8)
      .setName("restock-cooler-closeup-subtitle");
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

    this.syncRush({
      filledRowIndexes: [],
      rowItemCounts: Array.from({ length: this.slots.length }, () => 0),
      activeRowIndex: undefined,
      remainingRatio: 1,
      interactionEnabled: false
    });
    this.setPresentationVisible(false);
  }

  sync(stockedRows: number): void {
    const safeRows = Phaser.Math.Clamp(Math.floor(stockedRows), 0, this.slots.length);
    const counts = this.slots.map((_, index) => (
      index < safeRows ? COOLER_STOCK_ITEMS_PER_SLOT : 0
    ));
    this.syncItemCounts(counts, false);
    this.setPresentationVisible(false);
  }

  syncRush(state: BeverageCoolerRushState): void {
    this.setPresentationVisible(true);
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
      const memoryChoice =
        ["memory", "wave-memory"].includes(document.body.dataset.restockChallenge ?? "") &&
        state.interactionEnabled &&
        !filledRows.has(index);
      plate
        .setVisible(active || memoryChoice)
        .setAlpha(active ? 0.52 + (1 - state.remainingRatio) * 0.34 : memoryChoice ? 0.12 : 0);
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
    this.panel.destroy();
    this.coolerBack.destroy();
    this.coolerGlass.destroy();
    this.title.destroy();
    this.subtitle.destroy();
  }

  private setPresentationVisible(visible: boolean): void {
    if (this.visible === visible) return;
    this.visible = visible;
    this.panel.setVisible(visible);
    this.coolerBack.setVisible(visible);
    this.coolerGlass.setVisible(visible);
    this.title.setVisible(visible);
    this.subtitle.setVisible(visible);
    this.rowHolders.forEach((holder) => holder.setVisible(visible));
    this.rowPlates.forEach((plate) => plate.setVisible(false));
    this.countLabels.forEach((label) => label.setVisible(false));
    this.rowTargets.forEach((target) => {
      target.setVisible(visible);
      if (!visible && target.input?.enabled) target.disableInteractive();
    });
    document.body.dataset.restockCoolerView = visible ? "hd-closeup" : "world";
  }

  private createRowPlate(slot: HdCoolerSlot): Phaser.GameObjects.Graphics {
    const plate = this.scene.add.graphics()
      .setDepth(BASE_DEPTH + 6)
      .setVisible(false);
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

  private createCountLabel(slot: HdCoolerSlot, rowIndex: number): Phaser.GameObjects.Text {
    return this.scene.add.text(
      slot.x + SLOT_WIDTH / 2 - 10,
      slot.y - SLOT_HEIGHT / 2 + 10,
      `0/${COOLER_STOCK_ITEMS_PER_SLOT}`,
      {
        fontFamily: "Arial, sans-serif",
        fontSize: "16px",
        fontStyle: "bold",
        color: "#26352d",
        backgroundColor: "#ffd95e",
        padding: { x: 8, y: 4 }
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
    const bottleHeight = Phaser.Math.Linear(96, 112, slot.shelfIndex / 2);
    const sourceX = this.config.stockSource.x;
    const sourceY = this.config.stockSource.y - 34;
    const bottle = this.scene.add.image(
      animate ? sourceX : localTarget.x,
      animate ? sourceY : localTarget.y,
      HD_ASSETS.colaBottle
    )
      .setOrigin(0.5, 1)
      .setDisplaySize(46, bottleHeight)
      .setAlpha(animate ? 0.72 : 1)
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
    bottle.setScale(0.7);
    const liftY = Math.min(sourceY - 90, worldTarget.y - 110);
    this.scene.tweens.add({
      targets: bottle,
      x: worldTarget.x,
      y: liftY,
      alpha: 1,
      scaleX: 0.92,
      scaleY: 0.92,
      duration: 190,
      ease: "Quad.Out",
      onComplete: () => {
        this.scene.tweens.add({
          targets: bottle,
          y: worldTarget.y,
          scaleX: 1,
          scaleY: 1,
          duration: 150,
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
    const positions = [-72, 0, 72] as const;
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
    holder.setScale(0.96);
    this.scene.tweens.add({
      targets: holder,
      scaleX: 1.05,
      scaleY: 1.05,
      yoyo: true,
      duration: 130,
      ease: "Sine.Out"
    });
    this.playRowSparkles(rowIndex);
  }

  private playItemLanding(point: CoolerStockPoint): void {
    const ring = this.scene.add.circle(point.x, point.y + 3, 12, 0xffd95e, 0.28)
      .setDepth(BASE_DEPTH + 6)
      .setScale(0.5, 0.22);
    this.scene.tweens.add({
      targets: ring,
      scaleX: 1.7,
      scaleY: 0.52,
      alpha: 0,
      duration: 200,
      ease: "Quad.Out",
      onComplete: () => ring.destroy()
    });
  }

  private playRowSparkles(rowIndex: number): void {
    const centre = this.rowCentre(rowIndex);
    [-62, -31, 0, 31, 62].forEach((offset, index) => {
      const sparkle = this.scene.add.circle(
        centre.x + offset,
        centre.y - 4,
        4 + (index % 2),
        0xffe18a,
        0.86
      ).setDepth(BASE_DEPTH + 10);
      this.scene.tweens.add({
        targets: sparkle,
        y: centre.y - 44 - (index % 3) * 7,
        alpha: 0,
        scaleX: 0.4,
        scaleY: 0.4,
        duration: 350 + index * 28,
        ease: "Cubic.Out",
        onComplete: () => sparkle.destroy()
      });
    });
  }
}
