const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");

const read = (path) => readFileSync(resolve(path), "utf8");

const ordinaryCleaning = read("src/game/presentation/cleaning/CleaningTaskView.ts");
const closingSafety = read("src/game/presentation/cleaning/ClosingSafetyCleaningTaskView.ts");
const navigation = read("src/game/presentation/actors/PlayerNavigationView.ts");
const entrypoint = read("src/main.ts");

test("ordinary cleaning does not depend on closing-safety state", () => {
  assert.equal(ordinaryCleaning.includes("ClosingSafetyCleaningTaskView"), false);
  assert.equal(ordinaryCleaning.includes("ClosingSafetyRoute"), false);
  assert.equal(ordinaryCleaning.includes("warningRequiredSpillIndexes"), false);
  assert.equal(ordinaryCleaning.includes("awaitingSignRecovery"), false);
});

test("closing-safety cleaning does not depend on ordinary cleaning implementation", () => {
  assert.equal(closingSafety.includes("from \"./CleaningTaskView\""), false);
  assert.equal(closingSafety.includes("new CleaningTaskView"), false);
});

test("cleaning views never branch on concrete level ids", () => {
  assert.doesNotMatch(ordinaryCleaning, /starter-level-\d+/);
  assert.doesNotMatch(closingSafety, /starter-level-\d+/);
});

test("guided movement stability lives in PlayerNavigationView, not a global monkey patch", () => {
  assert.match(navigation, /this\.activeDestination/);
  assert.match(navigation, /Math\.hypot\(this\.activeDestination\.x - point\.x/);
  assert.equal(entrypoint.includes("installStableDestinationMovement"), false);
  assert.equal(entrypoint.includes("prototype.setDestination"), false);
});
