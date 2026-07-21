import type { LevelDefinition } from "../GameContent";

const SHARED_NAVIGATION = Object.freeze({
  moveSpeed: 360,
  interactionRadius: 145
});

/**
 * Pure level data. A level never owns methods or asset paths.
 * - mode chooses a gameplay handler
 * - assetPackId chooses globally registered assets
 * - visualPresetId chooses a globally registered composition
 * - mission/tuning/navigation provide the changing values
 */
export const STARTER_MARKET_LEVELS: readonly LevelDefinition[] = Object.freeze([
  {
    id: "starter-level-001",
    mode: "restock",
    shiftId: "starter-shift-001",
    missionId: "restock-cola-cooler",
    title: "First Delivery",
    navigation: SHARED_NAVIGATION,
    presentation: {
      assetPackId: "market-restock-v1",
      visualPresetId: "restock-standard-v1"
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
    presentation: {
      assetPackId: "market-restock-v1",
      visualPresetId: "restock-standard-v1"
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
    presentation: {
      assetPackId: "market-checkout-v1",
      visualPresetId: "checkout-standard-v1"
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
    presentation: {
      assetPackId: "market-clean-v1",
      visualPresetId: "clean-standard-v1"
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
    presentation: {
      assetPackId: "market-find-items-v1",
      visualPresetId: "find-items-standard-v1"
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
