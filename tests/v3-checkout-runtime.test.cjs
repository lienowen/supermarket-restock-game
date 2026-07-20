const test = require("node:test");
const assert = require("node:assert/strict");

const {
  STARTER_MARKET_CONTENT
} = require("../.test-dist/src/game/content/starterMarket.js");
const {
  resolveCheckoutLevelRuntime,
  validateCheckoutLevelRuntime
} = require("../.test-dist/src/game/application/CheckoutLevelRuntimeContent.js");
const {
  CheckoutWorkflow
} = require("../.test-dist/src/game/systems/checkout/CheckoutWorkflow.js");

const runtime = resolveCheckoutLevelRuntime(
  STARTER_MARKET_CONTENT,
  "starter-shift-002",
  "assist-checkout-rush",
  { serviceRewardRatio: 0.75 }
);

test("Checkout runtime resolves objective, fixture, and staged rewards", () => {
  assert.deepEqual(validateCheckoutLevelRuntime(runtime), []);
  assert.equal(runtime.fixture.id, "checkout-a");
  assert.equal(runtime.fixture.kind, "checkout");
  assert.equal(runtime.customerCount, 6);
  assert.equal(runtime.reward.totalCoins, 80);
  assert.equal(
    runtime.reward.coinsPerCustomer * runtime.customerCount + runtime.reward.completionCoins,
    runtime.reward.totalCoins
  );
  assert.equal(runtime.reward.totalReputation, 5);
});

test("Checkout workflow enforces order and grants completion rewards once", () => {
  const workflow = new CheckoutWorkflow({
    checkoutId: runtime.fixture.id,
    customerCount: runtime.customerCount,
    initialCoins: 320,
    coinsPerCustomer: runtime.reward.coinsPerCustomer,
    completionCoins: runtime.reward.completionCoins,
    completionStars: runtime.reward.totalStars,
    completionReputation: runtime.reward.totalReputation,
    mission: runtime.mission
  });

  assert.equal(workflow.dispatch("SERVE_CUSTOMER").accepted, false);
  assert.equal(workflow.dispatch("OPEN_REGISTER").accepted, true);

  for (let index = 0; index < runtime.customerCount; index += 1) {
    assert.equal(workflow.dispatch("SERVE_CUSTOMER").accepted, true);
  }

  const completed = workflow.snapshot();
  assert.equal(completed.phase, "complete");
  assert.equal(completed.customersServed, 6);
  assert.equal(completed.coins, 400);
  assert.equal(completed.stars, 1);
  assert.equal(completed.reputation, 5);

  assert.equal(workflow.dispatch("SERVE_CUSTOMER").accepted, false);
  assert.deepEqual(workflow.snapshot(), completed);
});
