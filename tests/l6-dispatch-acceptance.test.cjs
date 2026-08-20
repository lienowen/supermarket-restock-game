const test = require("node:test");
const assert = require("node:assert/strict");
const { CART_CAPACITY_EXPERIENCE_SPECS, isDispatchOrderValid } = require("../.test-dist/src/game/content/experience/CartCapacityExperienceSpec.js");

test("L6 is an auto-start two-order dispatch flow", () => {
  const spec = CART_CAPACITY_EXPERIENCE_SPECS[0];
  assert.equal(spec.autoStart, true);
  assert.equal(spec.roundsRequired, 2);
  assert.deepEqual(spec.requiredSizesPerOrder, ["large", "medium", "small"]);
});

test("L6 accepts only one large, medium and small case", () => {
  const required = ["large", "medium", "small"];
  assert.equal(isDispatchOrderValid(["large", "medium", "small"], required), true);
  assert.equal(isDispatchOrderValid(["large", "large"], required), false);
  assert.equal(isDispatchOrderValid(["medium", "medium", "medium"], required), false);
  assert.equal(isDispatchOrderValid(["large", "medium"], required), false);
});
