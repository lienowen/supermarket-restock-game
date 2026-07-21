import type { LevelDefinition } from "../GameContent";

const SHARED_ENVIRONMENT_ASSET_KEY = "environment-starter-market-salesfloor-prototype";

const SHARED_NAVIGATION = Object.freeze({
  moveSpeed: 360,
  interactionRadius: 145
});

const SHARED_RESTOCK_ASSETS = Object.freeze({
  environmentAssetKey: SHARED_ENVIRONMENT_ASSET_KEY,
  fixtureAssetKey: "fixture-beverage-cooler-a",
  workerIdleAssetKey: "worker-a-idle",
  workerPushAssetKey: "worker-a-push-cart",
  workerCarryAssetKey: "worker-a-carry-medium",
  cartAssetKey: "equipment-restock-cart-a-empty",
  ambientProductAssetKeys: Object.freeze([
    "product-cola-bottle",
    "product-milk-bottle",
    "product-water-bottle"
  ])
});

/**
 * Pure level data. No scene names, no level-specific methods, and no branching
 * by level id is allowed here. The runtime selects a handler from `mode` and a
 * presentation preset from `presentation.visualPresetId`.
 */
export const STARTER_MARKET_LEVELS: readonly LevelDefinition[] = Object.freeze([
  {
    id: "starter-level-001",
    mode: "restock",
    shiftId: "starter-shift-001",
    missionId: "restock-cola-cooler",
    title: "First Delivery",
    navigation: SHARED_NAVIGATION,
    presentation: { visualPresetId: "restock-standard-v1" },
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
    presentation: { visualPresetId: "restock-standard-v1" },
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
    presentation: { visualPresetId: "checkout-standard-v1" },
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
    presentation: { visualPresetId: "clean-standard-v1" },
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
    navigation: { moveSpeed: 420, interactionRadius: 165 },
    presentation: { visualPresetId: "find-items-standard-v1" },
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
