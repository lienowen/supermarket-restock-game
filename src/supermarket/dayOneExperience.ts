export type SupermarketZone = {
  id: string;
  name: string;
  x: number;
  y: number;
  description: string;
};

/**
 * Day 1 foundation for the immersive supermarket experience.
 * The first playable day is organized around a real store flow:
 * entrance -> shopping aisle -> missing shelf -> restock -> customer feedback.
 */
export const DAY_ONE_LAYOUT: SupermarketZone[] = [
  {
    id: "fruit",
    name: "Fruit Area",
    x: 260,
    y: 360,
    description: "Fresh fruit shelves with the first restock mission."
  },
  {
    id: "vegetable",
    name: "Vegetable Area",
    x: 620,
    y: 360,
    description: "Vegetable displays for future expansion."
  },
  {
    id: "drink",
    name: "Drink Area",
    x: 260,
    y: 720,
    description: "Cold drinks and customer traffic lane."
  },
  {
    id: "grain",
    name: "Rice And Grain Area",
    x: 620,
    y: 720,
    description: "Future grocery expansion zone."
  }
];

export const DAY_ONE_MISSION = {
  title: "Opening Day: Restock The Fruit Shelf",
  product: "apple",
  steps: [
    "Find the empty shelf",
    "Take the product box",
    "Move the cart to the shelf",
    "Complete restocking"
  ]
};
