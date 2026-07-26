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

const expectedLevelIds = Array.from(
  { length: 10 },
  (_, index) => `starter-level-${String(index + 1).padStart(3, "0")}`
);

const expectedModes = [
  "restock",
  "restock",
  "checkout",
  "clean",
  "find-items",
  "restock",
  "checkout",
  "clean",
  "find-items",
  "restock"
];

test("Main campaign resolves ten ordered dynamic level definitions", () => {
  assert.deepEqual(validateLevelDefinitions(campaign.levels.map((entry) => entry.level)), []);
  assert.deepEqual(validateLevelCampaignRuntime(campaign), []);
  assert.deepEqual(campaign.levels.map((entry) => entry.level.id), expectedLevelIds);
  assert.deepEqual(campaign.levels.map((entry) => entry.level.mode), expectedModes);
  assert.deepEqual(
    campaign.levels.map((entry) => entry.levelLabel),
    expectedLevelIds.map((_, index) => `LEVEL ${index + 1}`)
  );
  assert.equal(campaign.levels[4].nextLevelId, "starter-level-006");
  assert.equal(campaign.levels[9].previousLevelId, "starter-level-009");
  assert.equal(campaign.levels[9].nextLevelId, undefined);
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

test("Level tuning increases challenge without creating new gameplay engines", () => {
  const [
    levelOne,
    levelTwo,
    levelThree,
    levelFour,
    levelFive,
    levelSix,
    levelSeven,
    levelEight,
    levelNine,
    levelTen
  ] = campaign.levels;

  assert.equal(levelOne.level.navigation.moveSpeed, 520);
  assert.equal(levelTwo.level.navigation.moveSpeed, 560);
  assert.equal(levelThree.runtime.customerCount, 6);
  assert.equal(levelFour.runtime.spotCount, 4);
  assert.deepEqual(levelFive.runtime.products.map((product) => product.id), [
    "milk-bottle",
    "apple",
    "cereal-box"
  ]);

  assert.equal(levelSix.runtime.product.id, "cola-bottle");
  assert.equal(levelSix.level.tuning.rush.targetDurationMs, 7200);
  assert.equal(levelSix.level.tuning.rush.minimumTargetDurationMs, 5000);
  assert.equal(levelSeven.runtime.customerCount, 8);
  assert.equal(levelSeven.level.tuning.scanDurationMs, 420);
  assert.equal(levelEight.runtime.spotCount, 6);
  assert.equal(levelEight.level.tuning.cleanDurationMs, 700);
  assert.deepEqual(levelNine.runtime.products.map((product) => product.id), [
    "cereal-box",
    "milk-bottle",
    "apple"
  ]);
  assert.equal(levelNine.level.tuning.timeLimitSeconds, 40);
  assert.equal(levelNine.level.tuning.mistakePenaltySeconds, 7);
  assert.equal(levelTen.runtime.product.id, "water-bottle");
  assert.equal(levelTen.level.tuning.rush.targetDurationMs, 6500);
  assert.equal(levelTen.runtime.reward.totalStars, 2);

  assert.equal(levelOne.runtime.reward.completionCoins, 40);
  assert.equal(levelTwo.runtime.reward.completionCoins, 60);
  assert.equal(levelOne.level.tuning.rush.streakWindowMs, 1900);
});

test("All resolved level assets come from the canonical global registry", () => {
  campaign.levels.forEach((entry) => {
    const context = createStarterMarketPresentationContext(entry.level.id);
    const assetKeys = context.levelAssets.preload.map((asset) => asset.key);
    assert.deepEqual(STARTER_RUNTIME_ASSET_REGISTRY.validateKeys(assetKeys), []);
    assert.equal(new Set(assetKeys).size, assetKeys.length);
  });
});

test("Level selector accepts level IDs and keeps shared-shift selection deterministic", () => {
  assert.equal(selectCampaignLevel(campaign).level.id, "starter-level-001");
  assert.equal(selectCampaignLevel(campaign, "starter-level-007").level.mode, "checkout");
  assert.equal(selectCampaignLevel(campaign, "starter-shift-002").level.id, "starter-level-002");
  assert.equal(selectCampaignLevel(campaign, "starter-shift-009").level.id, "starter-level-010");
  assert.throws(
    () => selectCampaignLevel(campaign, "missing-level"),
    /does not belong to campaign/
  );
});
