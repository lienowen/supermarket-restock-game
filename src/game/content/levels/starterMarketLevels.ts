import {
  CURRENT_LEVEL_SCHEMA_VERSION,
  type LevelDefinition
} from "../GameContent";

const FIRST_DELIVERY_NAVIGATION = Object.freeze({
  moveSpeed: 520,
  interactionRadius: 110
});

const NO_RULE_OVERRIDES = Object.freeze([]);

/**
 * Pure level data. A level never owns methods or asset paths.
 * Repeated modes must select a distinct interaction profile or challenge rule;
 * quantity and timing changes alone are not accepted as new level design.
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
    navigation: FIRST_DELIVERY_NAVIGATION,
    presentation: {
      assetPackId: "market-restock-v1",
      visualPresetId: "restock-golden-standard-v1"
    },
    rules: NO_RULE_OVERRIDES,
    tuning: {
      initialCoins: 100,
      slotCount: 6,
      progressRewardRatio: 0.6,
      rush: {
        itemsPerRow: 1,
        unitsPerInteraction: 3,
        sequenceMode: "fixed",
        timeoutEnabled: false,
        targetDurationMs: 9000,
        minimumTargetDurationMs: 6500,
        speedUpPerSuccessMs: 400,
        introGraceMs: 0,
        streakWindowMs: 2400,
        goldTimeMs: 45000,
        silverTimeMs: 70000
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
      visualPresetId: "restock-golden-standard-v1"
    },
    rules: NO_RULE_OVERRIDES,
    tuning: {
      initialCoins: 200,
      slotCount: 6,
      progressRewardRatio: 0.5,
      rush: {
        sequenceMode: "shuffled",
        timeoutEnabled: true,
        memoryPreview: {
          durationMs: 3200,
          hideActiveTarget: true,
          keepTargetOnFailure: true
        },
        targetDurationMs: 8500,
        minimumTargetDurationMs: 7000,
        speedUpPerSuccessMs: 300,
        introGraceMs: 3200,
        streakWindowMs: 1550,
        goldTimeMs: 30000,
        silverTimeMs: 44000
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
      toolPoint: { x: 1190, y: 760 },
      spotPositions: [
        { x: 620, y: 742 },
        { x: 790, y: 672 },
        { x: 970, y: 748 },
        { x: 1135, y: 685 }
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
      visualPresetId: "find-items-golden-standard-v1"
    },
    rules: NO_RULE_OVERRIDES,
    tuning: {
      initialCoins: 490,
      timeLimitSeconds: 60,
      mistakePenaltySeconds: 5,
      // Navigation targets are floor stand points in front of the fixture.
      // Product sprite positions remain owned by the Golden visual preset.
      itemTargets: [
        { productId: "milk-bottle", x: 940, y: 780 },
        { productId: "apple", x: 1220, y: 810 },
        { productId: "cereal-box", x: 720, y: 780 }
      ]
    }
  },
  {
    schemaVersion: CURRENT_LEVEL_SCHEMA_VERSION,
    id: "starter-level-006",
    mode: "restock",
    shiftId: "starter-shift-005",
    missionId: "restock-cola-closing",
    title: "Closing Stock Sprint",
    randomSeed: "starter-level-006-v1",
    navigation: { moveSpeed: 600, interactionRadius: 150 },
    presentation: {
      assetPackId: "market-restock-v1",
      visualPresetId: "restock-golden-standard-v1"
    },
    rules: NO_RULE_OVERRIDES,
    tuning: {
      initialCoins: 600,
      slotCount: 6,
      progressRewardRatio: 0.55,
      rush: {
        sequenceMode: "shuffled",
        timeoutEnabled: true,
        targetDurationMs: 15000,
        minimumTargetDurationMs: 9000,
        speedUpPerSuccessMs: 350,
        introGraceMs: 3500,
        streakWindowMs: 1250,
        goldTimeMs: 42000,
        silverTimeMs: 62000
      }
    }
  },
  {
    schemaVersion: CURRENT_LEVEL_SCHEMA_VERSION,
    id: "starter-level-007",
    mode: "checkout",
    shiftId: "starter-shift-006",
    missionId: "serve-evening-rush",
    title: "Evening Checkout",
    randomSeed: "starter-level-007-v1",
    navigation: { moveSpeed: 500, interactionRadius: 150 },
    presentation: {
      assetPackId: "market-checkout-v1",
      visualPresetId: "checkout-standard-v1"
    },
    rules: NO_RULE_OVERRIDES,
    tuning: {
      initialCoins: 740,
      serviceRewardRatio: 0.8,
      scanDurationMs: 420,
      queueAdvanceDurationMs: 280
    }
  },
  {
    schemaVersion: CURRENT_LEVEL_SCHEMA_VERSION,
    id: "starter-level-008",
    mode: "clean",
    shiftId: "starter-shift-007",
    missionId: "clean-closing-aisles",
    title: "Closing Clean-up",
    randomSeed: "starter-level-008-v1",
    navigation: { moveSpeed: 520, interactionRadius: 115 },
    presentation: {
      assetPackId: "market-clean-v1",
      visualPresetId: "clean-standard-v1"
    },
    rules: NO_RULE_OVERRIDES,
    tuning: {
      initialCoins: 860,
      cleanDurationMs: 700,
      toolPoint: { x: 1170, y: 760 },
      spotPositions: [
        { x: 535, y: 720 },
        { x: 680, y: 660 },
        { x: 820, y: 742 },
        { x: 955, y: 675 },
        { x: 1085, y: 748 },
        { x: 1195, y: 690 }
      ]
    }
  },
  {
    schemaVersion: CURRENT_LEVEL_SCHEMA_VERSION,
    id: "starter-level-009",
    mode: "find-items",
    shiftId: "starter-shift-008",
    missionId: "find-priority-order",
    title: "Priority Order",
    randomSeed: "starter-level-009-v1",
    navigation: { moveSpeed: 535, interactionRadius: 150 },
    presentation: {
      assetPackId: "market-find-items-v1",
      visualPresetId: "find-items-standard-v1"
    },
    rules: NO_RULE_OVERRIDES,
    tuning: {
      initialCoins: 990,
      timeLimitSeconds: 40,
      mistakePenaltySeconds: 7,
      itemTargets: [
        { productId: "cereal-box", x: 820, y: 650 },
        { productId: "milk-bottle", x: 520, y: 700 },
        { productId: "apple", x: 1180, y: 720 }
      ]
    }
  },
  {
    schemaVersion: CURRENT_LEVEL_SCHEMA_VERSION,
    id: "starter-level-010",
    mode: "restock",
    shiftId: "starter-shift-009",
    missionId: "restock-water-finale",
    title: "Final Cooler Rush",
    randomSeed: "starter-level-010-v1",
    navigation: { moveSpeed: 620, interactionRadius: 145 },
    presentation: {
      assetPackId: "market-restock-v1",
      visualPresetId: "restock-standard-v1"
    },
    rules: NO_RULE_OVERRIDES,
    tuning: {
      initialCoins: 1140,
      slotCount: 6,
      progressRewardRatio: 0.5,
      rush: {
        sequenceMode: "shuffled",
        timeoutEnabled: true,
        targetDurationMs: 13000,
        minimumTargetDurationMs: 7500,
        speedUpPerSuccessMs: 320,
        introGraceMs: 3200,
        streakWindowMs: 1100,
        goldTimeMs: 38000,
        silverTimeMs: 56000
      }
    }
  }
]);
