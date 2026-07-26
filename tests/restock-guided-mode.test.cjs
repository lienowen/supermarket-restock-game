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

test("Timed shuffled restock still rotates an expired target", () => {
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
