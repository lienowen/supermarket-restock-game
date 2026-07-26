import type { VisualPoint, VisualRect } from "./StarterMarketVisualSpec";

export interface CoolerStockSlot extends VisualPoint {
  readonly bayIndex: number;
  readonly shelfIndex: number;
}

export const BEVERAGE_BOTTLE_CROP = Object.freeze({
  x: 188,
  y: 374,
  width: 136,
  height: 356
});

export const COOLER_STOCK_SLOT_OFFSETS = Object.freeze([
  Object.freeze({ x: -5, y: 300, bayIndex: 0, shelfIndex: 0 }),
  Object.freeze({ x: -5, y: 420, bayIndex: 0, shelfIndex: 1 }),
  Object.freeze({ x: -5, y: 540, bayIndex: 0, shelfIndex: 2 }),
  Object.freeze({ x: 80, y: 300, bayIndex: 1, shelfIndex: 0 }),
  Object.freeze({ x: 80, y: 420, bayIndex: 1, shelfIndex: 1 }),
  Object.freeze({ x: 80, y: 540, bayIndex: 1, shelfIndex: 2 })
] as const);

export const COOLER_STOCK_SLOT_COUNT = COOLER_STOCK_SLOT_OFFSETS.length;
export const COOLER_STOCK_ROW_YS = Object.freeze(
  COOLER_STOCK_SLOT_OFFSETS.map((slot) => slot.y)
);
export const COOLER_STOCK_TARGET_WIDTH = 90;
export const COOLER_STOCK_TARGET_HEIGHT = 74;
export const COOLER_STOCK_ITEMS_PER_SLOT = 3;

export function resolveCoolerStockSlots(centreX: number): readonly CoolerStockSlot[] {
  return Object.freeze(COOLER_STOCK_SLOT_OFFSETS.map((slot) => Object.freeze({
    x: centreX + slot.x,
    y: slot.y,
    bayIndex: slot.bayIndex,
    shelfIndex: slot.shelfIndex
  })));
}

export function resolveCoolerStockBounds(centreX: number): VisualRect {
  const slots = resolveCoolerStockSlots(centreX);
  const xs = slots.map((slot) => slot.x);
  const ys = slots.map((slot) => slot.y);
  const halfWidth = COOLER_STOCK_TARGET_WIDTH / 2;
  const halfHeight = COOLER_STOCK_TARGET_HEIGHT / 2;
  const left = Math.min(...xs) - halfWidth;
  const right = Math.max(...xs) + halfWidth;
  const top = Math.min(...ys) - halfHeight;
  const bottom = Math.max(...ys) + halfHeight;
  return Object.freeze({
    x: left,
    y: top,
    width: right - left,
    height: bottom - top
  });
}
