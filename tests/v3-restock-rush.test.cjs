const test = require("node:test");
const assert = require("node:assert/strict");

const {
  RestockRushController
} = require("../.test-dist/src/game/application/RestockRushController.js");

const createRush = (overrides = {}) => new RestockRushController({
  rowCount: 6,
  itemsPerRow: 3,
  randomSeed: "rush-test-seed",
  targetDurationMs: 3000,
  minimumTargetDurationMs: 1200,
  speedUpPerSuccessMs: 200,
  streakWindowMs: 1800,
  goldTimeMs: 12000,
  silverTimeMs: 20000,
  ...overrides
});

test("Restock rush produces a deterministic completed-shelf order from level seed", () => {
  const first = createRush();
  const second = createRush();
  let now = 0;
  const firstCompletedOrder = [];
  const secondCompletedOrder = [];

  first.start(now);
  second.start(now);
  while (!first.snapshot(now).complete) {
    const firstTarget = first.snapshot(now).activeRowIndex;
    const secondTarget = second.snapshot(now).activeRowIndex;
    assert.equal(firstTarget, secondTarget);
    now += 300;
    const firstResult = first.selectRow(firstTarget, now);
    const secondResult = second.selectRow(secondTarget, now);
    if (firstResult.rowCompleted) firstCompletedOrder.push(firstTarget);
    if (secondResult.rowCompleted) secondCompletedOrder.push(secondTarget);
  }

  assert.deepEqual(firstCompletedOrder, secondCompletedOrder);
  assert.equal(firstCompletedOrder.length, 6);
  assert.equal(new Set(firstCompletedOrder).size, 6);
  assert.equal(first.snapshot(now).totalItemsStocked, 18);
  assert.deepEqual(first.snapshot(now).rowItemCounts, [3, 3, 3, 3, 3, 3]);
});

test("A shelf stays active until three individual products are placed", () => {
  const rush = createRush({ rowCount: 2, sequenceMode: "fixed" });
  let now = 0;
  const started = rush.start(now);
  assert.equal(started.activeRowIndex, 0);
  assert.deepEqual(started.rowItemCounts, [0, 0]);

  const first = rush.selectRow(0, now += 300);
  assert.equal(first.correct, true);
  assert.equal(first.stockedItemCount, 1);
  assert.equal(first.rowCompleted, false);
  assert.equal(first.snapshot.activeRowIndex, 0);
  assert.deepEqual(first.snapshot.filledRowIndexes, []);
  assert.deepEqual(first.snapshot.rowItemCounts, [1, 0]);

  const second = rush.selectRow(0, now += 300);
  assert.equal(second.stockedItemCount, 2);
  assert.equal(second.rowCompleted, false);
  assert.equal(second.snapshot.activeRowIndex, 0);
  assert.deepEqual(second.snapshot.filledRowIndexes, []);
  assert.deepEqual(second.snapshot.rowItemCounts, [2, 0]);

  const third = rush.selectRow(0, now += 300);
  assert.equal(third.stockedItemCount, 3);
  assert.equal(third.rowCompleted, true);
  assert.equal(third.snapshot.activeRowIndex, 1);
  assert.deepEqual(third.snapshot.filledRowIndexes, [0]);
  assert.deepEqual(third.snapshot.rowItemCounts, [3, 0]);
});

test("A guided shelf can fill three physical bottles from one player tap", () => {
  const rush = createRush({
    rowCount: 2,
    itemsPerRow: 1,
    unitsPerInteraction: 3,
    sequenceMode: "fixed",
    timeoutEnabled: false
  });

  rush.start(0);
  const first = rush.selectRow(0, 200);
  assert.equal(first.rowCompleted, true);
  assert.equal(first.snapshot.totalItemsStocked, 3);
  assert.equal(first.snapshot.unitsPerInteraction, 3);

  const second = rush.selectRow(1, 400);
  assert.equal(second.snapshot.complete, true);
  assert.equal(second.snapshot.totalItemsStocked, 6);
  assert.deepEqual(second.snapshot.rowItemCounts, [1, 1]);
});

test("Wrong shelf selections rotate urgency and break the streak", () => {
  const rush = createRush({ rowCount: 3 });
  const initial = rush.start(0);
  const expected = initial.activeRowIndex;
  const wrong = (expected + 1) % 3;
  const result = rush.selectRow(wrong, 500);

  assert.equal(result.correct, false);
  assert.equal(result.snapshot.mistakes, 1);
  assert.equal(result.snapshot.currentStreak, 0);
  assert.notEqual(result.snapshot.activeRowIndex, expected);
  assert.deepEqual(result.snapshot.filledRowIndexes, []);
  assert.deepEqual(result.snapshot.rowItemCounts, [0, 0, 0]);
});

test("Fast correct item placement builds streak and awards a gold rush grade", () => {
  const rush = createRush({ rowCount: 4 });
  let now = 0;
  rush.start(now);

  while (!rush.snapshot(now).complete) {
    now += 700;
    const active = rush.snapshot(now).activeRowIndex;
    const result = rush.selectRow(active, now);
    assert.equal(result.correct, true);
  }

  const completed = rush.snapshot(now);
  assert.equal(completed.complete, true);
  assert.equal(completed.totalItemsStocked, 12);
  assert.equal(completed.bestStreak, 12);
  assert.equal(completed.mistakes, 0);
  assert.equal(completed.grade, "GOLD");
});

test("Expired targets cost a mistake and move the player to a new shelf", () => {
  const rush = createRush({ rowCount: 3, targetDurationMs: 1000, minimumTargetDurationMs: 700 });
  const started = rush.start(0);
  const expired = started.activeRowIndex;
  const tick = rush.tick(1001);

  assert.equal(tick.event, "timeout");
  assert.equal(tick.snapshot.mistakes, 1);
  assert.equal(tick.snapshot.currentStreak, 0);
  assert.notEqual(tick.snapshot.activeRowIndex, expired);
});

test("A browser frame stall does not consume the player's active rush window", () => {
  const rush = createRush({ rowCount: 3, targetDurationMs: 1000, minimumTargetDurationMs: 700 });
  rush.start(0);
  rush.tick(16);
  const target = rush.snapshot(16).activeRowIndex;

  const afterStall = rush.tick(5016);
  assert.equal(afterStall.event, "none");
  assert.equal(afterStall.snapshot.mistakes, 0);
  assert.ok(afterStall.snapshot.remainingMs >= 700);

  const selection = rush.selectRow(target, 5020);
  assert.equal(selection.correct, true);
  assert.equal(selection.stockedItemCount, 1);
  assert.equal(selection.rowCompleted, false);
  assert.equal(selection.snapshot.mistakes, 0);
});
