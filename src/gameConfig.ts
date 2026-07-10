import { Assets } from "./assets";

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

// Ground contact points, not sprite centres. Box sprites use origin (0.5, 1).
export const BOX_POSITIONS = [
  { x: 105, y: 735 },
  { x: 265, y: 735 },
  { x: 105, y: 880 },
  { x: 265, y: 880 },
  { x: 105, y: 1025 },
  { x: 265, y: 1025 }
] as const;

// Fixed planogram: each slot has a real product type and a bottom contact line.
export const SLOT_POSITIONS = [
  { x: 865, y: 342, productBottomY: 402 },
  { x: 1015, y: 342, productBottomY: 402 },
  { x: 1165, y: 342, productBottomY: 402 },
  { x: 865, y: 505, productBottomY: 565 },
  { x: 1015, y: 505, productBottomY: 565 },
  { x: 1165, y: 505, productBottomY: 565 }
] as const;

export const GAME_RULES = {
  shiftSeconds: 180,
  cartCapacity: 6,
  firstMoveRequirement: 6,
  reopenMoveRequirement: 1,
  normalSalesTarget: 4,
  rushSalesTarget: 8,
  customerIntervalOpenMs: 2600,
  customerIntervalRushMs: 1450,
  reserveRespawnDelayMs: 700,
  comboWindowMs: 4200,
  maxStars: 3,
  starSalesThresholds: [3, 6, 8]
} as const;
