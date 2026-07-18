const test = require("node:test");
const assert = require("node:assert/strict");

const {
  validateAssetCatalogue
} = require("../.test-dist/src/game/assets/AssetDescriptor.js");
const {
  STARTER_ASSET_CATALOGUE
} = require("../.test-dist/src/game/assets/starterAssetCatalogue.js");
const {
  validateWorldLayout
} = require("../.test-dist/src/game/world/WorldLayout.js");
const {
  STARTER_MARKET_LAYOUT
} = require("../.test-dist/src/game/world/starterMarketLayout.js");

test("Starter market world layout matches the approved 16:9 composition", () => {
  assert.deepEqual(validateWorldLayout(STARTER_MARKET_LAYOUT), []);
  assert.deepEqual(STARTER_MARKET_LAYOUT.logicalSize, [1600, 900]);

  const zoneById = new Map(STARTER_MARKET_LAYOUT.zones.map((zone) => [zone.id, zone]));
  const produce = zoneById.get("produce-zone");
  const backroom = zoneById.get("staff-backroom");
  const beverages = zoneById.get("beverage-zone");

  assert.ok(produce.bounds.x < backroom.bounds.x);
  assert.ok(backroom.bounds.x < beverages.bounds.x);
  assert.equal(produce.label, "Fruits & Vegetables");
  assert.equal(backroom.label, "Staff Only");
  assert.equal(beverages.label, "Beverages");
});

test("Starter asset catalogue has valid reusable paths and unique keys", () => {
  assert.deepEqual(validateAssetCatalogue(STARTER_ASSET_CATALOGUE), []);
  assert.ok(STARTER_ASSET_CATALOGUE.assets.length >= 20);
  assert.ok(STARTER_ASSET_CATALOGUE.assets.every((asset) => asset.path.startsWith("assets/game/")));
});

test("Beverage cooler exposes six independent product rows", () => {
  const rows = STARTER_ASSET_CATALOGUE.assets.filter((asset) =>
    asset.key.startsWith("fixture-beverage-cooler-a-row-")
  );

  assert.equal(rows.length, 6);
  assert.ok(rows.every((row) => row.depthGroup === "fixture-contents"));
  assert.ok(rows.every((row) => row.category === "product"));
});

test("Worker assets are action-oriented rather than day-oriented", () => {
  const workerAssets = STARTER_ASSET_CATALOGUE.assets.filter((asset) =>
    asset.key.startsWith("worker-a-")
  );

  const states = new Set(workerAssets.map((asset) => asset.state));
  [
    "idle",
    "carry-medium",
    "push-cart",
    "open-case",
    "place-low",
    "place-middle",
    "place-high"
  ].forEach((state) => assert.equal(states.has(state), true));

  assert.ok(workerAssets.every((asset) => !asset.key.toLowerCase().includes("day")));
});
