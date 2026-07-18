const test = require("node:test");
const assert = require("node:assert/strict");

const {
  STARTER_MARKET_CONTENT
} = require("../.test-dist/src/game/content/starterMarket.js");
const {
  resolveRestockShiftRuntime,
  validateRestockShiftRuntime
} = require("../.test-dist/src/game/application/ShiftRuntimeContent.js");

test("Day 1 restock runtime resolves shift, mission, product, and fixture by stable IDs", () => {
  const runtime = resolveRestockShiftRuntime(STARTER_MARKET_CONTENT, "starter-shift-001");

  assert.deepEqual(validateRestockShiftRuntime(runtime), []);
  assert.equal(runtime.shift.id, "starter-shift-001");
  assert.equal(runtime.store.id, "starter-market");
  assert.equal(runtime.mission.id, "restock-cola-cooler");
  assert.equal(runtime.product.id, "cola-bottle");
  assert.equal(runtime.fixture.id, "beverage-cooler-a");
});

test("Day 2 selects its restock mission from a shared multi-mission shift", () => {
  const runtime = resolveRestockShiftRuntime(STARTER_MARKET_CONTENT, "starter-shift-002");

  assert.deepEqual(validateRestockShiftRuntime(runtime), []);
  assert.equal(runtime.shift.id, "starter-shift-002");
  assert.deepEqual(runtime.shift.missionIds, [
    "restock-water-promotion",
    "assist-checkout-rush"
  ]);
  assert.equal(runtime.mission.id, "restock-water-promotion");
  assert.equal(runtime.product.id, "water-bottle");
  assert.equal(runtime.fixture.id, "beverage-cooler-a");
});

test("Both days derive six equal cooler slots from shared fixture content", () => {
  ["starter-shift-001", "starter-shift-002"].forEach((shiftId) => {
    const runtime = resolveRestockShiftRuntime(STARTER_MARKET_CONTENT, shiftId);
    assert.equal(runtime.totalUnits, 24);
    assert.equal(runtime.slotCount, 6);
    assert.equal(runtime.unitsPerSlot, 4);
  });
});

test("Day-specific rewards preserve configured mission totals without changing systems", () => {
  const dayOne = resolveRestockShiftRuntime(STARTER_MARKET_CONTENT, "starter-shift-001");
  const dayTwo = resolveRestockShiftRuntime(STARTER_MARKET_CONTENT, "starter-shift-002");

  assert.equal(dayOne.reward.coinsPerSlot, 10);
  assert.equal(dayOne.reward.completionCoins, 40);
  assert.equal(dayOne.reward.totalCoins, 100);

  assert.equal(dayTwo.reward.coinsPerSlot, 12);
  assert.equal(dayTwo.reward.completionCoins, 48);
  assert.equal(dayTwo.reward.totalCoins, 120);

  [dayOne, dayTwo].forEach((runtime) => {
    assert.equal(
      runtime.reward.coinsPerSlot * runtime.slotCount + runtime.reward.completionCoins,
      runtime.reward.totalCoins
    );
    assert.equal(runtime.reward.completionStars, 1);
  });
});

test("Runtime can explicitly select a restock mission when a shift later contains several", () => {
  const runtime = resolveRestockShiftRuntime(
    STARTER_MARKET_CONTENT,
    "starter-shift-002",
    { missionId: "restock-water-promotion" }
  );
  assert.equal(runtime.mission.id, "restock-water-promotion");

  assert.throws(
    () => resolveRestockShiftRuntime(
      STARTER_MARKET_CONTENT,
      "starter-shift-002",
      { missionId: "restock-cola-cooler" }
    ),
    /does not belong to shift/
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
