const test = require("node:test");
const assert = require("node:assert/strict");

const {
  ShiftClockController,
  formatShiftTime
} = require("../.test-dist/src/game/application/ShiftClockController.js");

test("Day 1 shift clock starts at two minutes", () => {
  const clock = new ShiftClockController({ durationSeconds: 120 });
  const snapshot = clock.snapshot();

  assert.equal(snapshot.status, "running");
  assert.equal(snapshot.durationMs, 120000);
  assert.equal(snapshot.remainingSeconds, 120);
  assert.equal(snapshot.formattedTime, "02:00");
  assert.equal(snapshot.remainingRatio, 1);
});

test("Shift clock counts down using active gameplay time", () => {
  const clock = new ShiftClockController({
    durationSeconds: 120,
    maxActiveStepMs: 1000
  });

  const result = clock.tick(1000);
  assert.equal(result.event, "none");
  assert.equal(result.snapshot.remainingMs, 119000);
  assert.equal(result.snapshot.remainingSeconds, 119);
  assert.equal(result.snapshot.formattedTime, "01:59");
});

test("Large frame gaps cannot consume the whole shift", () => {
  const clock = new ShiftClockController({ durationSeconds: 120 });

  const result = clock.tick(10000);
  assert.equal(result.snapshot.remainingMs, 119750);
  assert.equal(result.snapshot.remainingSeconds, 120);
});

test("Expiry is emitted exactly once and time clamps at zero", () => {
  const clock = new ShiftClockController({
    durationSeconds: 1,
    maxActiveStepMs: 1000
  });

  const first = clock.tick(1000);
  const second = clock.tick(1000);

  assert.equal(first.event, "expired");
  assert.equal(first.snapshot.status, "expired");
  assert.equal(first.snapshot.remainingMs, 0);
  assert.equal(first.snapshot.formattedTime, "00:00");
  assert.equal(second.event, "none");
  assert.equal(second.snapshot.status, "expired");
});

test("Completing a shift freezes its remaining time", () => {
  const clock = new ShiftClockController({
    durationSeconds: 120,
    maxActiveStepMs: 1000
  });
  clock.tick(1000);
  const completed = clock.complete();
  const after = clock.tick(1000);

  assert.equal(completed.status, "completed");
  assert.equal(after.event, "none");
  assert.equal(after.snapshot.remainingMs, 119000);
});

test("Shift time formatter produces a stable minute and second label", () => {
  assert.equal(formatShiftTime(0), "00:00");
  assert.equal(formatShiftTime(9), "00:09");
  assert.equal(formatShiftTime(65), "01:05");
  assert.throws(() => formatShiftTime(-1), /zero or greater/);
});
