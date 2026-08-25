const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const {
  resolveClosingSafetyRouteChoices
} = require("../.test-dist/src/game/systems/cleaning/ClosingSafetyRoute.js");
const {
  resolveCleaningExperienceSpec
} = require("../.test-dist/src/game/content/experience/CleaningExperienceSpec.js");
const {
  STARTER_MARKET_LEVELS
} = require("../.test-dist/src/game/content/levels/starterMarketLevels.js");

test("L8 makes water, juice and oil the first selectable safety route", () => {
  const level = STARTER_MARKET_LEVELS.find((entry) => entry.id === "starter-level-008");
  const spec = resolveCleaningExperienceSpec(level);
  assert.ok(spec);
  assert.deepEqual(spec.warningRequiredSpillIndexes, [0, 2, 4]);
  assert.deepEqual(
    resolveClosingSafetyRouteChoices(6, new Set(), new Set(spec.warningRequiredSpillIndexes)),
    [0, 2, 4]
  );
});

test("L8 unlocks player-chosen dry cleanup only after every danger is complete", () => {
  const warnings = new Set([0, 2, 4]);
  assert.deepEqual(resolveClosingSafetyRouteChoices(6, new Set([2]), warnings), [0, 4]);
  assert.deepEqual(resolveClosingSafetyRouteChoices(6, new Set([0, 2, 4]), warnings), [1, 3, 5]);
});

test("L8 requires explicit safety-sign recovery after scrubbing", () => {
  const source = fs.readFileSync(
    "src/game/presentation/cleaning/ClosingSafetyCleaningTaskView.ts",
    "utf8"
  );
  assert.match(source, /awaitingSignRecovery/);
  assert.match(source, /recoverWarningSign/);
  assert.match(source, /TAP AGAIN TO RECOVER SAFETY SIGN/);
  assert.match(source, /DANGER FIRST/);
  assert.match(source, /closing-customer-patrol/);
  assert.match(source, /customerWalkTween/);
  assert.match(source, /onYoyo: \(\) => this\.customerPatrol\?\.setFlipX\(true\)/);
  assert.match(source, /CUSTOMER WAITING · SECURE HAZARD/);
  assert.match(source, /cleaningCustomerRisk/);
});
