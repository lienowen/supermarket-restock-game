const test = require("node:test");
const assert = require("node:assert/strict");

const {
  CampaignSession,
  validateCampaignSessionSnapshot
} = require("../.test-dist/src/game/application/CampaignSession.js");

class MemoryStore {
  constructor() {
    this.values = new Map();
  }

  load(campaignId) {
    return this.values.get(campaignId);
  }

  save(snapshot) {
    this.values.set(snapshot.campaignId, snapshot);
  }

  clear(campaignId) {
    this.values.delete(campaignId);
  }
}

const createSession = () => new CampaignSession(
  {
    campaignId: "main-campaign",
    firstLevelId: "starter-level-001",
    defaultEconomy: { coins: 100, stars: 0, reputation: 0 }
  },
  new MemoryStore()
);

test("A fresh direct level entry uses that level's configured fallback coins", () => {
  const session = createSession();
  assert.deepEqual(session.initialEconomyFor("starter-level-002", 200), {
    coins: 200,
    stars: 0,
    reputation: 0
  });
});

test("Completing a level carries actual economy into the configured next level", () => {
  const session = createSession();
  const saved = session.completeLevel(
    "starter-level-001",
    "starter-level-002",
    { coins: 200, stars: 1, reputation: 0 }
  );

  assert.deepEqual(validateCampaignSessionSnapshot(saved, "main-campaign"), []);
  assert.deepEqual(session.initialEconomyFor("starter-level-002", 999), {
    coins: 200,
    stars: 1,
    reputation: 0
  });

  session.completeLevel(
    "starter-level-002",
    "starter-level-003",
    { coins: 320, stars: 2, reputation: 0 }
  );
  assert.deepEqual(session.initialEconomyFor("starter-level-003", 999), {
    coins: 320,
    stars: 2,
    reputation: 0
  });
});

test("Checkout completion stores reputation and final replay resets the campaign", () => {
  const session = createSession();
  session.completeLevel(
    "starter-level-003",
    undefined,
    { coins: 400, stars: 3, reputation: 5 }
  );
  assert.deepEqual(session.initialEconomyFor("starter-level-003", 0), {
    coins: 400,
    stars: 3,
    reputation: 5
  });

  const reset = session.reset();
  assert.equal(reset.currentLevelId, "starter-level-001");
  assert.deepEqual(reset.completedLevelIds, []);
  assert.deepEqual(session.initialEconomyFor("starter-level-001", 999), {
    coins: 100,
    stars: 0,
    reputation: 0
  });
});
