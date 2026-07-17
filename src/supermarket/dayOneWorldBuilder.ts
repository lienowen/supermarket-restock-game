export type SupermarketZone = {
  id: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  products: string[];
};

/**
 * Day 1 immersive supermarket layout.
 * This is the first playable store world definition used by the scene layer.
 */
export const DAY_ONE_WORLD: SupermarketZone[] = [
  {
    id: "fruit",
    title: "Fruit Market",
    x: 180,
    y: 320,
    width: 300,
    height: 220,
    products: ["apple", "banana", "orange"]
  },
  {
    id: "vegetable",
    title: "Fresh Vegetables",
    x: 520,
    y: 320,
    width: 300,
    height: 220,
    products: ["vegetable"]
  },
  {
    id: "drinks",
    title: "Drinks",
    x: 860,
    y: 320,
    width: 300,
    height: 220,
    products: ["drink"]
  },
  {
    id: "grains",
    title: "Rice & Grains",
    x: 520,
    y: 650,
    width: 300,
    height: 220,
    products: ["rice"]
  }
];

export function getFirstRestockTarget() {
  return DAY_ONE_WORLD[0];
}
