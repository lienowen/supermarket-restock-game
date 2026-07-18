const test = require("node:test");
const assert = require("node:assert/strict");

const {
  RestockWorkflow
} = require("../.test-dist/src/game/systems/stocking/RestockWorkflow.js");
const {
  RestockInteractionResolver
} = require("../.test-dist/src/game/interactions/RestockInteractionResolver.js");
const {
  RestockSession
} = require("../.test-dist/src/game-v2/domain/restock.js");

function createMission(productId, fixtureId, amount) {
  return {
    id: `restock-${productId}`,
    title: `Restock ${productId}`,
    objectives: [
      {
        type: "transfer-product",
        productId,
        targetFixtureId: fixtureId,
        amount
      }
    ],
    rewards: { coins: 50, stars: 1 }
  };
}

function createWorkflow(overrides = {}) {
  const productId = overrides.productId ?? "cola-bottle";
  const fixtureId = overrides.fixtureId ?? "beverage-cooler-a";
  const slotCount = overrides.slotCount ?? 6;
  const unitsPerSlot = overrides.unitsPerSlot ?? 4;
  const totalUnits = slotCount * unitsPerSlot;

  return new RestockWorkflow({
    workerId: "worker-a",
    cartId: "cart-a",
    caseId: "case-a",
    productId,
    fixtureId,
    sourceLocationId: "backroom",
    destinationLocationId: "sales-floor",
    caseQuantity: totalUnits,
    unitsPerSlot,
    slotCount,
    cartCapacity: totalUnits,
    initialCoins: 100,
    coinsPerSlot: 10,
    completionCoins: 40,
    completionStars: 1,
    mission: createMission(productId, fixtureId, totalUnits),
    ...overrides
  });
}

test("V3 restock workflow rejects actions performed out of order", () => {
  const workflow = createWorkflow();

  assert.equal(workflow.dispatch("LOAD_CART").accepted, false);
  assert.equal(workflow.dispatch("PARK_CART").accepted, false);
  assert.equal(workflow.snapshot().phase, "collect");

  assert.equal(workflow.dispatch("PICK_CASE").accepted, true);
  assert.equal(workflow.dispatch("OPEN_CASE").accepted, false);
  assert.equal(workflow.snapshot().phase, "load");
});

test("V3 restock workflow transfers real product quantities into the fixture", () => {
  const workflow = createWorkflow();
  ["PICK_CASE", "LOAD_CART", "PUSH_CART", "PARK_CART", "OPEN_CASE"].forEach((command) => {
    assert.equal(workflow.dispatch(command).accepted, true);
  });

  assert.equal(workflow.snapshot().caseQuantity, 24);
  assert.equal(workflow.snapshot().fixtureQuantity, 0);

  assert.equal(workflow.dispatch("STOCK_SLOT").accepted, true);
  assert.equal(workflow.snapshot().caseQuantity, 20);
  assert.equal(workflow.snapshot().fixtureQuantity, 4);
  assert.equal(workflow.snapshot().stockedSlots, 1);
});

test("V3 restock workflow completes mission and grants rewards exactly once", () => {
  const workflow = createWorkflow();
  ["PICK_CASE", "LOAD_CART", "PUSH_CART", "PARK_CART", "OPEN_CASE"].forEach((command) => {
    workflow.dispatch(command);
  });

  for (let index = 0; index < 6; index += 1) {
    assert.equal(workflow.dispatch("STOCK_SLOT").accepted, true);
  }

  const completed = workflow.snapshot();
  assert.equal(completed.phase, "complete");
  assert.equal(completed.missionComplete, true);
  assert.equal(completed.fixtureQuantity, 24);
  assert.equal(completed.caseQuantity, 0);
  assert.equal(completed.coins, 200);
  assert.equal(completed.stars, 1);

  assert.equal(workflow.dispatch("STOCK_SLOT").accepted, false);
  assert.equal(workflow.snapshot().coins, 200);
  assert.equal(workflow.snapshot().stars, 1);
});

test("The same V3 workflow supports a different product and fixture size", () => {
  const workflow = createWorkflow({
    productId: "apple-crate",
    fixtureId: "produce-display-a",
    slotCount: 3,
    unitsPerSlot: 5,
    caseQuantity: 15,
    cartCapacity: 15,
    mission: createMission("apple-crate", "produce-display-a", 15)
  });

  ["PICK_CASE", "LOAD_CART", "PUSH_CART", "PARK_CART", "OPEN_CASE"].forEach((command) => {
    workflow.dispatch(command);
  });
  for (let index = 0; index < 3; index += 1) workflow.dispatch("STOCK_SLOT");

  assert.equal(workflow.snapshot().phase, "complete");
  assert.equal(workflow.snapshot().fixtureQuantity, 15);
  assert.equal(workflow.snapshot().stockedSlots, 3);
});

test("Interaction resolver exposes only the action valid for current context", () => {
  const workflow = createWorkflow();
  const resolver = new RestockInteractionResolver();

  assert.deepEqual(resolver.resolve(workflow.snapshot()).map((option) => option.command), ["PICK_CASE"]);
  workflow.dispatch("PICK_CASE");
  assert.deepEqual(resolver.resolve(workflow.snapshot()).map((option) => option.command), ["LOAD_CART"]);
});

test("Legacy Phaser adapter preserves the current six-row gameplay contract", () => {
  const session = new RestockSession(6);
  const actions = [
    "PICK_BOX",
    "LOAD_CART",
    "PUSH_CART",
    "PARK_CART",
    "OPEN_BOX",
    "RESTOCK_ROW",
    "RESTOCK_ROW",
    "RESTOCK_ROW",
    "RESTOCK_ROW",
    "RESTOCK_ROW",
    "RESTOCK_ROW"
  ];

  actions.forEach((action) => assert.equal(session.dispatch(action).accepted, true));
  assert.deepEqual(session.snapshot(), {
    step: "complete",
    stockedRows: 6,
    totalRows: 6,
    boxCollected: true,
    boxLoaded: true,
    cartAtCooler: true,
    boxOpened: true,
    coins: 200,
    stars: 1
  });
});
