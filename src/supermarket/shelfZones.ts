export type ShelfZone = {
  id: string;
  name: string;
  product: string;
  x: number;
  y: number;
  slots: number;
};

/**
 * Day 1 visual layout foundation.
 * These zones replace the idea of a single shelf and allow the store
 * to grow into multiple departments later.
 */
export const DAY_ONE_SHELF_ZONES: ShelfZone[] = [
  { id: "fruit", name: "Fruit Area", product: "apple", x: 920, y: 420, slots: 6 },
  { id: "vegetable", name: "Vegetable Area", product: "vegetable", x: 1080, y: 420, slots: 6 },
  { id: "drink", name: "Drink Area", product: "drink", x: 920, y: 700, slots: 6 },
  { id: "grain", name: "Rice & Grain Area", product: "rice", x: 1080, y: 700, slots: 6 }
];
