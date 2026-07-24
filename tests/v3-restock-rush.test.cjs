const test = require("node:test");
const assert = require("node:assert/strict");

const {
  RestockRushController
} = require("../.test-dist/src/game/application/RestockRushController.js");

const createRush = (overrides = {}) => new RestockRushController({
  rowCount: 6,
  randomSeed: "rush-test-seed",
  targetDurationMs: 3000,
  minimumTargetDurationMs: 1200,
  speedUpPerSuccessMs: 200,
  streakWindowMs: 1800,
  goldTimeMs: 12000,
  silverTimeMs: 20000,
  ...overrides
});

test("Restock rush produces a deterministic target order from level seed", () => {
  const first = createRush();
  const second = createRush();
  let now = 0;

  first.start(now);
  second.start(now);
  const firstOrder = [];
  const secondOrder = [];

  while (!first.snapshot(now).complete) {
    const firstTarget = first.snapshot(now).activeRowIndex;
    const secondTarget = second.snapshot(now).activeRowIndex;
    firstOrder.push(firstTarget);
    secondOrder.push(secondTarget);
    now += 500;
    first.selectRow(firstTarget, now);
    second.selectRow(secondTarget, now);
  }

  assert.deepEqual(firstOrder, secondOrder);
  assert.equal(new Set(firstOrder).size, 6);
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
});

test("Fast correct play builds streak and awards a gold rush grade", () => {
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
  assert.equal(completed.bestStreak, 4);
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
  assert.equal(selection.snapshot.mistakes, 0);
});
