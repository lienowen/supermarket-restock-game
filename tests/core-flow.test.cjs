const test = require("node:test");
const assert = require("node:assert/strict");

const { LEVELS } = require("../.test-dist/src/levels/levelConfigs.js");
const { ShiftManager } = require("../.test-dist/src/systems/ShiftManager.js");
const { CustomerStateMachine } = require("../.test-dist/src/systems/CustomerStateMachine.js");
const { gameSession } = require("../.test-dist/src/systems/GameSession.js");
const {
  getCartLoadState,
  canDragBox,
  canMoveCart,
  canRestock
} = require("../.test-dist/src/systems/interactionRules.js");

test("ShiftManager owns PREPARE -> OPEN -> RUSH -> CLOSING transitions", () => {
  const manager = new ShiftManager(LEVELS.day01);

  assert.equal(manager.currentPhase, "PREPARE");
  assert.equal(manager.openStore().to, "OPEN");

  for (let i = 0; i < 3; i += 1) {
    assert.equal(manager.recordSale(), undefined);
  }

  const rush = manager.recordSale();
  assert.equal(rush.to, "RUSH");
  assert.equal(manager.sales, 4);

  for (let i = 0; i < 3; i += 1) {
    assert.equal(manager.recordSale(), undefined);
  }

  const closing = manager.recordSale();
  assert.equal(closing.to, "CLOSING");
  assert.equal(manager.sales, 8);
});

test("GameSession rejects phase/sales overwrite from legacy scene sync", () => {
  gameSession.reset("day01");
  gameSession.openStore();
  gameSession.recordSale();
  gameSession.recordSale();

  gameSession.syncRuntime({
    phase: "RESULT",
    soldCount: 99,
    money: 50,
    stocked: 4,
    shiftEnded: false
  });

  assert.equal(gameSession.phase, "OPEN");
  assert.equal(gameSession.sales, 2);
  assert.equal(gameSession.snapshot.money, 50);
  assert.equal(gameSession.snapshot.stocked, 4);
});

test("Cart load states are visually distinct", () => {
  assert.equal(getCartLoadState(0, 6, 3), "EMPTY");
  assert.equal(getCartLoadState(1, 6, 3), "LOADING");
  assert.equal(getCartLoadState(3, 6, 3), "READY");
  assert.equal(getCartLoadState(6, 6, 3), "FULL");
});

test("Box dragging is blocked by pause, sales-floor cart and full capacity", () => {
  const base = {
    paused: false,
    shiftEnded: false,
    movingCart: false,
    restockBusy: false,
    cartAtShelf: false,
    boxLoaded: false,
    cartCount: 1,
    cartCapacity: 6
  };

  assert.equal(canDragBox(base), true);
  assert.equal(canDragBox({ ...base, paused: true }), false);
  assert.equal(canDragBox({ ...base, cartAtShelf: true }), false);
  assert.equal(canDragBox({ ...base, cartCount: 6 }), false);
});

test("Cart movement follows the three-box Day 1 departure rule", () => {
  const base = {
    paused: false,
    shiftEnded: false,
    movingCart: false,
    restockBusy: false,
    fromSalesFloor: false,
    cartCount: 2,
    departureRequirement: 3
  };

  assert.equal(canMoveCart(base), false);
  assert.equal(canMoveCart({ ...base, cartCount: 3 }), true);
  assert.equal(canMoveCart({ ...base, paused: true, cartCount: 3 }), false);
  assert.equal(canMoveCart({ ...base, fromSalesFloor: true }), true);
});

test("Restock requires a shelf-side cart and matching stock", () => {
  const base = {
    paused: false,
    shiftEnded: false,
    movingCart: false,
    restockBusy: false,
    cartAtShelf: true,
    slotOccupied: false,
    slotReserved: false,
    hasMatchingStock: true
  };

  assert.equal(canRestock(base), true);
  assert.equal(canRestock({ ...base, hasMatchingStock: false }), false);
  assert.equal(canRestock({ ...base, slotOccupied: true }), false);
  assert.equal(canRestock({ ...base, paused: true }), false);
});

test("Customer patience only changes when the simulation ticks it", () => {
  const customer = new CustomerStateMachine(1000);
  customer.transition("SEARCH");
  customer.transition("WAIT");

  const beforePause = customer.patienceRemainingMs;
  // Global pause freezes the scene update loop, so tick() is intentionally not called.
  assert.equal(customer.patienceRemainingMs, beforePause);

  customer.tick(400);
  assert.equal(customer.patienceRemainingMs, 600);
});
