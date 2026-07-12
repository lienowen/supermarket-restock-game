const test = require("node:test");
const assert = require("node:assert/strict");

const { LEVELS } = require("../.test-dist/src/levels/levelConfigs.js");
const { ShiftManager } = require("../.test-dist/src/systems/ShiftManager.js");
const { CustomerStateMachine } = require("../.test-dist/src/systems/CustomerStateMachine.js");
const { gameSession } = require("../.test-dist/src/systems/GameSession.js");
const { calculatePerformanceStars } = require("../.test-dist/src/systems/PerformanceRating.js");
const { GAME_RULES } = require("../.test-dist/src/gameConfig.js");
const {
  getCartLoadState,
  canDragBox,
  canMoveCart,
  canRestock
} = require("../.test-dist/src/systems/interactionRules.js");

test("ShiftManager owns the mature Day 1 OPEN -> RUSH -> CLOSING targets", () => {
  const manager = new ShiftManager(LEVELS.day01);

  assert.equal(manager.currentPhase, "PREPARE");
  assert.equal(manager.openStore().to, "OPEN");

  assert.equal(manager.recordSale(), undefined);
  const rush = manager.recordSale();
  assert.equal(rush.to, "RUSH");
  assert.equal(manager.sales, 2);

  assert.equal(manager.recordSale(), undefined);
  const closing = manager.recordSale();
  assert.equal(closing.to, "CLOSING");
  assert.equal(manager.sales, 4);
});

test("The first three shifts add responsibility without excessive sales targets", () => {
  assert.deepEqual(LEVELS.day01.salesTargets, { openToRush: 2, rushToClosing: 4 });
  assert.deepEqual(LEVELS.day02.salesTargets, { openToRush: 3, rushToClosing: 6 });
  assert.deepEqual(LEVELS.day03.salesTargets, { openToRush: 4, rushToClosing: 8 });
  assert.equal(LEVELS.day01.title, "Opening Routine");
  assert.equal(LEVELS.day02.title, "Promotion & Checkout");
  assert.equal(LEVELS.day03.title, "Shift Supervisor");
});

test("GameSession rejects phase sales and wallet overwrite from legacy scene sync", () => {
  gameSession.setCoins(7);
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

  assert.equal(gameSession.phase, "RUSH");
  assert.equal(gameSession.sales, 2);
  assert.equal(gameSession.snapshot.money, 7);
  assert.equal(gameSession.snapshot.stocked, 4);
});

test("Wallet coins survive day reset and can be earned cumulatively", () => {
  gameSession.setCoins(20);
  gameSession.earnCoins(12);
  assert.equal(gameSession.coins, 32);

  gameSession.reset("day02");
  assert.equal(gameSession.coins, 32);
});

test("Performance stars reward completion quality instead of raw sales only", () => {
  const base = {
    phase: "OPEN",
    soldCount: 0,
    openSalesTarget: 4,
    closingSalesTarget: 8,
    missedSales: 0,
    wrongStock: 0,
    bestCombo: 0
  };

  assert.equal(calculatePerformanceStars({ ...base, phase: "PREPARE" }), 0);
  assert.equal(calculatePerformanceStars(base), 1);
  assert.equal(calculatePerformanceStars({ ...base, soldCount: 4, missedSales: 2 }), 2);
  assert.equal(calculatePerformanceStars({
    ...base,
    phase: "CLOSING",
    soldCount: 8,
    bestCombo: 2
  }), 3);
  assert.equal(calculatePerformanceStars({
    ...base,
    phase: "CLOSING",
    soldCount: 8,
    bestCombo: 2,
    wrongStock: 1
  }), 2);
  assert.equal(calculatePerformanceStars({
    ...base,
    phase: "CLOSING",
    soldCount: 8,
    bestCombo: 2,
    missedSales: 1
  }), 2);
});

test("Runtime rules follow all three active campaign days", () => {
  gameSession.reset("day01");
  assert.equal(GAME_RULES.shiftSeconds, 240);
  assert.equal(GAME_RULES.normalSalesTarget, 2);
  assert.equal(GAME_RULES.rushSalesTarget, 4);
  assert.equal(GAME_RULES.customerIntervalOpenMs, 6200);
  assert.equal(GAME_RULES.customerIntervalRushMs, 4600);

  gameSession.reset("day02");
  assert.equal(GAME_RULES.shiftSeconds, 300);
  assert.equal(GAME_RULES.normalSalesTarget, 3);
  assert.equal(GAME_RULES.rushSalesTarget, 6);
  assert.equal(GAME_RULES.customerIntervalOpenMs, 6800);
  assert.equal(GAME_RULES.customerIntervalRushMs, 5000);

  gameSession.reset("day03");
  assert.equal(GAME_RULES.shiftSeconds, 330);
  assert.equal(GAME_RULES.normalSalesTarget, 4);
  assert.equal(GAME_RULES.rushSalesTarget, 8);
  assert.equal(GAME_RULES.customerIntervalOpenMs, 6500);
  assert.equal(GAME_RULES.customerIntervalRushMs, 4700);
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
  assert.equal(customer.patienceRemainingMs, beforePause);

  customer.tick(400);
  assert.equal(customer.patienceRemainingMs, 600);
});
