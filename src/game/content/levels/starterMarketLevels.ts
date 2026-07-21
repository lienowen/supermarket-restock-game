import {
  CURRENT_LEVEL_SCHEMA_VERSION,
  type LevelDefinition
} from "../GameContent";

const SHARED_NAVIGATION = Object.freeze({
  moveSpeed: 520,
  interactionRadius: 150
});

const NO_RULE_OVERRIDES = Object.freeze([]);

/**
 * Pure level data. A level never owns methods or asset paths.
 * - mode chooses a gameplay handler
 * - assetPackId chooses globally registered assets
 * - visualPresetId chooses a globally registered composition
 * - mission/tuning/navigation provide the changing values
 * - rules references typed reusable components; algorithms remain in code
 */
export const STARTER_MARKET_LEVELS: readonly LevelDefinition[] = Object.freeze([
  {
    schemaVersion: CURRENT_LEVEL_SCHEMA_VERSION,
    id: "starter-level-001",
    mode: "restock",
    shiftId: "starter-shift-001",
    missionId: "restock-cola-cooler",
    title: "First Delivery",
    randomSeed: "starter-level-001-v1",
    navigation: SHARED_NAVIGATION,
    presentation: {
      assetPackId: "market-restock-v1",
      visualPresetId: "restock-standard-v1"
    },
    rules: NO_RULE_OVERRIDES,
    tuning: {
      initialCoins: 100,
      slotCount: 6,
      progressRewardRatio: 0.6,
      rush: {
        targetDurationMs: 9000,
        minimumTargetDurationMs: 6500,
        speedUpPerSuccessMs: 400,
        introGraceMs: 3500,
        streakWindowMs: 1900,
        goldTimeMs: 30000,
        silverTimeMs: 45000
      }
    }
  },
  {
    schemaVersion: CURRENT_LEVEL_SCHEMA_VERSION,
    id: "starter-level-002",
    mode: "restock",
    shiftId: "starter-shift-002",
    missionId: "restock-water-promotion",
    title: "Promotion Restock",
    randomSeed: "starter-level-002-v1",
    navigation: { moveSpeed: 560, interactionRadius: 155 },
    presentation: {
      assetPackId: "market-restock-v1",
      visualPresetId: "restock-standard-v1"
    },
    rules: NO_RULE_OVERRIDES,
    tuning: {
      initialCoins: 200,
      slotCount: 6,
      progressRewardRatio: 0.5,
      rush: {
        targetDurationMs: 7800,
        minimumTargetDurationMs: 5200,
        speedUpPerSuccessMs: 420,
        introGraceMs: 3200,
        streakWindowMs: 1550,
        goldTimeMs: 26000,
        silverTimeMs: 40000
      }
    }
  },
  {
    schemaVersion: CURRENT_LEVEL_SCHEMA_VERSION,
    id: "starter-level-003",
    mode: "checkout",
    shiftId: "starter-shift-002",
    missionId: "assist-checkout-rush",
    title: "Checkout Rush",
    randomSeed: "starter-level-003-v1",
    navigation: { moveSpeed: 440, interactionRadius: 155 },
    presentation: {
      assetPackId: "market-checkout-v1",
      visualPresetId: "checkout-standard-v1"
    },
    rules: NO_RULE_OVERRIDES,
    tuning: {
      initialCoins: 320,
      serviceRewardRatio: 0.75,
      scanDurationMs: 520,
      queueAdvanceDurationMs: 360
    }
  },
  {
    schemaVersion: CURRENT_LEVEL_SCHEMA_VERSION,
    id: "starter-level-004",
    mode: "clean",
    shiftId: "starter-shift-003",
    missionId: "clean-store-floor",
    title: "Spill Patrol",
    randomSeed: "starter-level-004-v1",
    navigation: { moveSpeed: 455, interactionRadius: 150 },
    presentation: {
      assetPackId: "market-clean-v1",
      visualPresetId: "clean-standard-v1"
    },
    rules: NO_RULE_OVERRIDES,
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
    schemaVersion: CURRENT_LEVEL_SCHEMA_VERSION,
    id: "starter-level-005",
    mode: "find-items",
    shiftId: "starter-shift-004",
    missionId: "find-order-items",
    title: "Order Hunt",
    randomSeed: "starter-level-005-v1",
    navigation: { moveSpeed: 470, interactionRadius: 165 },
    presentation: {
      assetPackId: "market-find-items-v1",
      visualPresetId: "find-items-standard-v1"
    },
    rules: NO_RULE_OVERRIDES,
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
