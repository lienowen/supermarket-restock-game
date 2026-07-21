const test = require("node:test");
const assert = require("node:assert/strict");

const {
  CampaignSession
} = require("../.test-dist/src/game/application/CampaignSession.js");
const {
  STARTER_MARKET_LEVELS
} = require("../.test-dist/src/game/content/levels/starterMarketLevels.js");
const {
  validateLevelDefinitions
} = require("../.test-dist/src/game/content/validation/LevelConfigValidator.js");
const {
  DomainEventBus
} = require("../.test-dist/src/game/events/DomainEventBus.js");
const {
  createRuleComponentRegistry,
  RulesEngine
} = require("../.test-dist/src/game/rules/RuleComponentRegistry.js");
const {
  DeterministicRandom
} = require("../.test-dist/src/game/simulation/DeterministicRandom.js");

test("Seeded random streams are reproducible", () => {
  const first = new DeterministicRandom("level-seed");
  const second = new DeterministicRandom("level-seed");
  const third = new DeterministicRandom("another-seed");
  const sequence = (random) => Array.from({ length: 8 }, () => random.next());

  assert.deepEqual(sequence(first), sequence(second));
  assert.notDeepEqual(sequence(new DeterministicRandom("level-seed")), sequence(third));
});

test("Rule engine composes typed conditions actions modifiers and behaviors", () => {
  const noErrors = () => [];
  const registry = createRuleComponentRegistry([
    {
      kind: "condition",
      type: "score.at-least",
      validate: noErrors,
      evaluate: ({ state }, params) => state.score >= params.value
    },
    {
      kind: "action",
      type: "score.add",
      validate: noErrors,
      execute: ({ state }, params) => ({ ...state, score: state.score + params.value })
    },
    {
      kind: "modifier",
      type: "value.multiply",
      validate: noErrors,
      apply: (value, _context, params) => value * params.value
    },
    {
      kind: "behavior",
      type: "time.advance",
      validate: noErrors,
      tick: ({ state }, _params, deltaMs) => ({ ...state, elapsed: state.elapsed + deltaMs })
    }
  ]);
  const engine = new RulesEngine(registry);
  const references = [
    { id: "ready", kind: "condition", type: "score.at-least", params: { value: 5 } },
    { id: "bonus", kind: "action", type: "score.add", params: { value: 3 } },
    { id: "multiplier", kind: "modifier", type: "value.multiply", params: { value: 2 } },
    { id: "clock", kind: "behavior", type: "time.advance", params: {} }
  ];
  const context = {
    state: { score: 5, elapsed: 0 },
    nowMs: 100,
    random: () => 0.5,
    emit: () => {}
  };

  assert.deepEqual(registry.validate(references), []);
  assert.equal(engine.evaluateConditions(references, context), true);
  assert.deepEqual(engine.executeActions(references, context), { score: 8, elapsed: 0 });
  assert.equal(engine.applyModifiers(10, references, context), 20);
  assert.deepEqual(engine.tickBehaviors(references, context, 250), { score: 5, elapsed: 250 });
});

test("Domain event bus separates logical events from presentation listeners", () => {
  const bus = new DomainEventBus();
  const received = [];
  const dispose = bus.subscribe("task.progressed", (event) => received.push(event.payload));
  bus.emit("task.progressed", { progress: 1, total: 3 }, 123);
  dispose();
  bus.emit("task.progressed", { progress: 2, total: 3 }, 124);

  assert.deepEqual(received, [{ progress: 1, total: 3 }]);
});

test("Campaign session emits domain events without depending on Phaser or DOM", () => {
  let snapshot;
  const store = {
    load: () => snapshot,
    save: (value) => { snapshot = value; },
    clear: () => { snapshot = undefined; }
  };
  const events = [];
  const sink = { emit: (type, payload) => events.push({ type, payload }) };
  const session = new CampaignSession({
    campaignId: "campaign",
    firstLevelId: "level-1",
    defaultEconomy: { coins: 10, stars: 0, reputation: 0 }
  }, store, sink);

  session.completeLevel("level-1", "level-2", { coins: 20, stars: 1, reputation: 0 });
  session.reset();

  assert.deepEqual(events.map((event) => event.type), [
    "campaign.level-completed",
    "campaign.reset"
  ]);
});

test("Level schema validation rejects stale versions and missing seeds", () => {
  assert.deepEqual(validateLevelDefinitions(STARTER_MARKET_LEVELS), []);
  const invalid = {
    ...STARTER_MARKET_LEVELS[0],
    schemaVersion: 0,
    randomSeed: ""
  };
  const errors = validateLevelDefinitions([invalid]);
  assert.equal(errors.some((error) => error.includes("unsupported schema version")), true);
  assert.equal(errors.some((error) => error.includes("random seed")), true);
});
