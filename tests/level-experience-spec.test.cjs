const test = require("node:test");
const assert = require("node:assert/strict");

const {
  STARTER_LEVEL_EXPERIENCE_SPECS,
  resolveLevelExperienceSpec,
  validateLevelExperienceSpecs
} = require("../.test-dist/src/game/content/experience/LevelExperienceSpec.js");
const {
  STARTER_MARKET_LEVELS
} = require("../.test-dist/src/game/content/levels/starterMarketLevels.js");

test("All ten campaign levels own explicit experience contracts", () => {
  assert.equal(STARTER_LEVEL_EXPERIENCE_SPECS.length, 10);
  assert.deepEqual(validateLevelExperienceSpecs(STARTER_MARKET_LEVELS), []);
  assert.deepEqual(
    STARTER_LEVEL_EXPERIENCE_SPECS.map((spec) => spec.levelId),
    STARTER_MARKET_LEVELS.map((level) => level.id)
  );
});

test("Experience contracts contain usable player-facing instructions", () => {
  STARTER_MARKET_LEVELS.forEach((level) => {
    const spec = resolveLevelExperienceSpec(level);
    assert.equal(spec.mode, level.mode);
    assert.ok(spec.modeLabel.length >= 5);
    assert.ok(spec.objective.length >= 30);
    assert.ok(spec.mechanic.length >= 30);
    assert.ok(spec.control.length >= 30);
    assert.ok(spec.successMetric.length >= 25);
  });
});

test("Repeated modes no longer share one generic briefing label", () => {
  const labelsByMode = new Map();
  STARTER_LEVEL_EXPERIENCE_SPECS.forEach((spec) => {
    const labels = labelsByMode.get(spec.mode) ?? new Set();
    labels.add(spec.modeLabel);
    labelsByMode.set(spec.mode, labels);
  });

  assert.equal(labelsByMode.get("restock").size, 4);
  assert.equal(labelsByMode.get("checkout").size, 2);
  assert.equal(labelsByMode.get("clean").size, 2);
  assert.equal(labelsByMode.get("find-items").size, 2);
});

test("A guided level checklist is configured by signals rather than gameplay ID branches", () => {
  const guidedSpecs = STARTER_LEVEL_EXPERIENCE_SPECS.filter((spec) => spec.checklist);
  assert.equal(guidedSpecs.length, 1);

  const checklist = guidedSpecs[0].checklist;
  assert.deepEqual(checklist.steps.map((step) => step.id), [
    "pickup",
    "load",
    "deliver",
    "open",
    "stock"
  ]);
  assert.deepEqual(checklist.steps.map((step) => step.action), [
    "PICK_BOX",
    "LOAD_CART",
    "PUSH_CART",
    "OPEN_BOX",
    undefined
  ]);
  assert.equal(checklist.steps.at(-1).tracksProgress, true);
});

test("Checkout basics requires multiple product drags before each payment", () => {
  const scanSpecs = STARTER_LEVEL_EXPERIENCE_SPECS.filter((spec) => spec.checkoutScan);
  assert.equal(scanSpecs.length, 1);

  const checkoutScan = scanSpecs[0].checkoutScan;
  assert.deepEqual(checkoutScan.itemCountPattern, [2, 3, 2, 3, 2, 3]);
  assert.equal(checkoutScan.itemCountPattern.reduce((sum, count) => sum + count, 0), 15);
  assert.ok(new Set(checkoutScan.productAssetKeys).size >= 5);
  assert.equal(checkoutScan.scannerLabel, "SCAN ZONE");
  assert.equal(checkoutScan.paymentLabel, "CONFIRM PAYMENT");
});

test("Spill patrol requires sustained cleaning rather than one tap", () => {
  const holdSpecs = STARTER_LEVEL_EXPERIENCE_SPECS.filter((spec) => spec.holdWork);
  assert.equal(holdSpecs.length, 1);

  const holdWork = holdSpecs[0].holdWork;
  assert.equal(holdWork.action, "CLEAN_SPOT");
  assert.equal(holdWork.durationMs, 1300);
  assert.equal(holdWork.holdLabel, "HOLD TO CLEAN");
  assert.match(holdWork.instruction, /Releasing early interrupts/);
});
