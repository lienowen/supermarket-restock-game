const test = require("node:test");
const assert = require("node:assert/strict");

const {
  CART_CAPACITY_EXPERIENCE_SPECS,
  resolveCartCapacityExperienceSpec,
  validateCartCapacityExperienceSpecs
} = require("../.test-dist/src/game/content/experience/CartCapacityExperienceSpec.js");
const {
  STARTER_MARKET_LEVELS
} = require("../.test-dist/src/game/content/levels/starterMarketLevels.js");

test("Closing stock sprint owns a two-slot cart selection challenge", () => {
  assert.equal(CART_CAPACITY_EXPERIENCE_SPECS.length, 1);
  assert.deepEqual(validateCartCapacityExperienceSpecs(STARTER_MARKET_LEVELS), []);

  const level = STARTER_MARKET_LEVELS.find((entry) => entry.id === "starter-level-006");
  assert.ok(level);
  const spec = resolveCartCapacityExperienceSpec(level);
  assert.ok(spec);
  assert.equal(spec.capacity, 2);
  assert.equal(spec.unlockAfterAction, "PICK_BOX");
  assert.equal(spec.confirmAction, "LOAD_CART");
});

test("Cart selection contains two cola cases and one rejected water case", () => {
  const spec = CART_CAPACITY_EXPERIENCE_SPECS[0];
  const accepted = spec.options.filter((option) => option.accepted);
  const rejected = spec.options.filter((option) => !option.accepted);

  assert.equal(accepted.length, 2);
  assert.ok(accepted.every((option) => option.assetKey === "prop-cola-case-closed"));
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].assetKey, "prop-water-case-closed");
  assert.equal(new Set(spec.options.map((option) => option.id)).size, 3);
});
