const test = require("node:test");
const assert = require("node:assert/strict");

const {
  resolveLevelProgression
} = require("../.test-dist/src/game/application/LevelProgression.js");
const {
  createLevelNavigationUrl
} = require("../.test-dist/src/game/infrastructure/browser/BrowserLevelNavigator.js");

test("Completed levels continue to the configured next level", () => {
  assert.deepEqual(
    resolveLevelProgression("starter-level-001", "starter-level-002"),
    {
      kind: "next-level",
      targetLevelId: "starter-level-002",
      actionLabel: "NEXT LEVEL",
      statusLabel: "LEVEL COMPLETE"
    }
  );
});

test("The final level can be replayed without special scene code", () => {
  assert.deepEqual(
    resolveLevelProgression("starter-level-002"),
    {
      kind: "replay-level",
      targetLevelId: "starter-level-002",
      actionLabel: "PLAY AGAIN",
      statusLabel: "CAMPAIGN COMPLETE"
    }
  );
});

test("Browser navigation writes the canonical level query and removes legacy shift selection", () => {
  assert.equal(
    createLevelNavigationUrl(
      "https://example.com/game?shift=starter-shift-001&test=1",
      "starter-level-002"
    ),
    "https://example.com/game?test=1&level=starter-level-002"
  );
});
