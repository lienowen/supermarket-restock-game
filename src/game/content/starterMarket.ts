import type {
  GameContentCatalogue,
  LevelDefinition,
  MissionDefinition
} from "./GameContent";

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

const SHARED_ENVIRONMENT_ASSET_KEY = "environment-starter-market-salesfloor-prototype";
const SHARED_NAVIGATION = {
  moveSpeed: 360,
  interactionRadius: 145
} as const;

const SHARED_RESTOCK_ASSETS = {
  environmentAssetKey: SHARED_ENVIRONMENT_ASSET_KEY,
  fixtureAssetKey: "fixture-beverage-cooler-a",
  workerIdleAssetKey: "worker-a-idle",
  workerPushAssetKey: "worker-a-push-cart",
  workerCarryAssetKey: "worker-a-carry-medium",
  cartAssetKey: "equipment-restock-cart-a-empty",
  ambientProductAssetKeys: [
    "product-cola-bottle",
    "product-milk-bottle",
    "product-water-bottle"
  ]
} as const;

export const STARTER_MARKET_LEVELS: readonly LevelDefinition[] = Object.freeze([
  {
    id: "starter-level-001",
    mode: "restock",
    shiftId: "starter-shift-001",
    missionId: "restock-cola-cooler",
    title: "First Delivery",
    navigation: SHARED_NAVIGATION,
    assetBindings: {
      ...SHARED_RESTOCK_ASSETS,
      caseAssetKey: "prop-cola-case-closed",
      productAssetKey: "product-cola-bottle"
    },
    tuning: {
      initialCoins: 100,
      slotCount: 6,
      progressRewardRatio: 0.6
    }
  },
  {
    id: "starter-level-002",
    mode: "restock",
    shiftId: "starter-shift-002",
    missionId: "restock-water-promotion",
    title: "Promotion Restock",
    navigation: { moveSpeed: 385, interactionRadius: 145 },
    assetBindings: {
      ...SHARED_RESTOCK_ASSETS,
      caseAssetKey: "prop-water-case-closed",
      productAssetKey: "product-water-bottle"
    },
    tuning: {
      initialCoins: 200,
      slotCount: 6,
      progressRewardRatio: 0.5
    }
  },
  {
    id: "starter-level-003",
    mode: "checkout",
    shiftId: "starter-shift-002",
    missionId: "assist-checkout-rush",
    title: "Checkout Rush",
    navigation: { moveSpeed: 400, interactionRadius: 155 },
    assetBindings: {
      environmentAssetKey: SHARED_ENVIRONMENT_ASSET_KEY,
      workerAssetKey: "worker-a-idle",
      customerAssetKeys: [
        "customer-a-carry-basket",
        "customer-b-carry-basket",
        "customer-c-idle",
        "customer-d-checkout"
      ]
    },
    tuning: {
      initialCoins: 320,
      serviceRewardRatio: 0.75,
      scanDurationMs: 520,
      queueAdvanceDurationMs: 360
    }
  },
  {
    id: "starter-level-004",
    mode: "clean",
    shiftId: "starter-shift-003",
    missionId: "clean-store-floor",
    title: "Spill Patrol",
    navigation: { moveSpeed: 405, interactionRadius: 150 },
    assetBindings: {
      environmentAssetKey: SHARED_ENVIRONMENT_ASSET_KEY,
      workerAssetKey: "worker-a-idle",
      workerMopAssetKey: "worker-a-mop-floor",
      cleaningFixtureAssetKey: "fixture-cleaning-supplies-a",
      cleaningCartAssetKey: "equipment-cleaning-cart",
      wetFloorSignAssetKey: "equipment-wet-floor-sign"
    },
    tuning: {
      initialCoins: 400,
      cleanDurationMs: 850,
      toolPoint: { x: 1120, y: 620 },
      spotPositions: [
        { x: 690, y: 590 },
        { x: 865, y: 700 },
        { x: 1035, y: 535 },
        { x: 1145, y: 735 }
      ]
    }
  },
  {
    id: "starter-level-005",
    mode: "find-items",
    shiftId: "starter-shift-004",
    missionId: "find-order-items",
    title: "Order Hunt",
    navigation: { moveSpeed: 420, interactionRadius: 235 },
    assetBindings: {
      environmentAssetKey: SHARED_ENVIRONMENT_ASSET_KEY,
      workerAssetKey: "worker-a-idle",
      workerThinkingAssetKey: "worker-a-thinking",
      fixtureAssetKey: "fixture-dairy-breakfast-a",
      itemAssetKeys: [
        "product-milk-bottle",
        "product-apple",
        "product-cereal-box"
      ]
    },
    tuning: {
      initialCoins: 490,
      timeLimitSeconds: 60,
      mistakePenaltySeconds: 5,
      itemTargets: [
        { productId: "milk-bottle", x: 1010, y: 480 },
        { productId: "apple", x: 1125, y: 610 },
        { productId: "cereal-box", x: 1190, y: 505 }
      ]
    }
  }
]);

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
