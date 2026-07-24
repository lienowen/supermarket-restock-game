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
  readonly signOffset: VisualPoint;
  readonly spillBaseSize: VisualSize;
  readonly spillColor: number;
  readonly spillEdgeColor: number;
  readonly spillHighlightColor: number;
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
  idleSize: Object.freeze({ width: 520, height: 390 }),
  shadowOffset: Object.freeze({ x: 0, y: 5 })
});

export const RESTOCK_VISUAL_PRESET: RestockLevelVisualPreset = Object.freeze({
  id: "restock-standard-v1",
  mode: "restock",
  actor: Object.freeze({
    ...SHARED_ACTOR,
    pushSize: Object.freeze({ width: 450, height: 405 }),
    carrySize: Object.freeze({ width: 470, height: 395 })
  }),
  environment: Object.freeze({
    focus: Object.freeze({ x: 1310, y: 610 }),
    focusSize: Object.freeze({ width: 570, height: 620 }),
    routeAlpha: 0.34,
    inactiveWashAlpha: 0,
    vignetteAlpha: 0.08
  }),
  cooler: Object.freeze({
    baseY: 540,
    backgroundY: 530,
    frameSize: Object.freeze({ width: 620, height: 520 }),
    displaySize: Object.freeze({ width: 470, height: 700 }),
    rowYs: Object.freeze([270, 348, 426, 504, 582, 660]),
    activeStockWidth: 360,
    restockItemCount: 5
  }),
  props: Object.freeze({
    caseSize: Object.freeze({ width: 235, height: 285 }),
    cartSize: Object.freeze({ width: 390, height: 375 })
  })
});

export const CHECKOUT_VISUAL_PRESET: CheckoutLevelVisualPreset = Object.freeze({
  id: "checkout-standard-v1",
  mode: "checkout",
  actor: SHARED_ACTOR,
  environment: Object.freeze({
    focus: Object.freeze({ x: 1000, y: 660 }),
    focusSize: Object.freeze({ width: 1180, height: 470 }),
    routeAlpha: 0.28,
    inactiveWashAlpha: 0.14,
    vignetteAlpha: 0.18
  }),
  workerStartOffset: Object.freeze({ x: -45, y: -118 }),
  station: Object.freeze({
    counterOffsetY: 26,
    counterSize: Object.freeze({ width: 820, height: 700 }),
    shadowSize: Object.freeze({ width: 430, height: 62 }),
    registerOffset: Object.freeze({ x: 82, y: -138 }),
    laneLightOffset: Object.freeze({ x: -138, y: -112 }),
    scanBeamOffset: Object.freeze({ x: -72, y: -65 }),
    scanBeamSize: Object.freeze({ width: 124, height: 8 }),
    servedExitOffset: Object.freeze({ x: 230, y: -38 })
  }),
  queue: Object.freeze({
    customerSize: Object.freeze({ width: 300, height: 315 }),
    columns: 6,
    columnGap: -118,
    rowGap: 0,
    rowDriftX: 0,
    alternatingYOffset: 12,
    baseScale: 0.92,
    rowScaleStep: 0,
    columnScaleStep: 0.025,
    minimumScale: 0.78
  }),
  sign: Object.freeze({
    centre: Object.freeze({ x: 1280, y: 184 }),
    size: Object.freeze({ width: 430, height: 64 })
  })
});

export const CLEAN_VISUAL_PRESET: CleanLevelVisualPreset = Object.freeze({
  id: "clean-standard-v1",
  mode: "clean",
  actor: SHARED_ACTOR,
  environment: Object.freeze({
    focus: Object.freeze({ x: 940, y: 650 }),
    focusSize: Object.freeze({ width: 1050, height: 480 }),
    routeAlpha: 0.3,
    inactiveWashAlpha: 0.12,
    vignetteAlpha: 0.16
  }),
  fixture: Object.freeze({
    position: Object.freeze({ x: 1325, y: 800 }),
    size: Object.freeze({ width: 720, height: 720 })
  }),
  cartSize: Object.freeze({ width: 330, height: 330 }),
  signSize: Object.freeze({ width: 210, height: 205 }),
  signOffset: Object.freeze({ x: -125, y: 12 }),
  spillBaseSize: Object.freeze({ width: 108, height: 46 }),
  spillColor: 0x6f98a4,
  spillEdgeColor: 0xcce4e9,
  spillHighlightColor: 0xf4ffff
});

export const FIND_ITEMS_VISUAL_PRESET: FindItemsLevelVisualPreset = Object.freeze({
  id: "find-items-standard-v1",
  mode: "find-items",
  actor: SHARED_ACTOR,
  environment: Object.freeze({
    focus: Object.freeze({ x: 1085, y: 610 }),
    focusSize: Object.freeze({ width: 920, height: 520 }),
    routeAlpha: 0.3,
    inactiveWashAlpha: 0.12,
    vignetteAlpha: 0.16
  }),
  fixture: Object.freeze({
    position: Object.freeze({ x: 1165, y: 760 }),
    size: Object.freeze({ width: 820, height: 760 })
  }),
  basket: Object.freeze({
    position: Object.freeze({ x: 875, y: 750 }),
    size: Object.freeze({ width: 245, height: 165 })
  }),
  itemSizes: Object.freeze({
    "milk-bottle": Object.freeze({ width: 90, height: 112 }),
    apple: Object.freeze({ width: 78, height: 84 }),
    "cereal-box": Object.freeze({ width: 92, height: 126 })
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
