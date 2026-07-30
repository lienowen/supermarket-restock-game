const test = require("node:test");
const assert = require("node:assert/strict");

const {
  STARTER_MARKET_LEVELS
} = require("../.test-dist/src/game/content/levels/starterMarketLevels.js");
const {
  STARTER_MARKET_VISUAL_SPEC,
  validateStarterMarketVisualSpec
} = require("../.test-dist/src/game/presentation/visual/StarterMarketVisualSpec.js");
const {
  RESTOCK_VISUAL_PRESET,
  CHECKOUT_VISUAL_PRESET,
  CLEAN_VISUAL_PRESET,
  FIND_ITEMS_VISUAL_PRESET
} = require("../.test-dist/src/game/presentation/visual/MarketLevelVisualPreset.js");
const {
  COOLER_STOCK_SLOT_OFFSETS
} = require("../.test-dist/src/game/presentation/visual/CoolerStockLayout.js");
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

test("Restock scene keeps cooler right and employee cart staging left", () => {
  const cooler = RESTOCK_VISUAL_PRESET.cooler;
  const coolerFixture = STARTER_MARKET_LAYOUT.fixtures.find(
    (entry) => entry.fixtureId === "beverage-cooler-a"
  );
  const restockZone = STARTER_MARKET_LAYOUT.interactions.find(
    (entry) => entry.id === "beverage-restock-zone"
  );
  const cartZone = STARTER_MARKET_LAYOUT.interactions.find(
    (entry) => entry.id === "restock-cart-load-point"
  );

  assert.ok(coolerFixture);
  assert.ok(restockZone);
  assert.ok(cartZone);
  assert.deepEqual(STARTER_MARKET_VISUAL_SPEC.cooler.centre, coolerFixture.position);
  assert.equal(cooler.rowYs.length, COOLER_STOCK_SLOT_OFFSETS.length);
  assert.equal(cooler.restockItemCount, 3);
  assert.ok(cooler.activeStockWidth <= 100);
  assert.ok(coolerFixture.position.x >= 1150 && coolerFixture.position.x <= 1210);
  assert.ok(restockZone.position.x >= 740 && restockZone.position.x <= 820);
  assert.ok(cartZone.position.x < restockZone.position.x);
  assert.ok(restockZone.position.x < coolerFixture.position.x);
});

test("Checkout uses a compact grocery basket queue instead of pasted customer cutouts", () => {
  const checkout = STARTER_MARKET_LAYOUT.fixtures.find((entry) => entry.fixtureId === "checkout-a");
  assert.ok(checkout);

  const queue = CHECKOUT_VISUAL_PRESET.queue;
  assert.equal(queue.visibleBasketCount, 3);
  assert.ok(queue.panelSize.width <= 240);
  assert.ok(queue.panelSize.height <= 100);
  assert.ok(queue.basketSize.width <= 60);
  assert.ok(queue.basketSize.height <= 48);
  assert.ok(CHECKOUT_VISUAL_PRESET.actor.idleSize.width <= 280);
  assert.ok(CHECKOUT_VISUAL_PRESET.workerStartOffset.x <= -220);
  assert.ok(CHECKOUT_VISUAL_PRESET.station.counterSize.width <= 400);
  assert.ok(CHECKOUT_VISUAL_PRESET.station.counterSize.height <= 350);
});

test("Cleaning tools remain one compact grounded station", () => {
  assert.equal(CLEAN_VISUAL_PRESET.fixture.size.width, 0);
  assert.equal(CLEAN_VISUAL_PRESET.fixture.size.height, 0);
  assert.ok(CLEAN_VISUAL_PRESET.cartSize.width <= 125);
  assert.ok(CLEAN_VISUAL_PRESET.cartSize.height <= 135);
  assert.equal(CLEAN_VISUAL_PRESET.signSize.width, 0);
  assert.equal(CLEAN_VISUAL_PRESET.signSize.height, 0);
  assert.ok(CLEAN_VISUAL_PRESET.spillBaseSize.width >= 80);
  assert.ok(CLEAN_VISUAL_PRESET.spillBaseSize.width <= 110);
  assert.ok(CLEAN_VISUAL_PRESET.spillBaseSize.height >= 34);
  assert.ok(CLEAN_VISUAL_PRESET.spillBaseSize.height <= 50);
});

test("Find-items embeds products in existing departments instead of drawing another shelf", () => {
  const level = STARTER_MARKET_LEVELS.find((entry) => entry.mode === "find-items");
  assert.ok(level);

  const sizes = Object.values(FIND_ITEMS_VISUAL_PRESET.itemSizes);
  assert.ok(sizes.every((size) => size.width <= 60));
  assert.ok(sizes.every((size) => size.height <= 75));
  assert.equal(FIND_ITEMS_VISUAL_PRESET.fixture.size.width, 0);
  assert.equal(FIND_ITEMS_VISUAL_PRESET.fixture.size.height, 0);
  assert.ok(FIND_ITEMS_VISUAL_PRESET.basket.size.width <= 120);
  assert.ok(FIND_ITEMS_VISUAL_PRESET.basket.size.height <= 90);
});

test("Production asset plan remains complete", () => {
  assert.deepEqual(validateProductionAssetPlan().errors, []);
  assert.ok(STARTER_MARKET_PRODUCTION_ASSET_PLAN.length > 0);
});
