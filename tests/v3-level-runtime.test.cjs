const test = require("node:test");
const assert = require("node:assert/strict");

const {
  STARTER_RUNTIME_ASSET_REGISTRY
} = require("../.test-dist/src/game/assets/RuntimeAssetRegistry.js");
const {
  STARTER_MARKET_CONTENT
} = require("../.test-dist/src/game/content/starterMarket.js");
const {
  levelAssetKeys,
  resolveLevelCampaignRuntime,
  selectCampaignLevel,
  validateLevelCampaignRuntime
} = require("../.test-dist/src/game/application/LevelRuntimeContent.js");

const campaign = resolveLevelCampaignRuntime(STARTER_MARKET_CONTENT, "main-campaign");

test("Main campaign resolves ordered dynamic level definitions", () => {
  assert.deepEqual(validateLevelCampaignRuntime(campaign), []);
  assert.deepEqual(
    campaign.levels.map((entry) => entry.level.id),
    ["starter-level-001", "starter-level-002", "starter-level-003"]
  );
  assert.deepEqual(
    campaign.levels.map((entry) => entry.level.mode),
    ["restock", "restock", "checkout"]
  );
  assert.deepEqual(
    campaign.levels.map((entry) => entry.levelLabel),
    ["LEVEL 1", "LEVEL 2", "LEVEL 3"]
  );
  assert.equal(campaign.levels[1].nextLevelId, "starter-level-003");
  assert.equal(campaign.levels[2].previousLevelId, "starter-level-002");
});

test("Each level owns navigation and mode-specific tuning instead of scene constants", () => {
  const levelOne = campaign.levels[0];
  const levelTwo = campaign.levels[1];
  const levelThree = campaign.levels[2];

  assert.equal(levelOne.level.navigation.moveSpeed, 360);
  assert.equal(levelTwo.level.navigation.moveSpeed, 385);
  assert.equal(levelThree.level.navigation.moveSpeed, 400);
  assert.equal(levelOne.level.navigation.interactionRadius, 145);
  assert.equal(levelThree.level.navigation.interactionRadius, 155);
  assert.equal(levelThree.level.tuning.scanDurationMs, 520);
  assert.equal(levelThree.level.tuning.queueAdvanceDurationMs, 360);
  assert.equal(levelOne.runtime.reward.completionCoins, 40);
  assert.equal(levelTwo.runtime.reward.completionCoins, 60);
  assert.equal(levelThree.runtime.reward.totalCoins, 80);
  assert.equal(levelThree.runtime.customerCount, 6);
});

test("All level assets resolve through the canonical catalogue", () => {
  campaign.levels.forEach((entry) => {
    assert.deepEqual(
      STARTER_RUNTIME_ASSET_REGISTRY.validateKeys(levelAssetKeys(entry.level)),
      []
    );
  });

  const levelOne = campaign.levels[0].level;
  const levelTwo = campaign.levels[1].level;
  const levelThree = campaign.levels[2].level;

  assert.equal(
    levelOne.assetBindings.environmentAssetKey,
    levelThree.assetBindings.environmentAssetKey
  );
  assert.equal(levelOne.assetBindings.workerIdleAssetKey, "worker-a-idle");
  assert.equal(levelOne.assetBindings.fixtureAssetKey, levelTwo.assetBindings.fixtureAssetKey);
  assert.notEqual(levelOne.assetBindings.productAssetKey, levelTwo.assetBindings.productAssetKey);
  assert.deepEqual(levelThree.assetBindings.customerAssetKeys, [
    "customer-a-carry-basket",
    "customer-b-carry-basket"
  ]);
});

test("Level selector accepts level IDs and keeps legacy shift selection deterministic", () => {
  assert.equal(selectCampaignLevel(campaign).level.id, "starter-level-001");
  assert.equal(
    selectCampaignLevel(campaign, "starter-level-003").level.mode,
    "checkout"
  );
  assert.equal(
    selectCampaignLevel(campaign, "starter-shift-002").level.id,
    "starter-level-002"
  );
  assert.throws(
    () => selectCampaignLevel(campaign, "missing-level"),
    /does not belong to campaign/
  );
});
