const test = require("node:test");
const assert = require("node:assert/strict");

const {
  resolveLevelProgression
} = require("../.test-dist/src/game/application/LevelProgression.js");
const {
  createLevelNavigationUrl
} = require("../.test-dist/src/game/infrastructure/browser/BrowserLevelNavigator.js");
const {
  resolveCampaignProgressionPreview
} = require("../.test-dist/src/game/presentation/ui/CampaignProgressionPreview.js");

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

test("Completion previews promise the actual configured next task", () => {
  assert.deepEqual(resolveCampaignProgressionPreview("starter-level-002"), {
    eyebrow: "UP NEXT · LEVEL 3",
    title: "CHECKOUT RUSH",
    detail: "CHECKOUT RUSH · SERVE THE CUSTOMER QUEUE",
    isCampaignComplete: false,
    currentLevelNumber: 2,
    totalLevels: 5
  });

  assert.deepEqual(resolveCampaignProgressionPreview("starter-level-004"), {
    eyebrow: "UP NEXT · LEVEL 5",
    title: "ORDER HUNT",
    detail: "ORDER HUNT · FIND ITEMS FOR THE ORDER",
    isCampaignComplete: false,
    currentLevelNumber: 4,
    totalLevels: 5
  });
});

test("The final completion preview closes the campaign loop", () => {
  assert.deepEqual(resolveCampaignProgressionPreview("starter-level-005"), {
    eyebrow: "CAMPAIGN COMPLETE",
    title: "THE STORE IS RUNNING",
    detail: "PLAY AGAIN TO BUILD A FASTER, CLEANER SHIFT",
    isCampaignComplete: true,
    currentLevelNumber: 5,
    totalLevels: 5
  });
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
