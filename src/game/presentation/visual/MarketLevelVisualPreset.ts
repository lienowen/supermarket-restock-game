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
    readonly customerSize: VisualSize;
    readonly columns: number;
    readonly columnGap: number;
    readonly rowGap: number;
    readonly rowDriftX: number;
    readonly alternatingYOffset: number;
    readonly baseScale: number;
    readonly rowScaleStep: number;
    readonly columnScaleStep: number;
    readonly minimumScale: number;
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
  readonly spillBaseSize: VisualSize;
}

export interface FindItemsLevelVisualPreset extends BaseMarketLevelVisualPreset {
  readonly id: "find-items-standard-v1";
  readonly mode: "find-items";
  readonly fixture: { readonly position: VisualPoint; readonly size: VisualSize };
  readonly basket: { readonly position: VisualPoint; readonly size: VisualSize };
  readonly itemSizes: Readonly<Record<string, VisualSize>>;
}

export type MarketLevelVisualPreset =
  | RestockLevelVisualPreset
  | CheckoutLevelVisualPreset
  | CleanLevelVisualPreset
  | FindItemsLevelVisualPreset;

const SHARED_ACTOR = Object.freeze({
  idleSize: Object.freeze({ width: 600, height: 420 }),
  shadowOffset: Object.freeze({ x: 0, y: 5 })
});

export const RESTOCK_VISUAL_PRESET: RestockLevelVisualPreset = Object.freeze({
  id: "restock-standard-v1",
  mode: "restock",
  actor: Object.freeze({
    ...SHARED_ACTOR,
    pushSize: Object.freeze({ width: 480, height: 430 }),
    carrySize: Object.freeze({ width: 500, height: 420 })
  }),
  cooler: Object.freeze({
    baseY: 495,
    backgroundY: 487,
    frameSize: Object.freeze({ width: 555, height: 660 }),
    displaySize: Object.freeze({ width: 1040, height: 1240 }),
    rowYs: Object.freeze([300, 375, 450, 525, 600, 675]),
    activeStockWidth: 220,
    restockItemCount: 5
  }),
  props: Object.freeze({
    caseSize: Object.freeze({ width: 405, height: 356 }),
    cartSize: Object.freeze({ width: 500, height: 410 })
  })
});

export const CHECKOUT_VISUAL_PRESET: CheckoutLevelVisualPreset = Object.freeze({
  id: "checkout-standard-v1",
  mode: "checkout",
  actor: SHARED_ACTOR,
  workerStartOffset: Object.freeze({ x: -95, y: -105 }),
  station: Object.freeze({
    counterOffsetY: 34,
    counterSize: Object.freeze({ width: 900, height: 810 }),
    shadowSize: Object.freeze({ width: 455, height: 64 }),
    registerOffset: Object.freeze({ x: 70, y: -150 }),
    laneLightOffset: Object.freeze({ x: -155, y: -122 }),
    scanBeamOffset: Object.freeze({ x: -90, y: -72 }),
    scanBeamSize: Object.freeze({ width: 112, height: 8 }),
    servedExitOffset: Object.freeze({ x: -145, y: -55 })
  }),
  queue: Object.freeze({
    customerSize: Object.freeze({ width: 390, height: 340 }),
    columns: 2,
    columnGap: 185,
    rowGap: 176,
    rowDriftX: 48,
    alternatingYOffset: 14,
    baseScale: 0.94,
    rowScaleStep: 0.1,
    columnScaleStep: 0.025,
    minimumScale: 0.72
  }),
  sign: Object.freeze({
    centre: Object.freeze({ x: 1270, y: 190 }),
    size: Object.freeze({ width: 430, height: 60 })
  })
});

export const CLEAN_VISUAL_PRESET: CleanLevelVisualPreset = Object.freeze({
  id: "clean-standard-v1",
  mode: "clean",
  actor: SHARED_ACTOR,
  fixture: Object.freeze({
    position: Object.freeze({ x: 1325, y: 820 }),
    size: Object.freeze({ width: 900, height: 900 })
  }),
  cartSize: Object.freeze({ width: 500, height: 500 }),
  signSize: Object.freeze({ width: 380, height: 375 }),
  spillBaseSize: Object.freeze({ width: 130, height: 58 })
});

export const FIND_ITEMS_VISUAL_PRESET: FindItemsLevelVisualPreset = Object.freeze({
  id: "find-items-standard-v1",
  mode: "find-items",
  actor: SHARED_ACTOR,
  fixture: Object.freeze({
    position: Object.freeze({ x: 1160, y: 820 }),
    size: Object.freeze({ width: 1000, height: 900 })
  }),
  basket: Object.freeze({
    position: Object.freeze({ x: 850, y: 735 }),
    size: Object.freeze({ width: 350, height: 240 })
  }),
  itemSizes: Object.freeze({
    "milk-bottle": Object.freeze({ width: 200, height: 230 }),
    apple: Object.freeze({ width: 160, height: 180 }),
    "cereal-box": Object.freeze({ width: 160, height: 222 })
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
