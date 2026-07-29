const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");

const {
  BEVERAGE_BOTTLE_CROP,
  COOLER_STOCK_ITEMS_PER_SLOT,
  COOLER_STOCK_SLOT_COUNT,
  COOLER_STOCK_SLOT_OFFSETS,
  COOLER_STOCK_TARGET_HEIGHT,
  COOLER_STOCK_TARGET_WIDTH,
  resolveCoolerStockBounds,
  resolveCoolerStockSlots
} = require("../.test-dist/src/game/presentation/visual/CoolerStockLayout.js");

const read = (path) => readFileSync(path, "utf8");

test("Cooler stock uses two glass-door bays with three grounded shelves each", () => {
  assert.equal(COOLER_STOCK_SLOT_OFFSETS.length, 6);
  assert.equal(COOLER_STOCK_SLOT_COUNT, 6);
  assert.equal(COOLER_STOCK_ITEMS_PER_SLOT, 3);
  assert.equal(COOLER_STOCK_SLOT_COUNT * COOLER_STOCK_ITEMS_PER_SLOT, 18);

  const slots = resolveCoolerStockSlots(1410);
  assert.deepEqual(slots.map((slot) => slot.x), [1405, 1405, 1405, 1490, 1490, 1490]);
  assert.deepEqual(slots.map((slot) => slot.y), [300, 420, 540, 300, 420, 540]);
  assert.deepEqual(slots.map((slot) => slot.bayIndex), [0, 0, 0, 1, 1, 1]);
  assert.deepEqual(slots.map((slot) => slot.shelfIndex), [0, 1, 2, 0, 1, 2]);

  const uniquePoints = new Set(slots.map((slot) => `${slot.x}:${slot.y}`));
  assert.equal(uniquePoints.size, 6);
  assert.ok(slots.every((slot) => slot.x >= 1380 && slot.x <= 1520));
  assert.ok(slots.every((slot) => slot.y >= 280 && slot.y <= 550));

  const bounds = resolveCoolerStockBounds(1410);
  assert.deepEqual(bounds, {
    x: 1360,
    y: 263,
    width: 175,
    height: 314
  });
  assert.equal(COOLER_STOCK_TARGET_WIDTH, 90);
  assert.equal(COOLER_STOCK_TARGET_HEIGHT, 74);
});

test("Restock mode never renders the broken black-and-green cooler placeholder", () => {
  const source = read("src/game/presentation/world/StarterMarketEnvironmentView.ts");
  assert.equal(source.includes('setName("beverage-cooler-stock-occluder")'), false);
  assert.equal(source.includes('setName("beverage-cooler-empty-shell")'), false);
  assert.equal(source.includes('setName("beverage-cooler-glass-overlay")'), false);
  assert.equal(source.includes('setDisplaySize(width, height)'), false);
  assert.equal(source.includes('document.body.dataset.restockCoolerBackground = "native-background"'), true);
  assert.equal(source.includes('delete document.body.dataset.restockCoolerAsset'), true);
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
