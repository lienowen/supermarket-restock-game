const test = require("node:test");
const assert = require("node:assert/strict");

const {
  RestockRushController
} = require("../.test-dist/src/game/application/RestockRushController.js");

test("Guided restock keeps a fixed shelf order and never times out", () => {
  const controller = new RestockRushController({
    rowCount: 4,
    randomSeed: "guided-test",
    sequenceMode: "fixed",
    timeoutEnabled: false,
    targetDurationMs: 1000,
    minimumTargetDurationMs: 500,
    speedUpPerSuccessMs: 100,
    streakWindowMs: 2000,
    goldTimeMs: 10000,
    silverTimeMs: 20000
  });

  assert.deepEqual(controller.plannedRowIndexes(), [0, 1, 2, 3]);
  assert.equal(controller.start(0).activeRowIndex, 0);
  const afterWait = controller.tick(60000);
  assert.equal(afterWait.event, "none");
  assert.equal(afterWait.snapshot.activeRowIndex, 0);
  assert.equal(afterWait.snapshot.mistakes, 0);
  assert.equal(afterWait.snapshot.remainingRatio, 1);

  const wrong = controller.selectRow(2, 60100);
  assert.equal(wrong.correct, false);
  assert.equal(wrong.expectedRowIndex, 0);
  assert.equal(wrong.snapshot.activeRowIndex, 0);
  assert.equal(wrong.snapshot.mistakes, 1);

  for (let index = 0; index < 4; index += 1) {
    const result = controller.selectRow(index, 60200 + index * 100);
    assert.equal(result.correct, true);
    assert.equal(result.selectedRowIndex, index);
  }

  const complete = controller.snapshot(61000);
  assert.equal(complete.complete, true);
  assert.deepEqual(complete.filledRowIndexes, [0, 1, 2, 3]);
});

test("Memory restock exposes a reproducible pattern and does not change the answer on failure", () => {
  const controller = new RestockRushController({
    rowCount: 6,
    randomSeed: "memory-test",
    sequenceMode: "shuffled",
    timeoutEnabled: true,
    keepTargetOnFailure: true,
    targetDurationMs: 1000,
    minimumTargetDurationMs: 500,
    speedUpPerSuccessMs: 100,
    streakWindowMs: 2000,
    goldTimeMs: 10000,
    silverTimeMs: 20000
  });
  const matchingController = new RestockRushController({
    rowCount: 6,
    randomSeed: "memory-test",
    sequenceMode: "shuffled",
    timeoutEnabled: true,
    keepTargetOnFailure: true,
    targetDurationMs: 1000,
    minimumTargetDurationMs: 500,
    speedUpPerSuccessMs: 100,
    streakWindowMs: 2000,
    goldTimeMs: 10000,
    silverTimeMs: 20000
  });

  const pattern = controller.plannedRowIndexes();
  assert.equal(pattern.length, 6);
  assert.equal(new Set(pattern).size, 6);
  assert.deepEqual(pattern, matchingController.plannedRowIndexes());

  const firstTarget = controller.start(0).activeRowIndex;
  const wrongRow = (firstTarget + 1) % 6;
  const wrong = controller.selectRow(wrongRow, 100);
  assert.equal(wrong.correct, false);
  assert.equal(wrong.snapshot.activeRowIndex, firstTarget);

  const timeout = controller.tick(1200);
  assert.equal(timeout.event, "timeout");
  assert.equal(timeout.snapshot.activeRowIndex, firstTarget);
});

test("Timed shuffled restock still rotates an expired target when no memory contract is enabled", () => {
  const controller = new RestockRushController({
    rowCount: 4,
    randomSeed: "rush-test",
    sequenceMode: "shuffled",
    timeoutEnabled: true,
    targetDurationMs: 1000,
    minimumTargetDurationMs: 500,
    speedUpPerSuccessMs: 100,
    streakWindowMs: 2000,
    goldTimeMs: 10000,
    silverTimeMs: 20000
  });

  const first = controller.start(0);
  const expired = controller.tick(1100);
  assert.equal(expired.event, "timeout");
  assert.equal(expired.snapshot.mistakes, 1);
  assert.notEqual(expired.snapshot.activeRowIndex, first.activeRowIndex);
});
