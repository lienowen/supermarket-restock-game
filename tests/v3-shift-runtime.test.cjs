const test = require("node:test");
const assert = require("node:assert/strict");

const {
  STARTER_MARKET_CONTENT
} = require("../.test-dist/src/game/content/starterMarket.js");
const {
  resolveRestockShiftRuntime,
  validateRestockShiftRuntime
} = require("../.test-dist/src/game/application/ShiftRuntimeContent.js");

test("Starter restock runtime resolves shift, mission, product, and fixture by stable IDs", () => {
  const runtime = resolveRestockShiftRuntime(STARTER_MARKET_CONTENT, "starter-shift-001");

  assert.deepEqual(validateRestockShiftRuntime(runtime), []);
  assert.equal(runtime.shift.id, "starter-shift-001");
  assert.equal(runtime.store.id, "starter-market");
  assert.equal(runtime.mission.id, "restock-cola-cooler");
  assert.equal(runtime.product.id, "cola-bottle");
  assert.equal(runtime.fixture.id, "beverage-cooler-a");
});

test("Starter restock runtime derives six equal cooler slots from content", () => {
  const runtime = resolveRestockShiftRuntime(STARTER_MARKET_CONTENT, "starter-shift-001");

  assert.equal(runtime.totalUnits, 24);
  assert.equal(runtime.slotCount, 6);
  assert.equal(runtime.unitsPerSlot, 4);
});

test("Staged rewards preserve the configured total mission reward", () => {
  const runtime = resolveRestockShiftRuntime(STARTER_MARKET_CONTENT, "starter-shift-001");

  assert.equal(runtime.reward.coinsPerSlot, 10);
  assert.equal(runtime.reward.completionCoins, 40);
  assert.equal(runtime.reward.totalCoins, 100);
  assert.equal(runtime.reward.completionStars, 1);
  assert.equal(
    runtime.reward.coinsPerSlot * runtime.slotCount + runtime.reward.completionCoins,
    runtime.reward.totalCoins
  );
});

test("Runtime rejects a product category that the target fixture cannot accept", () => {
  const invalid = structuredClone(STARTER_MARKET_CONTENT);
  invalid.products[0].category = "produce";

  assert.throws(
    () => resolveRestockShiftRuntime(invalid, "starter-shift-001"),
    /does not accept product category/
  );
});
