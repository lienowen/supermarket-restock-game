const test = require("node:test");
const assert = require("node:assert/strict");

const {
  BEVERAGE_BOTTLE_CROP,
  COOLER_STOCK_SLOT_OFFSETS,
  resolveCoolerStockSlots
} = require("../.test-dist/src/game/presentation/interactions/RestockTargetResolver.js");

test("Cooler stock uses two glass-door bays with three grounded shelves each", () => {
  assert.equal(COOLER_STOCK_SLOT_OFFSETS.length, 6);

  const slots = resolveCoolerStockSlots(1410);
  assert.deepEqual(slots.map((slot) => slot.x), [1405, 1405, 1405, 1490, 1490, 1490]);
  assert.deepEqual(slots.map((slot) => slot.y), [300, 420, 540, 300, 420, 540]);
  assert.deepEqual(slots.map((slot) => slot.bayIndex), [0, 0, 0, 1, 1, 1]);
  assert.deepEqual(slots.map((slot) => slot.shelfIndex), [0, 1, 2, 0, 1, 2]);

  const uniquePoints = new Set(slots.map((slot) => `${slot.x}:${slot.y}`));
  assert.equal(uniquePoints.size, 6);
  assert.ok(slots.every((slot) => slot.x >= 1380 && slot.x <= 1520));
  assert.ok(slots.every((slot) => slot.y >= 280 && slot.y <= 550));
});

test("Beverage bottle crop removes the padded transparent canvas", () => {
  assert.deepEqual(BEVERAGE_BOTTLE_CROP, {
    x: 188,
    y: 374,
    width: 136,
    height: 356
  });
  assert.ok(BEVERAGE_BOTTLE_CROP.width < 512 * 0.3);
  assert.ok(BEVERAGE_BOTTLE_CROP.height < 768 * 0.5);
  assert.ok(BEVERAGE_BOTTLE_CROP.height > BEVERAGE_BOTTLE_CROP.width * 2.5);
});
