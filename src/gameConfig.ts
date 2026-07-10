import { Assets } from "./assets";

export type ProductId = "cola" | "water" | "milk";

export type ProductDefinition = {
  id: ProductId;
  label: string;
  boxKey: string;
  productKey: string;
  price: number;
  saleWeight: number;
};

export const PRODUCTS: Record<ProductId, ProductDefinition> = {
  cola: {
    id: "cola",
    label: "COLA",
    boxKey: Assets.props.boxCola,
    productKey: Assets.products.cola,
    price: 12,
    saleWeight: 5
  },
  water: {
    id: "water",
    label: "WATER",
    boxKey: Assets.props.boxWater,
    productKey: Assets.products.water,
    price: 8,
    saleWeight: 4
  },
  milk: {
    id: "milk",
    label: "MILK",
    boxKey: Assets.props.boxMilk,
    productKey: Assets.products.milk,
    price: 15,
    saleWeight: 3
  }
};

export const INITIAL_BOX_ORDER: ProductId[] = [
  "cola", "water", "milk", "cola", "water", "milk"
];

export const SLOT_PRODUCT_ORDER: ProductId[] = [
  "cola", "water", "milk", "cola", "water", "milk"
];

// Backroom layout: two box columns on the left, clear working aisle on the right.
// This keeps boxes away from the worker and from the cart route through the doorway.
export const BOX_POSITIONS = [
  { x: 110, y: 690 },
  { x: 275, y: 690 },
  { x: 110, y: 845 },
  { x: 275, y: 845 },
  { x: 110, y: 1000 },
  { x: 275, y: 1000 }
] as const;

// Shelf slots follow the visible two-row refrigerator layout.
export const SLOT_POSITIONS = [
  { x: 865, y: 342 },
  { x: 1015, y: 342 },
  { x: 1165, y: 342 },
  { x: 865, y: 505 },
  { x: 1015, y: 505 },
  { x: 1165, y: 505 }
] as const;

export const GAME_RULES = {
  shiftSeconds: 300,
  cartCapacity: 6,
  firstMoveRequirement: 6,
  customerIntervalMs: 1450,
  reserveRespawnDelayMs: 650,
  comboWindowMs: 4200,
  maxStars: 3,
  starSalesThresholds: [3, 7, 12]
} as const;
