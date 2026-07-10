import { Assets } from "./assets";
import { LEVELS, ACTIVE_LEVEL } from "./levels/levelConfigs";
import { gameSession } from "./systems/GameSession";

export type ProductId = "cola" | "water" | "milk";

export type ProductDefinition = {
  id: ProductId;
  label: string;
  boxKey: string;
  productKey: string;
  price: number;
  saleWeight: number;
  shelfWidth: number;
  shelfHeight: number;
};

export const PRODUCTS: Record<ProductId, ProductDefinition> = {
  cola: {
    id: "cola",
    label: "COLA",
    boxKey: Assets.props.boxCola,
    productKey: Assets.products.cola,
    price: 12,
    saleWeight: 5,
    shelfWidth: 50,
    shelfHeight: 112
  },
  water: {
    id: "water",
    label: "WATER",
    boxKey: Assets.props.boxWater,
    productKey: Assets.products.water,
    price: 8,
    saleWeight: 4,
    shelfWidth: 48,
    shelfHeight: 112
  },
  milk: {
    id: "milk",
    label: "MILK",
    boxKey: Assets.props.boxMilk,
    productKey: Assets.products.milk,
    price: 15,
    saleWeight: 3,
    shelfWidth: 56,
    shelfHeight: 108
  }
};

export const INITIAL_BOX_ORDER: ProductId[] = [
  "cola", "water", "milk", "cola", "water", "milk"
];

export const SLOT_PRODUCT_ORDER: ProductId[] = [
  "cola", "water", "milk", "cola", "water", "milk"
];

// Ground contact points. The PNG sprites use origin (0.5, 1), so these y values
// are the actual floor contact lines rather than image centres.
export const BOX_POSITIONS = [
  { x: 105, y: 790 },
  { x: 265, y: 790 },
  { x: 105, y: 930 },
  { x: 265, y: 930 },
  { x: 105, y: 1060 },
  { x: 265, y: 1060 }
] as const;

// Refrigerator planogram. productBottomY is the physical shelf-contact line.
// The lower row is intentionally calibrated separately so repeat restocks land
// on the second shelf instead of floating above it.
export const SLOT_POSITIONS = [
  { x: 865, y: 342, productBottomY: 420 },
  { x: 1015, y: 342, productBottomY: 420 },
  { x: 1165, y: 342, productBottomY: 420 },
  { x: 865, y: 505, productBottomY: 598 },
  { x: 1015, y: 505, productBottomY: 598 },
  { x: 1165, y: 505, productBottomY: 598 }
] as const;

/**
 * Rules that vary by day are runtime getters. Day changes happen through
 * GameSession, so Day 2+ can never silently keep Day 1 timing or sales targets.
 */
export const GAME_RULES = {
  get shiftSeconds(): number {
    return LEVELS[gameSession.day].shiftSeconds;
  },
  cartCapacity: 6,
  firstMoveRequirement: 3,
  reopenMoveRequirement: 1,
  get normalSalesTarget(): number {
    return LEVELS[gameSession.day].salesTargets.openToRush;
  },
  get rushSalesTarget(): number {
    return LEVELS[gameSession.day].salesTargets.rushToClosing;
  },
  get customerIntervalOpenMs(): number {
    return LEVELS[gameSession.day].customerIntervalsMs.open;
  },
  get customerIntervalRushMs(): number {
    return LEVELS[gameSession.day].customerIntervalsMs.rush;
  },
  reserveRespawnDelayMs: 700,
  comboWindowMs: 4200,
  maxStars: 3,
  starSalesThresholds: [3, 6, 8]
} as const;

// Kept for compatibility with older imports; runtime gameplay must use
// GAME_RULES getters or LEVELS[gameSession.day], not this Day 1 constant.
export { ACTIVE_LEVEL };
