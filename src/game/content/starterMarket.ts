import type {
  GameContentCatalogue,
  MissionDefinition
} from "./GameContent";
import { STARTER_MARKET_LEVELS } from "./levels/starterMarketLevels";

export const RESTOCK_COLA_COOLER_MISSION: MissionDefinition = {
  id: "restock-cola-cooler",
  title: "Pick Up the Cola Case",
  description: "Move one cola case from the backroom to the beverage cooler.",
  objectives: [{
    type: "transfer-product",
    productId: "cola-bottle",
    targetFixtureId: "beverage-cooler-a",
    amount: 18
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
    amount: 18
  }],
  rewards: { coins: 120, stars: 1 }
};

export const ASSIST_CHECKOUT_RUSH_MISSION: MissionDefinition = {
  id: "assist-checkout-rush",
  title: "Process the Checkout Queue",
  description: "Scan each waiting grocery basket at the express checkout.",
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

export const RESTOCK_COLA_CLOSING_MISSION: MissionDefinition = {
  id: "restock-cola-closing",
  title: "Verify the Outbound Load",
  description: "Build and verify both chilled six-space orders before dispatch.",
  objectives: [{
    type: "transfer-product",
    productId: "cola-bottle",
    targetFixtureId: "beverage-cooler-a",
    amount: 18
  }],
  rewards: { coins: 140, stars: 1 }
};

export const SERVE_EVENING_RUSH_MISSION: MissionDefinition = {
  id: "serve-evening-rush",
  title: "Clear the Evening Queue",
  description: "Manage regular, rushed and large orders while protecting speed, accuracy and satisfaction.",
  objectives: [{
    type: "operate-checkout",
    checkoutId: "checkout-a",
    customerCount: 8
  }],
  rewards: { coins: 120, stars: 1, reputation: 6 }
};

export const CLEAN_CLOSING_AISLES_MISSION: MissionDefinition = {
  id: "clean-closing-aisles",
  title: "Clean the Closing Aisles",
  description: "Collect the tools and remove all six closing-time spills.",
  objectives: [{
    type: "clean-zone",
    zoneId: "main-aisle",
    amount: 6
  }],
  rewards: { coins: 130, stars: 1, reputation: 3 }
};

export const FIND_PRIORITY_ORDER_MISSION: MissionDefinition = {
  id: "find-priority-order",
  title: "Pick the Priority Order",
  description: "Collect cereal, milk and an apple before the priority timer expires.",
  objectives: [{
    type: "find-items",
    fixtureId: "dairy-breakfast-a",
    productIds: ["cereal-box", "milk-bottle", "apple"]
  }],
  rewards: { coins: 150, stars: 1, reputation: 4 }
};

export const RESTOCK_WATER_FINALE_MISSION: MissionDefinition = {
  id: "restock-water-finale",
  title: "Complete the Final Cooler Rush",
  description: "Finish all six water slots under the campaign's fastest rush window.",
  objectives: [{
    type: "transfer-product",
    productId: "water-bottle",
    targetFixtureId: "beverage-cooler-a",
    amount: 18
  }],
  rewards: { coins: 200, stars: 2 }
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
      capacity: 18,
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
    FIND_ORDER_ITEMS_MISSION,
    RESTOCK_COLA_CLOSING_MISSION,
    SERVE_EVENING_RUSH_MISSION,
    CLEAN_CLOSING_AISLES_MISSION,
    FIND_PRIORITY_ORDER_MISSION,
    RESTOCK_WATER_FINALE_MISSION
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
    },
    {
      id: "starter-shift-005",
      storeId: "starter-market",
      startTime: "15:30",
      missionIds: ["restock-cola-closing"],
      unlockIds: ["closing-restock"]
    },
    {
      id: "starter-shift-006",
      storeId: "starter-market",
      startTime: "17:00",
      missionIds: ["serve-evening-rush"],
      unlockIds: ["evening-checkout"]
    },
    {
      id: "starter-shift-007",
      storeId: "starter-market",
      startTime: "18:15",
      missionIds: ["clean-closing-aisles"],
      unlockIds: ["closing-clean"]
    },
    {
      id: "starter-shift-008",
      storeId: "starter-market",
      startTime: "19:15",
      missionIds: ["find-priority-order"],
      unlockIds: ["priority-order"]
    },
    {
      id: "starter-shift-009",
      storeId: "starter-market",
      startTime: "20:30",
      missionIds: ["restock-water-finale"],
      unlockIds: ["campaign-finale"]
    }
  ],
  levels: STARTER_MARKET_LEVELS,
  campaigns: [{
    id: "main-campaign",
    shiftIds: [
      "starter-shift-001",
      "starter-shift-002",
      "starter-shift-003",
      "starter-shift-004",
      "starter-shift-005",
      "starter-shift-006",
      "starter-shift-007",
      "starter-shift-008",
      "starter-shift-009"
    ],
    levelIds: [
      "starter-level-001",
      "starter-level-002",
      "starter-level-003",
      "starter-level-004",
      "starter-level-005",
      "starter-level-006",
      "starter-level-007",
      "starter-level-008",
      "starter-level-009",
      "starter-level-010"
    ]
  }]
};
