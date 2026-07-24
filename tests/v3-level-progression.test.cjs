const test = require("node:test");
const assert = require("node:assert/strict");

const {
  resolveLevelProgression
} = require("../.test-dist/src/game/application/LevelProgression.js");
const {
  createLevelNavigationUrl
} = require("../.test-dist/src/game/infrastructure/browser/BrowserLevelNavigator.js");
const {
  resolveLevelProgressionPreview
} = require("../.test-dist/src/game/presentation/ui/LevelProgressionPreview.js");

const previewLevels = Object.freeze([
  {
    level: { id: "starter-level-001", title: "First Delivery", mode: "restock" },
    nextLevelId: "starter-level-002",
    levelNumber: 1
  },
  {
    level: { id: "starter-level-002", title: "Checkout Rush", mode: "checkout" },
    nextLevelId: undefined,
    levelNumber: 2
  }
]);

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

test("Completion previews advertise the configured next gameplay mode", () => {
  assert.deepEqual(
    resolveLevelProgressionPreview("starter-level-001", previewLevels),
    {
      eyebrow: "UP NEXT",
      title: "Checkout Rush",
      modeLabel: "CHECKOUT",
      description: "Open the lane, serve the queue, and keep every customer moving.",
      currentLevelNumber: 1,
      totalLevels: 2
    }
  );
});

test("The final completion preview motivates a stronger replay", () => {
  assert.deepEqual(
    resolveLevelProgressionPreview("starter-level-002", previewLevels),
    {
      eyebrow: "CAMPAIGN MASTERED",
      title: "Build a stronger week",
      modeLabel: "REPLAY",
      description: "Restart from Day 1, use what you learned, and beat your best pace.",
      currentLevelNumber: 2,
      totalLevels: 2
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
