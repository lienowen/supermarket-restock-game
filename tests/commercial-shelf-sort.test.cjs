const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createShelfSortState,
  listLegalShelfMoves,
  moveShelfProduct,
  validateShelfSortLevel
} = require("../.test-dist/src/game/systems/shelfSort/ShelfSortEngine.js");
const {
  COMMERCIAL_VERTICAL_SLICE_LEVELS,
  validateCommercialVerticalSliceLevels
} = require("../.test-dist/src/game/content/commercial/commercialShelfSortLevels.js");
const {
  applyCommercialLevelCompletion,
  createDefaultCommercialProfile,
  migrateCommercialProfile,
  validateCommercialProfile
} = require("../.test-dist/src/game/application/CommercialProfile.js");
const {
  COMMERCIAL_CONFIG,
  validateCommercialConfig
} = require("../.test-dist/src/game/config/commercial.js");

test("Commercial product contract keeps one primary mode and valid launch budgets", () => {
  assert.equal(COMMERCIAL_CONFIG.product.primaryMode, "shelf-restock-puzzle");
  assert.equal(COMMERCIAL_CONFIG.progression.launchLevelCount, 60);
  assert.deepEqual(validateCommercialConfig(), []);
});

test("All ten vertical-slice levels satisfy shelf inventory contracts", () => {
  assert.equal(COMMERCIAL_VERTICAL_SLICE_LEVELS.length, 10);
  assert.deepEqual(validateCommercialVerticalSliceLevels(), []);
  for (const level of COMMERCIAL_VERTICAL_SLICE_LEVELS) {
    assert.deepEqual(validateShelfSortLevel(level), []);
  }
});

test("Level 1 completes through the real immutable move rules in five moves", () => {
  let state = createShelfSortState(COMMERCIAL_VERTICAL_SLICE_LEVELS[0]);
  const initialState = state;

  const solution = [
    ["bay-1", "bay-4"],
    ["bay-3", "bay-4"],
    ["bay-2", "bay-1"],
    ["bay-2", "bay-4"],
    ["bay-3", "bay-1"]
  ];

  for (const [fromBayId, toBayId] of solution) {
    const result = moveShelfProduct(state, fromBayId, toBayId);
    assert.equal(result.accepted, true);
    state = result.state;
  }

  assert.equal(initialState.moves, 0);
  assert.equal(initialState.bays[0].items.length, 2);
  assert.equal(state.moves, 5);
  assert.equal(state.completedSets, 2);
  assert.equal(state.status, "complete");
  assert.equal(state.bays.every((bay) => bay.items.length === 0), true);
  assert.equal(listLegalShelfMoves(state).length, 0);
});

test("Invalid moves are rejected without mutating the active state", () => {
  const state = createShelfSortState(COMMERCIAL_VERTICAL_SLICE_LEVELS[0]);
  const sameBay = moveShelfProduct(state, "bay-1", "bay-1");
  const fullDestinationLevel = {
    id: "full-destination",
    title: "Full Destination",
    layoutId: "2x2",
    targetSetCount: 2,
    reward: { coins: 1, stars: 1 },
    bays: [
      { id: "a", items: ["apple", "milk"] },
      { id: "b", items: ["apple", "milk", "apple"] },
      { id: "c", items: ["milk"] },
      { id: "d", items: [] }
    ]
  };
  const fullState = createShelfSortState(fullDestinationLevel);
  const fullDestination = moveShelfProduct(fullState, "a", "b");

  assert.equal(sameBay.accepted, false);
  assert.equal(sameBay.reason, "same-bay");
  assert.equal(sameBay.state, state);
  assert.equal(fullDestination.accepted, false);
  assert.equal(fullDestination.reason, "destination-full");
  assert.equal(fullState.moves, 0);
});

test("Commercial profile rewards first completion once and preserves better results", () => {
  const fresh = createDefaultCommercialProfile("2026-07-27T00:00:00.000Z");
  const first = applyCommercialLevelCompletion(fresh, {
    levelId: "commercial-level-001",
    levelIndex: 0,
    moves: 8,
    stars: 2,
    coins: 60,
    campaignLevelCount: 10,
    completedAt: "2026-07-27T00:01:00.000Z"
  });
  const replay = applyCommercialLevelCompletion(first, {
    levelId: "commercial-level-001",
    levelIndex: 0,
    moves: 5,
    stars: 3,
    coins: 60,
    campaignLevelCount: 10,
    completedAt: "2026-07-27T00:02:00.000Z"
  });

  assert.deepEqual(validateCommercialProfile(first), []);
  assert.deepEqual(validateCommercialProfile(replay), []);
  assert.equal(first.coins, 60);
  assert.equal(replay.coins, 60);
  assert.equal(replay.totalStars, 3);
  assert.equal(replay.bestMovesByLevel["commercial-level-001"], 5);
  assert.equal(replay.unlockedLevelIndex, 1);
  assert.deepEqual(replay.completedLevelIds, ["commercial-level-001"]);
});

test("Legacy-shaped commercial profile data migrates into a valid versioned snapshot", () => {
  const migrated = migrateCommercialProfile({
    productId: "shelf-rush-market",
    currentLevelIndex: 2,
    unlockedLevelIndex: 2,
    coins: 150,
    completedLevelIds: ["commercial-level-001", "commercial-level-001"],
    bestMovesByLevel: { "commercial-level-001": 6 },
    starsByLevel: { "commercial-level-001": 3 },
    totalStars: 999,
    updatedAt: "2026-07-27T00:00:00.000Z"
  });

  assert.ok(migrated);
  assert.deepEqual(validateCommercialProfile(migrated), []);
  assert.equal(migrated.totalStars, 3);
  assert.deepEqual(migrated.completedLevelIds, ["commercial-level-001"]);
});
