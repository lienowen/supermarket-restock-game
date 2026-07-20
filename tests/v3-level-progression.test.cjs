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
    resolveLevelProgression(
      "starter-level-001",
      "starter-level-002",
      "starter-level-001"
    ),
    {
      kind: "next-level",
      targetLevelId: "starter-level-002",
      actionLabel: "NEXT LEVEL",
      statusLabel: "LEVEL COMPLETE"
    }
  );
});

test("The final level restarts the campaign from Level 1", () => {
  assert.deepEqual(
    resolveLevelProgression(
      "starter-level-003",
      undefined,
      "starter-level-001"
    ),
    {
      kind: "replay-campaign",
      targetLevelId: "starter-level-001",
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
