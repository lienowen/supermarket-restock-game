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
  readonly basket: { readonly position: VisualPoint; readonly size: VisualSize };
  readonly orderTicket: {
    readonly centre: VisualPoint;
    readonly size: VisualSize;
    readonly slotSize: VisualSize;
    readonly iconMaxSize: VisualSize;
    readonly itemGap: number;
  };
  readonly itemSizes: Readonly<Record<string, VisualSize>>;
}

export type MarketLevelVisualPreset =
  | RestockLevelVisualPreset
  | CheckoutLevelVisualPreset
  | CleanLevelVisualPreset
  | FindItemsLevelVisualPreset;

const SHARED_ACTOR = Object.freeze({
  idleSize: Object.freeze({ width: 400, height: 360 }),
  shadowOffset: Object.freeze({ x: 0, y: 5 })
});

export const RESTOCK_VISUAL_PRESET: RestockLevelVisualPreset = Object.freeze({
  id: "restock-standard-v1",
  mode: "restock",
  actor: Object.freeze({
    ...SHARED_ACTOR,
    pushSize: Object.freeze({ width: 400, height: 370 }),
    carrySize: Object.freeze({ width: 390, height: 365 })
  }),
  environment: Object.freeze({
    focus: Object.freeze({ x: 1280, y: 700 }),
    focusSize: Object.freeze({ width: 450, height: 340 }),
    routeAlpha: 0.18,
    inactiveWashAlpha: 0,
    vignetteAlpha: 0.05
  }),
  cooler: Object.freeze({
    baseY: 540,
    backgroundY: 530,
    frameSize: Object.freeze({ width: 620, height: 520 }),
    displaySize: Object.freeze({ width: 470, height: 700 }),
    rowYs: Object.freeze([270, 348, 426, 504, 582, 660]),
    activeStockWidth: 420,
    restockItemCount: 5
  }),
  props: Object.freeze({
    caseSize: Object.freeze({ width: 180, height: 220 }),
    cartSize: Object.freeze({ width: 280, height: 270 })
  })
});

export const CHECKOUT_VISUAL_PRESET: CheckoutLevelVisualPreset = Object.freeze({
  id: "checkout-standard-v1",
  mode: "checkout",
  actor: SHARED_ACTOR,
  environment: Object.freeze({
    focus: Object.freeze({ x: 1080, y: 760 }),
    focusSize: Object.freeze({ width: 640, height: 300 }),
    routeAlpha: 0.16,
    inactiveWashAlpha: 0,
    vignetteAlpha: 0.08
  }),
  workerStartOffset: Object.freeze({ x: 0, y: -125 }),
  station: Object.freeze({
    counterOffsetY: 18,
    counterSize: Object.freeze({ width: 480, height: 420 }),
    shadowSize: Object.freeze({ width: 300, height: 46 }),
    registerOffset: Object.freeze({ x: 48, y: -76 }),
    laneLightOffset: Object.freeze({ x: -82, y: -66 }),
    scanBeamOffset: Object.freeze({ x: -46, y: -38 }),
    scanBeamSize: Object.freeze({ width: 84, height: 6 }),
    servedExitOffset: Object.freeze({ x: 165, y: -20 })
  }),
  queue: Object.freeze({
    customerSize: Object.freeze({ width: 220, height: 245 }),
    columns: 6,
    columnGap: -102,
    rowGap: 0,
    rowDriftX: 0,
    alternatingYOffset: 12,
    baseScale: 0.92,
    rowScaleStep: 0,
    columnScaleStep: 0.02,
    minimumScale: 0.8
  }),
  sign: Object.freeze({
    centre: Object.freeze({ x: 1190, y: 170 }),
    size: Object.freeze({ width: 330, height: 56 })
  })
});

export const CLEAN_VISUAL_PRESET: CleanLevelVisualPreset = Object.freeze({
  id: "clean-standard-v1",
  mode: "clean",
  actor: SHARED_ACTOR,
  environment: Object.freeze({
    focus: Object.freeze({ x: 1170, y: 755 }),
    focusSize: Object.freeze({ width: 620, height: 300 }),
    routeAlpha: 0.16,
    inactiveWashAlpha: 0,
    vignetteAlpha: 0.08
  }),
  fixture: Object.freeze({
    position: Object.freeze({ x: 1260, y: 790 }),
    size: Object.freeze({ width: 420, height: 420 })
  }),
  cartSize: Object.freeze({ width: 190, height: 190 }),
  signSize: Object.freeze({ width: 110, height: 108 }),
  signOffset: Object.freeze({ x: -85, y: 10 }),
  toolsTargetSize: Object.freeze({ width: 250, height: 180 }),
  collectedToolsAlpha: 0.24,
  spillBaseSize: Object.freeze({ width: 92, height: 40 }),
  spillTargetSize: Object.freeze({ width: 132, height: 68 }),
  inactiveSpillAlpha: 0.24,
  activeSpillAlpha: 0.72,
  spillColor: 0x6f98a4,
  spillEdgeColor: 0xcce4e9,
  spillHighlightColor: 0xf4ffff
});

export const FIND_ITEMS_VISUAL_PRESET: FindItemsLevelVisualPreset = Object.freeze({
  id: "find-items-standard-v1",
  mode: "find-items",
  actor: SHARED_ACTOR,
  environment: Object.freeze({
    focus: Object.freeze({ x: 1170, y: 720 }),
    focusSize: Object.freeze({ width: 620, height: 330 }),
    routeAlpha: 0.16,
    inactiveWashAlpha: 0,
    vignetteAlpha: 0.08
  }),
  fixture: Object.freeze({
    position: Object.freeze({ x: 1220, y: 760 }),
    size: Object.freeze({ width: 480, height: 450 })
  }),
  basket: Object.freeze({
    position: Object.freeze({ x: 960, y: 795 }),
    size: Object.freeze({ width: 160, height: 110 })
  }),
  orderTicket: Object.freeze({
    centre: Object.freeze({ x: 1270, y: 255 }),
    size: Object.freeze({ width: 430, height: 145 }),
    slotSize: Object.freeze({ width: 116, height: 80 }),
    iconMaxSize: Object.freeze({ width: 60, height: 62 }),
    itemGap: 128
  }),
  itemSizes: Object.freeze({
    "milk-bottle": Object.freeze({ width: 78, height: 100 }),
    apple: Object.freeze({ width: 68, height: 72 }),
    "cereal-box": Object.freeze({ width: 80, height: 110 })
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
