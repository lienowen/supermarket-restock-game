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
    ["starter-level-001", "starter-level-002"]
  );
  assert.deepEqual(
    campaign.levels.map((entry) => entry.levelLabel),
    ["LEVEL 1", "LEVEL 2"]
  );
  assert.equal(campaign.levels[0].nextLevelId, "starter-level-002");
  assert.equal(campaign.levels[1].previousLevelId, "starter-level-001");
});

test("Each level owns tuning values instead of scene constants", () => {
  const levelOne = campaign.levels[0];
  const levelTwo = campaign.levels[1];

  assert.equal(levelOne.level.tuning.travelDurationMs, 1150);
  assert.equal(levelTwo.level.tuning.travelDurationMs, 1000);
  assert.equal(levelOne.runtime.reward.completionCoins, 40);
  assert.equal(levelTwo.runtime.reward.completionCoins, 60);
  assert.equal(levelOne.runtime.slotCount, 6);
  assert.equal(levelTwo.runtime.slotCount, 6);
});

test("Level assets use canonical catalogue keys and share reusable art", () => {
  const levelOne = campaign.levels[0].level;
  const levelTwo = campaign.levels[1].level;

  assert.deepEqual(STARTER_RUNTIME_ASSET_REGISTRY.validateKeys(levelAssetKeys(levelOne)), []);
  assert.deepEqual(STARTER_RUNTIME_ASSET_REGISTRY.validateKeys(levelAssetKeys(levelTwo)), []);

  assert.equal(
    levelOne.assetBindings.environmentAssetKey,
    levelTwo.assetBindings.environmentAssetKey
  );
  assert.equal(levelOne.assetBindings.fixtureAssetKey, levelTwo.assetBindings.fixtureAssetKey);
  assert.notEqual(levelOne.assetBindings.caseAssetKey, levelTwo.assetBindings.caseAssetKey);
  assert.notEqual(levelOne.assetBindings.productAssetKey, levelTwo.assetBindings.productAssetKey);
});

test("Level selector accepts the new level ID and the legacy shift ID", () => {
  assert.equal(selectCampaignLevel(campaign).level.id, "starter-level-001");
  assert.equal(
    selectCampaignLevel(campaign, "starter-level-002").shift.id,
    "starter-shift-002"
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
