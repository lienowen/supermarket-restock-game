export type StoreZone = {
  id: string;
  name: string;
  x: number;
  y: number;
  product: string;
};

/**
 * Day 1 immersive supermarket layout.
 * The scene uses this as the first playable store map foundation.
 */
export const DAY_ONE_LAYOUT: StoreZone[] = [
  { id: "fruit", name: "Fruit Area", x: 240, y: 360, product: "apple" },
  { id: "vegetable", name: "Vegetable Area", x: 520, y: 360, product: "vegetable" },
  { id: "drink", name: "Drink Area", x: 800, y: 360, product: "drink" },
  { id: "grain", name: "Rice & Grain Area", x: 1080, y: 360, product: "rice" }
];

export const DAY_ONE_INTRO_STEPS = [
  "Welcome to your first supermarket day",
  "Find the empty shelf",
  "Move the cart and restock products",
  "Open the store and welcome customers"
];
