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

test("Cooler stock keeps six logical slots and eighteen real products", () => {
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

test("Restock mode stocks directly into the cooler baked into the project background", () => {
  const environment = read("src/game/presentation/world/StarterMarketEnvironmentView.ts");
  const assetPacks = read("src/game/assets/GlobalAssetPackRegistry.ts");
  const wrapper = read("src/game/presentation/fixtures/BeverageCoolerView.ts");
  const cooler = read("src/game/presentation/fixtures/IntegratedBeverageCoolerView.ts");

  assert.equal(environment.includes('setName("beverage-cooler-stock-occluder")'), false);
  assert.equal(environment.includes('setName("beverage-cooler-empty-shell")'), false);
  assert.equal(environment.includes('setName("beverage-cooler-glass-overlay")'), false);
  assert.equal(environment.includes("createStoreComposition"), false);
  assert.equal(assetPacks.includes('environmentAssetKey: "environment-project-restock-v2"'), true);
  assert.equal(environment.includes('environmentKey.startsWith("environment-project-")'), true);
  assert.equal(environment.includes('? "project-v2"'), true);
  assert.equal(
    environment.includes('document.body.dataset.restockCoolerAsset = "background-integrated-gameplay-only"'),
    true
  );
  assert.equal(wrapper.includes("closeupBackdrop"), false);
  assert.equal(cooler.includes('restock-cooler-empty-back-hd'), false);
  assert.equal(cooler.includes('restock-cooler-front-glass-hd'), false);
  assert.equal(cooler.includes('document.body.dataset.restockCoolerView = "background-integrated"'), true);
  assert.equal(cooler.includes("COOLER_STOCK_ITEMS_PER_SLOT"), true);
  assert.equal(cooler.includes("const COOLER_CENTRE_X = 1065"), true);
  assert.equal(cooler.includes("const SLOT_XS = [900, 1195]"), true);
  assert.equal(cooler.includes("const SLOT_YS = [325, 460, 595]"), true);
  assert.equal(cooler.includes("const SHELF_BASELINE_YS = [392, 527, 662]"), true);
  assert.equal(cooler.includes("shelfBaselineY - slot.y"), true);
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
