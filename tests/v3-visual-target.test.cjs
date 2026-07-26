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
  COOLER_STOCK_SLOT_OFFSETS,
  resolveCoolerStockSlots
} = require("../.test-dist/src/game/presentation/interactions/RestockTargetResolver.js");
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

test("Cola stock occupies two cooler doors and stays above the worker overlap zone", () => {
  const cooler = RESTOCK_VISUAL_PRESET.cooler;
  const coolerFixture = STARTER_MARKET_LAYOUT.fixtures.find(
    (entry) => entry.fixtureId === "beverage-cooler-a"
  );
  const restockZone = STARTER_MARKET_LAYOUT.interactions.find(
    (entry) => entry.id === "beverage-restock-zone"
  );

  assert.ok(coolerFixture);
  assert.ok(restockZone);
  assert.equal(cooler.rowYs.length, COOLER_STOCK_SLOT_OFFSETS.length);
  assert.equal(cooler.restockItemCount, 3);
  assert.ok(cooler.activeStockWidth <= 100);
  assert.ok(coolerFixture.position.x >= 1390 && coolerFixture.position.x <= 1420);
  assert.ok(restockZone.position.x >= 1340 && restockZone.position.x <= 1390);

  const slots = resolveCoolerStockSlots(coolerFixture.position.x);
  assert.deepEqual(slots.map((slot) => slot.x), [1405, 1405, 1405, 1490, 1490, 1490]);
  assert.deepEqual(slots.map((slot) => slot.y), [300, 420, 540, 300, 420, 540]);
  assert.equal(new Set(slots.map((slot) => `${slot.x}:${slot.y}`)).size, 6);
  assert.ok(slots.every((slot) => slot.y <= 540));
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
  assert.ok(FIND_ITEMS_VISUAL_PRESET.basket.size.height <= 85);

  const shelfPositions = FIND_ITEMS_VISUAL_PRESET.itemPositions;
  assert.ok(shelfPositions["milk-bottle"].x < 500);
  assert.ok(shelfPositions.apple.x > 1300);
  assert.ok(shelfPositions["cereal-box"].x >= 550 && shelfPositions["cereal-box"].x <= 850);
  Object.values(shelfPositions).forEach((position) => {
    assert.ok(position.y >= 350 && position.y <= 600);
  });

  const targets = level.tuning.itemTargets;
  targets.forEach((target) => {
    assert.ok(target.x >= 470 && target.x <= 1220);
    assert.ok(target.y >= 620 && target.y <= 770);
  });
  targets.slice(1).forEach((target, index) => {
    const previous = targets[index];
    assert.ok(Math.hypot(target.x - previous.x, target.y - previous.y) >= 180);
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
