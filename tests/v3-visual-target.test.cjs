const test = require("node:test");
const assert = require("node:assert/strict");

const {
  STARTER_MARKET_VISUAL_SPEC,
  validateStarterMarketVisualSpec
} = require("../.test-dist/src/game/presentation/visual/StarterMarketVisualSpec.js");
const {
  CHECKOUT_VISUAL_PRESET
} = require("../.test-dist/src/game/presentation/visual/MarketLevelVisualPreset.js");
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

test("Checkout customers form one readable service line instead of a stacked crowd", () => {
  const spawn = STARTER_MARKET_LAYOUT.spawns.find((entry) => entry.id === "customer-queue-spawn");
  const checkout = STARTER_MARKET_LAYOUT.fixtures.find((entry) => entry.fixtureId === "checkout-a");
  assert.ok(spawn);
  assert.ok(checkout);

  const queue = CHECKOUT_VISUAL_PRESET.queue;
  const positions = Array.from({ length: 6 }, (_, index) => {
    const column = index % queue.columns;
    const row = Math.floor(index / queue.columns);
    return {
      x: spawn.position.x + column * queue.columnGap + row * queue.rowDriftX,
      y: spawn.position.y - row * queue.rowGap + (column % 2) * queue.alternatingYOffset
    };
  });

  assert.equal(queue.columns, 1);
  assert.ok(queue.customerSize.width <= 320);
  assert.ok(positions[0].x < checkout.position.x);
  assert.ok(positions[0].x > positions.at(-1).x);
  assert.ok(positions[0].y > positions.at(-1).y);
  positions.slice(1).forEach((position, index) => {
    const previous = positions[index];
    assert.ok(Math.hypot(position.x - previous.x, position.y - previous.y) >= 100);
  });
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
