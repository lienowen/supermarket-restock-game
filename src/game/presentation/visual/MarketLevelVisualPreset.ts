import {
  COOLER_STOCK_ITEMS_PER_SLOT,
  COOLER_STOCK_ROW_YS,
  COOLER_STOCK_TARGET_WIDTH
} from "./CoolerStockLayout";
import type { VisualPoint, VisualSize } from "./StarterMarketVisualSpec";

export type MarketLevelMode = "restock" | "checkout" | "clean" | "find-items";
export type MarketVisualPresetId =
  | "restock-standard-v1"
  | "checkout-standard-v1"
  | "clean-standard-v1"
  | "find-items-standard-v1";

interface BaseMarketLevelVisualPreset {
  readonly id: MarketVisualPresetId;
  readonly mode: MarketLevelMode;
  readonly actor: {
    readonly idleSize: VisualSize;
    readonly shadowOffset: VisualPoint;
  };
  readonly environment: {
    readonly focus: VisualPoint;
    readonly focusSize: VisualSize;
    readonly routeAlpha: number;
    readonly inactiveWashAlpha: number;
    readonly vignetteAlpha: number;
  };
}

export interface RestockLevelVisualPreset extends BaseMarketLevelVisualPreset {
  readonly id: "restock-standard-v1";
  readonly mode: "restock";
  readonly actor: BaseMarketLevelVisualPreset["actor"] & {
    readonly pushSize: VisualSize;
    readonly carrySize: VisualSize;
  };
  readonly cooler: {
    readonly baseY: number;
    readonly backgroundY: number;
    readonly frameSize: VisualSize;
    readonly displaySize: VisualSize;
    readonly rowYs: readonly number[];
    readonly activeStockWidth: number;
    readonly restockItemCount: number;
  };
  readonly props: {
    readonly caseSize: VisualSize;
    readonly cartSize: VisualSize;
  };
}

export interface CheckoutLevelVisualPreset extends BaseMarketLevelVisualPreset {
  readonly id: "checkout-standard-v1";
  readonly mode: "checkout";
  readonly workerStartOffset: VisualPoint;
  readonly station: {
    readonly counterOffsetY: number;
    readonly counterSize: VisualSize;
    readonly shadowSize: VisualSize;
    readonly registerOffset: VisualPoint;
    readonly laneLightOffset: VisualPoint;
    readonly scanBeamOffset: VisualPoint;
    readonly scanBeamSize: VisualSize;
    readonly servedExitOffset: VisualPoint;
  };
  readonly queue: {
    readonly panelOffset: VisualPoint;
    readonly panelSize: VisualSize;
    readonly basketSize: VisualSize;
    readonly basketGap: number;
    readonly visibleBasketCount: number;
  };
  readonly sign: {
    readonly centre: VisualPoint;
    readonly size: VisualSize;
  };
}

export interface CleanLevelVisualPreset extends BaseMarketLevelVisualPreset {
  readonly id: "clean-standard-v1";
  readonly mode: "clean";
  readonly fixture: { readonly position: VisualPoint; readonly size: VisualSize };
  readonly cartSize: VisualSize;
  readonly signSize: VisualSize;
  readonly signOffset: VisualPoint;
  readonly toolsTargetSize: VisualSize;
  readonly collectedToolsAlpha: number;
  readonly spillBaseSize: VisualSize;
  readonly spillTargetSize: VisualSize;
  readonly inactiveSpillAlpha: number;
  readonly activeSpillAlpha: number;
  readonly spillColor: number;
  readonly spillEdgeColor: number;
  readonly spillHighlightColor: number;
}

export interface FindItemsLevelVisualPreset extends BaseMarketLevelVisualPreset {
  readonly id: "find-items-standard-v1";
  readonly mode: "find-items";
  readonly fixture: { readonly position: VisualPoint; readonly size: VisualSize };
  readonly auxiliaryFixtures: readonly {
    readonly assetKey: string;
    readonly position: VisualPoint;
    readonly size: VisualSize;
  }[];
  readonly basket: { readonly position: VisualPoint; readonly size: VisualSize };
  readonly orderTicket: {
    readonly centre: VisualPoint;
    readonly size: VisualSize;
    readonly slotSize: VisualSize;
    readonly iconMaxSize: VisualSize;
    readonly itemGap: number;
  };
  readonly itemSizes: Readonly<Record<string, VisualSize>>;
  readonly itemPositions: Readonly<Record<string, VisualPoint>>;
}

export type MarketLevelVisualPreset =
  | RestockLevelVisualPreset
  | CheckoutLevelVisualPreset
  | CleanLevelVisualPreset
  | FindItemsLevelVisualPreset;

const SHARED_ACTOR = Object.freeze({
  idleSize: Object.freeze({ width: 300, height: 315 }),
  shadowOffset: Object.freeze({ x: 0, y: 5 })
});

export const RESTOCK_VISUAL_PRESET: RestockLevelVisualPreset = Object.freeze({
  id: "restock-standard-v1",
  mode: "restock",
  actor: Object.freeze({
    idleSize: Object.freeze({ width: 380, height: 385 }),
    shadowOffset: SHARED_ACTOR.shadowOffset,
    pushSize: Object.freeze({ width: 400, height: 370 }),
    carrySize: Object.freeze({ width: 370, height: 360 })
  }),
  environment: Object.freeze({
    focus: Object.freeze({ x: 1050, y: 590 }),
    focusSize: Object.freeze({ width: 820, height: 390 }),
    routeAlpha: 0,
    inactiveWashAlpha: 0,
    vignetteAlpha: 0.05
  }),
  cooler: Object.freeze({
    baseY: 540,
    backgroundY: 530,
    frameSize: Object.freeze({ width: 620, height: 520 }),
    displaySize: Object.freeze({ width: 470, height: 700 }),
    rowYs: COOLER_STOCK_ROW_YS,
    activeStockWidth: COOLER_STOCK_TARGET_WIDTH,
    restockItemCount: COOLER_STOCK_ITEMS_PER_SLOT
  }),
  props: Object.freeze({
    caseSize: Object.freeze({ width: 195, height: 160 }),
    cartSize: Object.freeze({ width: 340, height: 285 })
  })
});

export const CHECKOUT_VISUAL_PRESET: CheckoutLevelVisualPreset = Object.freeze({
  id: "checkout-standard-v1",
  mode: "checkout",
  actor: Object.freeze({
    idleSize: Object.freeze({ width: 270, height: 285 }),
    shadowOffset: SHARED_ACTOR.shadowOffset
  }),
  environment: Object.freeze({
    focus: Object.freeze({ x: 1035, y: 735 }),
    focusSize: Object.freeze({ width: 500, height: 250 }),
    routeAlpha: 0,
    inactiveWashAlpha: 0,
    vignetteAlpha: 0.06
  }),
  workerStartOffset: Object.freeze({ x: -250, y: 0 }),
  station: Object.freeze({
    counterOffsetY: 12,
    counterSize: Object.freeze({ width: 390, height: 340 }),
    shadowSize: Object.freeze({ width: 275, height: 40 }),
    registerOffset: Object.freeze({ x: 42, y: -69 }),
    laneLightOffset: Object.freeze({ x: -66, y: -57 }),
    scanBeamOffset: Object.freeze({ x: -36, y: -32 }),
    scanBeamSize: Object.freeze({ width: 70, height: 6 }),
    servedExitOffset: Object.freeze({ x: 140, y: -10 })
  }),
  queue: Object.freeze({
    panelOffset: Object.freeze({ x: -12, y: -154 }),
    panelSize: Object.freeze({ width: 220, height: 86 }),
    basketSize: Object.freeze({ width: 54, height: 42 }),
    basketGap: 58,
    visibleBasketCount: 3
  }),
  sign: Object.freeze({
    centre: Object.freeze({ x: 1110, y: 170 }),
    size: Object.freeze({ width: 280, height: 50 })
  })
});

export const CLEAN_VISUAL_PRESET: CleanLevelVisualPreset = Object.freeze({
  id: "clean-standard-v1",
  mode: "clean",
  actor: Object.freeze({
    idleSize: Object.freeze({ width: 320, height: 330 }),
    shadowOffset: SHARED_ACTOR.shadowOffset
  }),
  environment: Object.freeze({
    focus: Object.freeze({ x: 1190, y: 760 }),
    focusSize: Object.freeze({ width: 380, height: 200 }),
    routeAlpha: 0,
    inactiveWashAlpha: 0,
    vignetteAlpha: 0.06
  }),
  fixture: Object.freeze({
    position: Object.freeze({ x: 1260, y: 790 }),
    size: Object.freeze({ width: 0, height: 0 })
  }),
  cartSize: Object.freeze({ width: 118, height: 128 }),
  signSize: Object.freeze({ width: 0, height: 0 }),
  signOffset: Object.freeze({ x: 0, y: 0 }),
  toolsTargetSize: Object.freeze({ width: 180, height: 130 }),
  collectedToolsAlpha: 0.2,
  spillBaseSize: Object.freeze({ width: 88, height: 38 }),
  spillTargetSize: Object.freeze({ width: 126, height: 64 }),
  inactiveSpillAlpha: 0.2,
  activeSpillAlpha: 0.68,
  spillColor: 0x6f98a4,
  spillEdgeColor: 0xcce4e9,
  spillHighlightColor: 0xf4ffff
});

export const FIND_ITEMS_VISUAL_PRESET: FindItemsLevelVisualPreset = Object.freeze({
  id: "find-items-standard-v1",
  mode: "find-items",
  actor: Object.freeze({
    idleSize: Object.freeze({ width: 360, height: 390 }),
    shadowOffset: Object.freeze({ x: 0, y: 8 })
  }),
  environment: Object.freeze({
    focus: Object.freeze({ x: 930, y: 675 }),
    focusSize: Object.freeze({ width: 1040, height: 360 }),
    routeAlpha: 0,
    inactiveWashAlpha: 0,
    vignetteAlpha: 0.025
  }),
  fixture: Object.freeze({
    position: Object.freeze({ x: 1180, y: 650 }),
    size: Object.freeze({ width: 520, height: 360 })
  }),
  auxiliaryFixtures: Object.freeze([
    Object.freeze({
      assetKey: "fixture-produce-display-a",
      position: Object.freeze({ x: 720, y: 720 }),
      size: Object.freeze({ width: 360, height: 250 })
    })
  ]),
  basket: Object.freeze({
    position: Object.freeze({ x: 875, y: 812 }),
    size: Object.freeze({ width: 104, height: 68 })
  }),
  orderTicket: Object.freeze({
    centre: Object.freeze({ x: 1310, y: 178 }),
    size: Object.freeze({ width: 330, height: 118 }),
    slotSize: Object.freeze({ width: 86, height: 64 }),
    iconMaxSize: Object.freeze({ width: 46, height: 50 }),
    itemGap: 92
  }),
  itemSizes: Object.freeze({
    "milk-bottle": Object.freeze({ width: 68, height: 96 }),
    apple: Object.freeze({ width: 64, height: 64 }),
    "cereal-box": Object.freeze({ width: 72, height: 100 })
  }),
  itemPositions: Object.freeze({
    "milk-bottle": Object.freeze({ x: 1045, y: 565 }),
    apple: Object.freeze({ x: 720, y: 655 }),
    "cereal-box": Object.freeze({ x: 1195, y: 565 })
  })
});

const PRESETS: Readonly<Record<MarketVisualPresetId, MarketLevelVisualPreset>> = Object.freeze({
  [RESTOCK_VISUAL_PRESET.id]: RESTOCK_VISUAL_PRESET,
  [CHECKOUT_VISUAL_PRESET.id]: CHECKOUT_VISUAL_PRESET,
  [CLEAN_VISUAL_PRESET.id]: CLEAN_VISUAL_PRESET,
  [FIND_ITEMS_VISUAL_PRESET.id]: FIND_ITEMS_VISUAL_PRESET
});

export function resolveMarketLevelVisualPreset(
  presetId: string,
  expectedMode: "restock"
): RestockLevelVisualPreset;
export function resolveMarketLevelVisualPreset(
  presetId: string,
  expectedMode: "checkout"
): CheckoutLevelVisualPreset;
export function resolveMarketLevelVisualPreset(
  presetId: string,
  expectedMode: "clean"
): CleanLevelVisualPreset;
export function resolveMarketLevelVisualPreset(
  presetId: string,
  expectedMode: "find-items"
): FindItemsLevelVisualPreset;
export function resolveMarketLevelVisualPreset(
  presetId: string,
  expectedMode: MarketLevelMode
): MarketLevelVisualPreset {
  const preset = PRESETS[presetId as MarketVisualPresetId];
  if (!preset) throw new Error(`Unknown market visual preset: ${presetId}`);
  if (preset.mode !== expectedMode) {
    throw new Error(`Visual preset ${presetId} belongs to ${preset.mode}, not ${expectedMode}`);
  }
  return preset;
}
