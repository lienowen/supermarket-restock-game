const test = require("node:test");
const assert = require("node:assert/strict");

const {
  RulesEngine
} = require("../.test-dist/src/game/rules/RuleComponentRegistry.js");
const {
  STANDARD_MARKET_RULE_REGISTRY
} = require("../.test-dist/src/game/rules/StandardMarketRuleComponents.js");

const references = [
  {
    id: "half-complete",
    kind: "condition",
    type: "progress.at-least",
    params: { ratio: 0.5 }
  },
  {
    id: "bonus-coins",
    kind: "action",
    type: "economy.grant-coins",
    params: { amount: 25 }
  },
  {
    id: "reward-multiplier",
    kind: "modifier",
    type: "number.multiply",
    params: { multiplier: 1.5 }
  },
  {
    id: "countdown",
    kind: "behavior",
    type: "timer.countdown",
    params: { rate: 1 }
  }
];

const context = (state, events = []) => ({
  state,
  nowMs: 1000,
  random: () => 0.25,
  emit: (event) => events.push(event)
});

const initialState = Object.freeze({
  progress: 3,
  total: 6,
  coins: 100,
  remainingMs: 500
});

test("Standard market rules validate through the shared registry", () => {
  assert.deepEqual(STANDARD_MARKET_RULE_REGISTRY.validate(references), []);
});

test("Condition action modifier and behavior execute deterministically", () => {
  const engine = new RulesEngine(STANDARD_MARKET_RULE_REGISTRY);
  const events = [];

  assert.equal(engine.evaluateConditions(references, context(initialState, events)), true);

  const rewarded = engine.executeActions(references, context(initialState, events));
  assert.equal(rewarded.coins, 125);

  const multiplied = engine.applyModifiers(40, references, context(rewarded, events));
  assert.equal(multiplied, 60);

  const countdown = engine.tickBehaviors(references, context(rewarded, events), 500);
  assert.equal(countdown.remainingMs, 0);
  assert.deepEqual(events.map((event) => event.type), [
    "economy.coins-granted",
    "timer.expired"
  ]);
});

test("Invalid rule parameters are rejected before a level starts", () => {
  assert.deepEqual(
    STANDARD_MARKET_RULE_REGISTRY.validate([
      {
        id: "bad-ratio",
        kind: "condition",
        type: "progress.at-least",
        params: { ratio: 2 }
      }
    ]),
    ["Rule bad-ratio: ratio must be at most 1"]
  );
});
