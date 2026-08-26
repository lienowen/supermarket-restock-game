const test = require("node:test");
const assert = require("node:assert/strict");

const { STARTER_MARKET_CONTENT } = require("../.test-dist/src/game/content/starterMarket.js");
const { resolveLevelCampaignRuntime } = require("../.test-dist/src/game/application/LevelRuntimeContent.js");
const { RestockRushController } = require("../.test-dist/src/game/application/RestockRushController.js");

const campaign = resolveLevelCampaignRuntime(STARTER_MARKET_CONTENT, "main-campaign");
const finale = campaign.levels.find((entry) => entry.level.id === "starter-level-010");

test("Level 10 is a two-wave blind-memory finale rather than a timing-only restock", () => {
  assert.ok(finale);
  const rush = finale.level.tuning.rush;
  assert.deepEqual(rush.waveMemory, {
    waveSize: 3,
    previewDurationMs: 2300,
    hideActiveTarget: true,
    keepTargetOnFailure: true,
    instruction: "Tap each shelf once in the memorized order. The worker places all 3 bottles."
  });
  assert.equal(rush.memoryPreview, undefined);
  assert.equal(rush.sequenceMode, "shuffled");
  assert.equal(rush.itemsPerRow, 1);
  assert.equal(rush.unitsPerInteraction, 3);
  assert.equal(finale.runtime.restockInstruction, rush.waveMemory.instruction);
});

test("Final memory route stays deterministic and keeps its target after a wrong shelf", () => {
  const tuning = finale.level.tuning.rush;
  const controller = new RestockRushController({
    rowCount: 6,
    randomSeed: finale.level.randomSeed,
    ...tuning,
    keepTargetOnFailure: tuning.waveMemory.keepTargetOnFailure
  });
  const matching = new RestockRushController({
    rowCount: 6,
    randomSeed: finale.level.randomSeed,
    ...tuning,
    keepTargetOnFailure: tuning.waveMemory.keepTargetOnFailure
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
  assert.equal(wrong.snapshot.activeRowIndex, first.activeRowIndex);
});

test("Level 10 stocks the empty wall cooler inside the supermarket scene", () => {
  const sceneSource = require("node:fs").readFileSync(
    "src/game/presentation/scenes/StarterMarketScene.ts",
    "utf8"
  );
  const catalogueSource = require("node:fs").readFileSync(
    "src/game/assets/GlobalProjectAssetCatalogue.ts",
    "utf8"
  );

  assert.match(sceneSource, /environment-final-shift-l10/);
  assert.doesNotMatch(sceneSource, /HdBeverageCoolerView/);
  assert.match(sceneSource, /slotPositions:/);
  assert.match(sceneSource, /\{ x: 1503, y: 315 \}/);
  assert.match(sceneSource, /\{ x: 1568, y: 445 \}/);
  assert.match(sceneSource, /glassPanels: \[\]/);
  assert.match(sceneSource, /finaleStation:/);
  assert.match(sceneSource, /FINAL SHIFT COMPLETE!/);
  assert.match(catalogueSource, /bg-final-shift-l10-empty-cooler\.png/);
});

test("Level 10 memory preview fits short landscape phone screens", () => {
  const previewSource = require("node:fs").readFileSync(
    "src/game/presentation/ui/RestockMemoryPreviewDom.ts",
    "utf8"
  );

  assert.match(previewSource, /maxHeight: "calc\(100dvh - 20px\)"/);
  assert.match(previewSource, /repeat\(3, clamp\(40px, 9\.5vh, 70px\)\)/);
  assert.match(previewSource, /tap each shelf once in the same order/i);
});
