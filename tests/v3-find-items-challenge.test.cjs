const test = require("node:test");
const assert = require("node:assert/strict");

const {
  FindItemsChallengeController
} = require("../.test-dist/src/game/application/FindItemsChallengeController.js");

const createChallenge = (overrides = {}) => new FindItemsChallengeController({
  productIds: ["milk-bottle", "apple", "cereal-box"],
  timeLimitSeconds: 60,
  mistakePenaltySeconds: 5,
  ...overrides
});

test("Order hunt tracks requested products independently from presentation", () => {
  const challenge = createChallenge();

  assert.equal(challenge.selectProduct("apple").accepted, true);
  assert.equal(challenge.selectProduct("milk-bottle").accepted, true);
  const completed = challenge.selectProduct("cereal-box");

  assert.equal(completed.accepted, true);
  assert.equal(completed.snapshot.status, "complete");
  assert.deepEqual(completed.snapshot.collectedProductIds, [
    "milk-bottle",
    "apple",
    "cereal-box"
  ]);
  assert.deepEqual(completed.snapshot.remainingProductIds, []);
});

test("Priority order rejects a requested product when it is selected out of sequence", () => {
  const challenge = createChallenge({
    productIds: ["cereal-box", "milk-bottle", "apple"],
    selectionMode: "sequence",
    timeLimitSeconds: 40,
    mistakePenaltySeconds: 7
  });

  assert.equal(challenge.snapshot().nextRequiredProductId, "cereal-box");
  const earlyMilk = challenge.selectProduct("milk-bottle");
  assert.equal(earlyMilk.accepted, false);
  assert.equal(earlyMilk.reason, "out-of-order");
  assert.equal(earlyMilk.snapshot.mistakes, 1);
  assert.equal(earlyMilk.snapshot.remainingSeconds, 33);
  assert.equal(earlyMilk.snapshot.nextRequiredProductId, "cereal-box");
  assert.deepEqual(earlyMilk.snapshot.collectedProductIds, []);

  assert.equal(challenge.selectProduct("cereal-box").accepted, true);
  assert.equal(challenge.snapshot().nextRequiredProductId, "milk-bottle");
  assert.equal(challenge.selectProduct("milk-bottle").accepted, true);
  const completed = challenge.selectProduct("apple");
  assert.equal(completed.accepted, true);
  assert.equal(completed.snapshot.status, "complete");
  assert.equal(completed.snapshot.nextRequiredProductId, undefined);
  assert.deepEqual(completed.snapshot.collectedProductIds, ["cereal-box", "milk-bottle", "apple"]);
});

test("Wrong shelf choices consume configured time without advancing the order", () => {
  const challenge = createChallenge();
  const afterMistake = challenge.recordMistake();

  assert.equal(afterMistake.status, "active");
  assert.equal(afterMistake.remainingSeconds, 55);
  assert.equal(afterMistake.mistakes, 1);
  assert.deepEqual(afterMistake.collectedProductIds, []);
});

test("The order expires when countdown or penalties exhaust the available time", () => {
  const countdown = createChallenge({ timeLimitSeconds: 2 });
  assert.equal(countdown.tick(1999).status, "active");
  assert.equal(countdown.tick(1).status, "failed");

  const penalty = createChallenge({ timeLimitSeconds: 4, mistakePenaltySeconds: 5 });
  assert.equal(penalty.recordMistake().status, "failed");
  assert.equal(penalty.snapshot().remainingSeconds, 0);
});

test("Duplicate and unrequested products are rejected and penalized", () => {
  const challenge = createChallenge();
  assert.equal(challenge.selectProduct("milk-bottle").accepted, true);

  const duplicate = challenge.selectProduct("milk-bottle");
  assert.equal(duplicate.accepted, false);
  assert.equal(duplicate.reason, "already-collected");
  assert.equal(duplicate.snapshot.mistakes, 1);

  const unknown = challenge.selectProduct("dish-soap");
  assert.equal(unknown.accepted, false);
  assert.equal(unknown.reason, "not-requested");
  assert.equal(unknown.snapshot.mistakes, 2);
  assert.equal(unknown.snapshot.remainingSeconds, 50);
});
