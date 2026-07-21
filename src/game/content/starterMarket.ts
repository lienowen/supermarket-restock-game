import type {
  GameContentCatalogue,
  MissionDefinition
} from "./GameContent";
import { STARTER_MARKET_LEVELS } from "./levels/starterMarketLevels";

export const RESTOCK_COLA_COOLER_MISSION: MissionDefinition = {
  id: "restock-cola-cooler",
  title: "Restock the Cola Section",
  description: "Move one cola case from the backroom to the beverage cooler.",
  objectives: [{
    type: "transfer-product",
    productId: "cola-bottle",
    targetFixtureId: "beverage-cooler-a",
    amount: 24
  }],
  rewards: { coins: 100, stars: 1 }
};

export const RESTOCK_WATER_PROMOTION_MISSION: MissionDefinition = {
  id: "restock-water-promotion",
  title: "Restock the Water Promotion",
  description: "Prepare the promoted water section before the customer rush.",
  objectives: [{
    type: "transfer-product",
    productId: "water-bottle",
    targetFixtureId: "beverage-cooler-a",
    amount: 24
  }],
  rewards: { coins: 120, stars: 1 }
};

export const ASSIST_CHECKOUT_RUSH_MISSION: MissionDefinition = {
  id: "assist-checkout-rush",
  title: "Serve the Customer Queue",
  description: "Scan baskets and help waiting customers at the express checkout.",
  objectives: [{
    type: "operate-checkout",
    checkoutId: "checkout-a",
    customerCount: 6
  }],
  rewards: { coins: 80, stars: 1, reputation: 5 }
};

export const CLEAN_STORE_FLOOR_MISSION: MissionDefinition = {
  id: "clean-store-floor",
  title: "Clean the Store Floor",
  description: "Collect the mop and clean every marked spill before customers slip.",
  objectives: [{
    type: "clean-zone",
    zoneId: "main-aisle",
    amount: 4
  }],
  rewards: { coins: 90, stars: 1, reputation: 2 }
};

export const FIND_ORDER_ITEMS_MISSION: MissionDefinition = {
  id: "find-order-items",
  title: "Find Items for the Order",
  description: "Locate the requested milk, apple and cereal products.",
  objectives: [{
    type: "find-items",
    fixtureId: "dairy-breakfast-a",
    productIds: ["milk-bottle", "apple", "cereal-box"]
  }],
  rewards: { coins: 110, stars: 1, reputation: 3 }
};

export const STARTER_MARKET_CONTENT: GameContentCatalogue = {
  products: [
    {
      id: "cola-bottle",
      name: "Cola",
      category: "beverage",
      unitPrice: 3,
      caseSize: 24,
      assetKey: "product-cola-bottle"
    },
    {
      id: "water-bottle",
      name: "Water",
      category: "beverage",
      unitPrice: 2,
      caseSize: 24,
      assetKey: "product-water-bottle"
    },
    {
      id: "milk-bottle",
      name: "Milk",
      category: "dairy",
      unitPrice: 4,
      caseSize: 12,
      assetKey: "product-milk-bottle"
    },
    {
      id: "apple",
      name: "Apple",
      category: "produce",
      unitPrice: 2,
      caseSize: 12,
      assetKey: "product-apple"
    },
    {
      id: "cereal-box",
      name: "Cereal",
      category: "pantry",
      unitPrice: 5,
      caseSize: 8,
      assetKey: "product-cereal-box"
    }
  ],
  fixtures: [
    {
      id: "beverage-cooler-a",
      kind: "cooler",
      capacity: 24,
      slotCount: 6,
      acceptedProductCategories: ["beverage"],
      assetKey: "fixture-beverage-cooler-a"
    },
    {
      id: "checkout-a",
      kind: "checkout",
      capacity: 1,
      acceptedProductCategories: [],
      assetKey: "fixture-checkout-a"
    },
    {
      id: "cleaning-supplies-a",
      kind: "shelf",
      capacity: 40,
      acceptedProductCategories: ["household"],
      assetKey: "fixture-cleaning-supplies-a"
    },
    {
      id: "dairy-breakfast-a",
      kind: "shelf",
      capacity: 40,
      acceptedProductCategories: ["dairy", "pantry"],
      assetKey: "fixture-dairy-breakfast-a"
    }
  ],
  missions: [
    RESTOCK_COLA_COOLER_MISSION,
    RESTOCK_WATER_PROMOTION_MISSION,
    ASSIST_CHECKOUT_RUSH_MISSION,
    CLEAN_STORE_FLOOR_MISSION,
    FIND_ORDER_ITEMS_MISSION
  ],
  stores: [{
    id: "starter-market",
    name: "Freshway Market",
    worldLayoutId: "starter-market-layout",
    fixtureIds: [
      "beverage-cooler-a",
      "checkout-a",
      "cleaning-supplies-a",
      "dairy-breakfast-a"
    ],
    zoneIds: [
      "produce-zone",
      "staff-backroom",
      "beverage-zone",
      "checkout-zone",
      "main-aisle"
    ]
  }],
  shifts: [
    {
      id: "starter-shift-001",
      storeId: "starter-market",
      startTime: "09:00",
      missionIds: ["restock-cola-cooler"],
      unlockIds: ["produce-restocking"]
    },
    {
      id: "starter-shift-002",
      storeId: "starter-market",
      startTime: "10:30",
      missionIds: ["restock-water-promotion", "assist-checkout-rush"],
      unlockIds: ["checkout-assistance", "promotion-rush"]
    },
    {
      id: "starter-shift-003",
      storeId: "starter-market",
      startTime: "12:00",
      missionIds: ["clean-store-floor"],
      unlockIds: ["cleaning-duty"]
    },
    {
      id: "starter-shift-004",
      storeId: "starter-market",
      startTime: "14:00",
      missionIds: ["find-order-items"],
      unlockIds: ["order-picking"]
    }
  ],
  levels: STARTER_MARKET_LEVELS,
  campaigns: [{
    id: "main-campaign",
    shiftIds: [
      "starter-shift-001",
      "starter-shift-002",
      "starter-shift-003",
      "starter-shift-004"
    ],
    levelIds: [
      "starter-level-001",
      "starter-level-002",
      "starter-level-003",
      "starter-level-004",
      "starter-level-005"
    ]
  }]
};
