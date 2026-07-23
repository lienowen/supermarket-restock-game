const test = require("node:test");
const assert = require("node:assert/strict");
const { existsSync, readFileSync, statSync } = require("node:fs");
const { extname, resolve } = require("node:path");

const {
  validateAssetCatalogue
} = require("../.test-dist/src/game/assets/AssetDescriptor.js");
const {
  STARTER_ASSET_CATALOGUE
} = require("../.test-dist/src/game/assets/starterAssetCatalogue.js");
const {
  V2_ASSET_LIST
} = require("../.test-dist/src/game-v2/assets/manifest.js");
const {
  validateWorldLayout
} = require("../.test-dist/src/game/world/WorldLayout.js");
const {
  STARTER_MARKET_LAYOUT
} = require("../.test-dist/src/game/world/starterMarketLayout.js");

const assetsByStatus = (status) => (
  STARTER_ASSET_CATALOGUE.assets.filter((asset) => asset.status === status)
);

const fileMatchesExtension = (path) => {
  const extension = extname(path).toLowerCase();
  const bytes = readFileSync(path);

  switch (extension) {
    case ".png":
      return bytes.length >= 8 && bytes.subarray(0, 8).equals(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      );
    case ".webp":
      return bytes.length >= 12 &&
        bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
        bytes.subarray(8, 12).toString("ascii") === "WEBP";
    case ".jpg":
    case ".jpeg":
      return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    case ".svg": {
      const text = bytes.subarray(0, Math.min(bytes.length, 512)).toString("utf8").trimStart();
      return text.startsWith("<svg") || (text.startsWith("<?xml") && text.includes("<svg"));
    }
    default:
      return true;
  }
};

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

test("Every registered asset exists and its extension matches the real file format", () => {
  const missing = [];
  const mismatched = [];

  STARTER_ASSET_CATALOGUE.assets.forEach((asset) => {
    const absolutePath = resolve("public", asset.path);
    if (!existsSync(absolutePath) || !statSync(absolutePath).isFile()) {
      missing.push(`${asset.key}: ${asset.path}`);
      return;
    }
    if (!fileMatchesExtension(absolutePath)) {
      mismatched.push(`${asset.key}: ${asset.path}`);
    }
  });

  assert.deepEqual(missing, [], `Missing registered assets:\n${missing.join("\n")}`);
  assert.deepEqual(mismatched, [], `Asset extension/signature mismatches:\n${mismatched.join("\n")}`);
});

test("Compatibility scene loads only canonical project assets", () => {
  assert.ok(V2_ASSET_LIST.length > 0);
  assert.ok(V2_ASSET_LIST.every((asset) => asset.path.startsWith("assets/game/")));
  assert.ok(V2_ASSET_LIST.every((asset) => !asset.path.includes("/day01/")));
  assert.ok(V2_ASSET_LIST.every((asset) => asset.status === "prototype" || asset.status === "production"));
});

test("Beverage cooler exposes six independent product rows", () => {
  const rows = STARTER_ASSET_CATALOGUE.assets.filter((asset) =>
    asset.key.startsWith("fixture-beverage-cooler-a-row-")
  );

  assert.equal(rows.length, 6);
  assert.ok(rows.every((row) => row.depthGroup === "fixture-contents"));
  assert.ok(rows.every((row) => row.category === "product"));
});

test("Worker assets are action-oriented rather than level-oriented", () => {
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
    "place-high",
    "scan-register",
    "mop-floor",
    "thinking"
  ].forEach((state) => assert.equal(states.has(state), true));

  assert.ok(workerAssets.every((asset) => !asset.key.toLowerCase().includes("level")));
  assert.ok(workerAssets.every((asset) => !asset.key.toLowerCase().includes("day")));
});

test("Asset lifecycle status reflects the current mixed production pipeline", () => {
  const production = assetsByStatus("production");
  const prototypes = assetsByStatus("prototype");
  const deprecated = assetsByStatus("deprecated");

  assert.ok(production.length > 0);
  assert.ok(prototypes.length > 0);
  assert.ok(production.every((asset) => asset.path.startsWith("assets/game/")));
  assert.ok(prototypes.every((asset) => asset.path.startsWith("assets/game/")));
  assert.ok(deprecated.every((asset) => Boolean(asset.replacementKey)));

  const productionCategories = new Set(production.map((asset) => asset.category));
  ["character", "fixture", "equipment", "product", "prop"].forEach((category) => (
    assert.equal(productionCategories.has(category), true)
  ));
});
