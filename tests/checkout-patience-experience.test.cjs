const test = require("node:test");
const assert = require("node:assert/strict");

const {
  CHECKOUT_PATIENCE_EXPERIENCE_SPECS,
  resolveCheckoutPatienceExperienceSpec,
  validateCheckoutPatienceExperienceSpecs
} = require("../.test-dist/src/game/content/experience/CheckoutPatienceExperienceSpec.js");
const {
  STARTER_MARKET_LEVELS
} = require("../.test-dist/src/game/content/levels/starterMarketLevels.js");

test("Evening checkout owns eight patience and produce-weight decisions", () => {
  assert.equal(CHECKOUT_PATIENCE_EXPERIENCE_SPECS.length, 1);
  assert.deepEqual(validateCheckoutPatienceExperienceSpecs(STARTER_MARKET_LEVELS), []);

  const level = STARTER_MARKET_LEVELS.find((entry) => entry.id === "starter-level-007");
  assert.ok(level);
  const spec = resolveCheckoutPatienceExperienceSpec(level);
  assert.ok(spec);
  assert.equal(spec.customerCount, 8);
  assert.equal(spec.targetWeightsKg.length, 8);
  assert.deepEqual(spec.weightChoicesKg, [0.5, 1, 1.5]);
});

test("Wrong produce weight has a meaningful patience penalty", () => {
  const spec = CHECKOUT_PATIENCE_EXPERIENCE_SPECS[0];
  assert.equal(spec.patienceDurationMs, 15000);
  assert.equal(spec.wrongWeightPenaltyMs, 3000);
  assert.ok(spec.wrongWeightPenaltyMs < spec.patienceDurationMs);
  assert.equal(new Set(spec.standardProductAssetKeys).size, 5);
  assert.equal(spec.weighedProductAssetKey, "product-apple");
  assert.ok(spec.targetWeightsKg.every((weight) => spec.weightChoicesKg.includes(weight)));
});
