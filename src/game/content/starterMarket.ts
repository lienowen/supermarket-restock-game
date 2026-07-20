import type {
  GameContentCatalogue,
  LevelDefinition,
  MissionDefinition
} from "./GameContent";

export const RESTOCK_COLA_COOLER_MISSION: MissionDefinition = {
  id: "restock-cola-cooler",
  title: "Restock the Cola Section",
  description: "Move one cola case from the backroom to the beverage cooler.",
  objectives: [
    {
      type: "transfer-product",
      productId: "cola-bottle",
      targetFixtureId: "beverage-cooler-a",
      amount: 24
    }
  ],
  rewards: {
    coins: 100,
    stars: 1
  }
};

export const RESTOCK_WATER_PROMOTION_MISSION: MissionDefinition = {
  id: "restock-water-promotion",
  title: "Restock the Water Promotion",
  description: "Prepare the promoted water section before the customer rush.",
  objectives: [
    {
      type: "transfer-product",
      productId: "water-bottle",
      targetFixtureId: "beverage-cooler-a",
      amount: 24
    }
  ],
  rewards: {
    coins: 120,
    stars: 1
  }
};

export const ASSIST_CHECKOUT_RUSH_MISSION: MissionDefinition = {
  id: "assist-checkout-rush",
  title: "Assist the Checkout Rush",
  description: "Help waiting customers at the checkout during the promotion rush.",
  objectives: [
    {
      type: "operate-checkout",
      checkoutId: "checkout-a",
      customerCount: 6
    }
  ],
  rewards: {
    coins: 80,
    stars: 1,
    reputation: 5
  }
};

const SHARED_ENVIRONMENT_ASSET_KEY = "environment-starter-market-salesfloor-prototype";

const SHARED_RESTOCK_ASSETS = {
  environmentAssetKey: SHARED_ENVIRONMENT_ASSET_KEY,
  fixtureAssetKey: "fixture-beverage-cooler-a",
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
    assetBindings: {
      ...SHARED_RESTOCK_ASSETS,
      caseAssetKey: "prop-cola-case-closed",
      productAssetKey: "product-cola-bottle"
    },
    tuning: {
      initialCoins: 100,
      slotCount: 6,
      progressRewardRatio: 0.6,
      travelDurationMs: 1150,
      travelLockBufferMs: 200
    }
  },
  {
    id: "starter-level-002",
    mode: "restock",
    shiftId: "starter-shift-002",
    missionId: "restock-water-promotion",
    title: "Promotion Restock",
    assetBindings: {
      ...SHARED_RESTOCK_ASSETS,
      caseAssetKey: "prop-water-case-closed",
      productAssetKey: "product-water-bottle"
    },
    tuning: {
      initialCoins: 200,
      slotCount: 6,
      progressRewardRatio: 0.5,
      travelDurationMs: 1000,
      travelLockBufferMs: 180
    }
  },
  {
    id: "starter-level-003",
    mode: "checkout",
    shiftId: "starter-shift-002",
    missionId: "assist-checkout-rush",
    title: "Checkout Rush",
    assetBindings: {
      environmentAssetKey: SHARED_ENVIRONMENT_ASSET_KEY,
      workerAssetKey: "worker-a-idle",
      customerAssetKeys: [
        "customer-a-carry-basket",
        "customer-b-carry-basket"
      ]
    },
    tuning: {
      initialCoins: 320,
      serviceRewardRatio: 0.75,
      scanDurationMs: 520,
      queueAdvanceDurationMs: 360
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
      assetKey: "procedural-checkout-a"
    }
  ],
  missions: [
    RESTOCK_COLA_COOLER_MISSION,
    RESTOCK_WATER_PROMOTION_MISSION,
    ASSIST_CHECKOUT_RUSH_MISSION
  ],
  stores: [
    {
      id: "starter-market",
      name: "Freshway Market",
      worldLayoutId: "starter-market-layout",
      fixtureIds: ["beverage-cooler-a", "checkout-a"],
      zoneIds: ["produce-zone", "staff-backroom", "beverage-zone", "checkout-zone"]
    }
  ],
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
    }
  ],
  levels: STARTER_MARKET_LEVELS,
  campaigns: [
    {
      id: "main-campaign",
      shiftIds: ["starter-shift-001", "starter-shift-002"],
      levelIds: ["starter-level-001", "starter-level-002", "starter-level-003"]
    }
  ]
};
