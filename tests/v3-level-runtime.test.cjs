const test = require("node:test");
const assert = require("node:assert/strict");

const {
  STARTER_RUNTIME_ASSET_REGISTRY
} = require("../.test-dist/src/game/assets/RuntimeAssetRegistry.js");
const {
  STARTER_MARKET_CONTENT
} = require("../.test-dist/src/game/content/starterMarket.js");
const {
  validateLevelDefinitions
} = require("../.test-dist/src/game/content/validation/LevelConfigValidator.js");
const {
  resolveLevelCampaignRuntime,
  selectCampaignLevel,
  validateLevelCampaignRuntime
} = require("../.test-dist/src/game/application/LevelRuntimeContent.js");
const {
  createStarterMarketPresentationContext
} = require("../.test-dist/src/game/presentation/context/StarterMarketPresentationContext.js");

const campaign = resolveLevelCampaignRuntime(STARTER_MARKET_CONTENT, "main-campaign");

const expectedLevelIds = [
  "starter-level-001",
  "starter-level-002",
  "starter-level-003",
  "starter-level-004",
  "starter-level-005"
];

const expectedModes = [
  "restock",
  "restock",
  "checkout",
  "clean",
  "find-items"
];

test("Main campaign resolves ordered dynamic level definitions", () => {
  assert.deepEqual(validateLevelDefinitions(campaign.levels.map((entry) => entry.level)), []);
  assert.deepEqual(validateLevelCampaignRuntime(campaign), []);
  assert.deepEqual(campaign.levels.map((entry) => entry.level.id), expectedLevelIds);
  assert.deepEqual(campaign.levels.map((entry) => entry.level.mode), expectedModes);
  assert.deepEqual(
    campaign.levels.map((entry) => entry.levelLabel),
    ["LEVEL 1", "LEVEL 2", "LEVEL 3", "LEVEL 4", "LEVEL 5"]
  );
  assert.equal(campaign.levels[1].nextLevelId, "starter-level-003");
  assert.equal(campaign.levels[4].previousLevelId, "starter-level-004");
});

test("Every level is versioned, seeded and references global registries", () => {
  campaign.levels.forEach((entry) => {
    assert.equal(entry.level.schemaVersion, 1);
    assert.match(entry.level.randomSeed, /^starter-level-\d{3}-v1$/);
    assert.match(entry.level.presentation.assetPackId, /^market-/);
    assert.match(entry.level.presentation.visualPresetId, /-standard-v1$/);
    assert.deepEqual(entry.level.rules, []);
    assert.equal("assetBindings" in entry.level, false);
  });
});

test("Each level owns only navigation and mode-specific tuning variables", () => {
  const [levelOne, levelTwo, levelThree, levelFour, levelFive] = campaign.levels;

  assert.equal(levelOne.level.navigation.moveSpeed, 360);
  assert.equal(levelTwo.level.navigation.moveSpeed, 385);
  assert.equal(levelThree.level.navigation.moveSpeed, 400);
  assert.equal(levelFour.level.navigation.moveSpeed, 405);
  assert.equal(levelFive.level.navigation.moveSpeed, 420);
  assert.equal(levelOne.runtime.reward.completionCoins, 40);
  assert.equal(levelTwo.runtime.reward.completionCoins, 60);
  assert.equal(levelThree.runtime.customerCount, 6);
  assert.equal(levelFour.runtime.spotCount, 4);
  assert.deepEqual(levelFive.runtime.products.map((product) => product.id), [
    "milk-bottle",
    "apple",
    "cereal-box"
  ]);
});

test("All resolved level assets come from the canonical global registry", () => {
  campaign.levels.forEach((entry) => {
    const context = createStarterMarketPresentationContext(entry.level.id);
    const assetKeys = context.levelAssets.preload.map((asset) => asset.key);
    assert.deepEqual(STARTER_RUNTIME_ASSET_REGISTRY.validateKeys(assetKeys), []);
    assert.equal(new Set(assetKeys).size, assetKeys.length);
  });
});

test("Level selector accepts level IDs and keeps shift selection deterministic", () => {
  assert.equal(selectCampaignLevel(campaign).level.id, "starter-level-001");
  assert.equal(selectCampaignLevel(campaign, "starter-level-003").level.mode, "checkout");
  assert.equal(selectCampaignLevel(campaign, "starter-shift-002").level.id, "starter-level-002");
  assert.throws(
    () => selectCampaignLevel(campaign, "missing-level"),
    /does not belong to campaign/
  );
});
