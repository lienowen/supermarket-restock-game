const test = require("node:test");
const assert = require("node:assert/strict");

const { STARTER_MARKET_CONTENT } = require("../.test-dist/src/game/content/starterMarket.js");
const { resolveLevelCampaignRuntime } = require("../.test-dist/src/game/application/LevelRuntimeContent.js");
const { RestockRushController } = require("../.test-dist/src/game/application/RestockRushController.js");

const campaign = resolveLevelCampaignRuntime(STARTER_MARKET_CONTENT, "main-campaign");
const finale = campaign.levels.find((entry) => entry.level.id === "starter-level-010");

test("Level 10 is an integrated 18-placement finale without a memory modal", () => {
  assert.ok(finale);
  const rush = finale.level.tuning.rush;
  assert.equal(rush.waveMemory, undefined);
  assert.equal(rush.memoryPreview, undefined);
  assert.equal(rush.sequenceMode, "shuffled");
  assert.equal(rush.itemsPerRow, 3);
  assert.equal(rush.unitsPerInteraction, 1);
  assert.equal(finale.runtime.totalUnits, 18);
});

test("Final rush requires three accurate placements before advancing a shelf", () => {
  const tuning = finale.level.tuning.rush;
  const controller = new RestockRushController({
    rowCount: 6,
    randomSeed: finale.level.randomSeed,
    ...tuning
  });
  const matching = new RestockRushController({
    rowCount: 6,
    randomSeed: finale.level.randomSeed,
    ...tuning
  });

  const planned = controller.plannedRowIndexes();
  assert.equal(planned.length, 6);
  assert.equal(new Set(planned).size, 6);
  assert.deepEqual(planned, matching.plannedRowIndexes());

  const first = controller.start(0);
  const wrongRow = (first.activeRowIndex + 1) % 6;
  const wrong = controller.selectRow(wrongRow, 100);
  assert.equal(wrong.correct, false);
  assert.equal(wrong.snapshot.mistakes, 1);
  const target = wrong.snapshot.activeRowIndex;
  const firstBottle = controller.selectRow(target, 200);
  const secondBottle = controller.selectRow(target, 300);
  const thirdBottle = controller.selectRow(target, 400);
  assert.equal(firstBottle.rowCompleted, false);
  assert.equal(secondBottle.rowCompleted, false);
  assert.equal(thirdBottle.rowCompleted, true);
  assert.equal(thirdBottle.snapshot.totalItemsStocked, 3);
});

test("Level 10 switches to a readable cooler close-up for the 18 placements", () => {
  const sceneSource = require("node:fs").readFileSync(
    "src/game/presentation/scenes/StarterMarketScene.ts",
    "utf8"
  );
  const catalogueSource = require("node:fs").readFileSync(
    "src/game/assets/GlobalProjectAssetCatalogue.ts",
    "utf8"
  );
  const actorSource = require("node:fs").readFileSync(
    "src/game/presentation/actors/RestockActorView.ts",
    "utf8"
  );
  const closeupSource = require("node:fs").readFileSync(
    "src/game/presentation/fixtures/HdBeverageCoolerView.ts",
    "utf8"
  );

  assert.match(sceneSource, /environment-final-shift-l10/);
  assert.match(sceneSource, /HdBeverageCoolerView/);
  assert.match(sceneSource, /usesFinaleWallCooler\s*\?\s*new HdBeverageCoolerView/);
  assert.doesNotMatch(sceneSource, /slotWidth:\s*50/);
  assert.doesNotMatch(sceneSource, /bottleWidth:\s*13/);
  assert.match(closeupSource, /const CLOSEUP_WIDTH = 1180/);
  assert.match(closeupSource, /const SLOT_WIDTH = 320/);
  assert.match(closeupSource, /const SLOT_XS = \[623, 993\]/);
  assert.match(closeupSource, /const SLOT_YS = \[347, 467, 587\]/);
  assert.match(closeupSource, /\.setAlpha\(0\)/);
  assert.match(catalogueSource, /bg-l10-cooler-closeup-v1\.png/);
  assert.match(sceneSource, /finaleStation:/);
  assert.match(actorSource, /fixedWorkerPosition/);
  assert.match(actorSource, /fixedFinalCartPosition/);
  assert.match(sceneSource, /FINAL SHIFT COMPLETE!/);
  assert.match(catalogueSource, /bg-final-shift-l10-empty-cooler-v3\.webp/);
});

test("Level 10 keeps its challenge inside the world instead of opening memory UI", () => {
  const levelSource = require("node:fs").readFileSync(
    "src/game/content/levels/starterMarketLevels.ts",
    "utf8"
  );
  const finaleBlock = levelSource.slice(levelSource.indexOf('id: "starter-level-010"'));
  assert.doesNotMatch(finaleBlock, /waveMemory:/);
  assert.doesNotMatch(finaleBlock, /memoryPreview:/);
});
