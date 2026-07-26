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
      "starter-level-006",
      "starter-level-007",
      "starter-level-001"
    ),
    {
      kind: "next-level",
      targetLevelId: "starter-level-007",
      actionLabel: "NEXT LEVEL",
      statusLabel: "LEVEL COMPLETE"
    }
  );
});

test("The final level restarts the campaign from Level 1", () => {
  assert.deepEqual(
    resolveLevelProgression(
      "starter-level-010",
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
    detail: "CHECKOUT RUSH · PROCESS THE CHECKOUT QUEUE",
    isCampaignComplete: false,
    currentLevelNumber: 2,
    totalLevels: 10
  });

  assert.deepEqual(resolveCampaignProgressionPreview("starter-level-005"), {
    eyebrow: "UP NEXT · LEVEL 6",
    title: "CLOSING STOCK SPRINT",
    detail: "CLOSING STOCK SPRINT · FINISH THE COLA COOLER",
    isCampaignComplete: false,
    currentLevelNumber: 5,
    totalLevels: 10
  });

  assert.deepEqual(resolveCampaignProgressionPreview("starter-level-009"), {
    eyebrow: "UP NEXT · LEVEL 10",
    title: "FINAL COOLER RUSH",
    detail: "FINAL COOLER RUSH · COMPLETE THE FINAL COOLER RUSH",
    isCampaignComplete: false,
    currentLevelNumber: 9,
    totalLevels: 10
  });
});

test("The final completion preview closes the ten-level campaign loop", () => {
  assert.deepEqual(resolveCampaignProgressionPreview("starter-level-010"), {
    eyebrow: "CAMPAIGN COMPLETE",
    title: "THE STORE IS RUNNING",
    detail: "PLAY AGAIN TO BUILD A FASTER, CLEANER SHIFT",
    isCampaignComplete: true,
    currentLevelNumber: 10,
    totalLevels: 10
  });
});

test("Browser navigation writes the canonical level query and removes legacy shift selection", () => {
  assert.equal(
    createLevelNavigationUrl(
      "https://example.com/game?shift=starter-shift-009&test=1",
      "starter-level-010"
    ),
    "https://example.com/game?test=1&level=starter-level-010"
  );
});
