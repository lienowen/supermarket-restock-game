const test = require("node:test");
const assert = require("node:assert/strict");

const {
  STARTER_MARKET_VISUAL_SPEC,
  validateStarterMarketVisualSpec
} = require("../.test-dist/src/game/presentation/visual/StarterMarketVisualSpec.js");
const {
  STARTER_MARKET_PRODUCTION_ASSET_PLAN,
  validateProductionAssetPlan
} = require("../.test-dist/src/game/presentation/assets/ProductionAssetPlan.js");
const {
  STARTER_MARKET_LAYOUT
} = require("../.test-dist/src/game/world/starterMarketLayout.js");

test("Visual target contract remains valid", () => {
  assert.deepEqual(validateStarterMarketVisualSpec().errors, []);
  assert.deepEqual(STARTER_MARKET_VISUAL_SPEC.logicalSize, { width: 1600, height: 900 });
  assert.equal(STARTER_MARKET_VISUAL_SPEC.camera.mode, "fixed-third-person");
  assert.equal(STARTER_MARKET_VISUAL_SPEC.language, "en");
  assert.equal(STARTER_MARKET_VISUAL_SPEC.targeting.singleActiveTarget, true);
});

test("Visual spec and world layout share the same locked composition", () => {
  assert.deepEqual(STARTER_MARKET_LAYOUT.logicalSize, [
    STARTER_MARKET_VISUAL_SPEC.logicalSize.width,
    STARTER_MARKET_VISUAL_SPEC.logicalSize.height
  ]);

  const workerSpawn = STARTER_MARKET_LAYOUT.spawns.find((spawn) => spawn.id === "worker-a-spawn");
  assert.deepEqual(workerSpawn.position, STARTER_MARKET_VISUAL_SPEC.actor.spawn);

  const zones = new Map(STARTER_MARKET_LAYOUT.zones.map((zone) => [zone.id, zone.bounds]));
  assert.deepEqual(zones.get("produce-zone"), STARTER_MARKET_VISUAL_SPEC.composition.produceZone);
  assert.deepEqual(zones.get("staff-backroom"), STARTER_MARKET_VISUAL_SPEC.composition.backroomZone);
  assert.deepEqual(zones.get("beverage-zone"), STARTER_MARKET_VISUAL_SPEC.composition.beverageZone);
});

test("Production asset plan preserves useful prototypes and identifies missing P0 art", () => {
  assert.deepEqual(validateProductionAssetPlan(), []);

  const bySlot = new Map(STARTER_MARKET_PRODUCTION_ASSET_PLAN.map((entry) => [entry.slot, entry]));
  assert.equal(bySlot.get("cola-case-closed").decision, "retain-prototype");
  assert.equal(bySlot.get("restock-cart-a-empty").decision, "refine-existing");
  assert.equal(bySlot.get("beverage-cooler-a-base").decision, "refine-existing");

  [
    "starter-market-environment-base",
    "produce-display-a",
    "backroom-rack-a",
    "worker-a-push-cart",
    "worker-a-carry-medium",
    "worker-a-open-case",
    "worker-a-place-low",
    "worker-a-place-middle",
    "worker-a-place-high"
  ].forEach((slot) => assert.equal(bySlot.get(slot).priority, "P0"));
});

test("Production assets remain reusable and never day-owned", () => {
  for (const entry of STARTER_MARKET_PRODUCTION_ASSET_PLAN) {
    assert.equal(entry.targetPath.startsWith("assets/game/"), true);
    assert.equal(entry.slot.toLowerCase().includes("day"), false);
    assert.equal(entry.acceptance.length > 0, true);
  }
});
