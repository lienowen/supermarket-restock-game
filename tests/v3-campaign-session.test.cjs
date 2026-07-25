const test = require("node:test");
const assert = require("node:assert/strict");

const {
  CampaignSession,
  migrateCampaignSessionSnapshot,
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
  assert.deepEqual(session.upgrades(), { movement: 0, service: 0, profit: 0 });
});

test("Completing a level carries actual economy into the configured next level", () => {
  const session = createSession();
  const saved = session.completeLevel(
    "starter-level-001",
    "starter-level-002",
    { coins: 200, stars: 1, reputation: 0 }
  );

  assert.equal(saved.version, 2);
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

test("Purchased upgrades spend coins and change real gameplay values", () => {
  const session = createSession();
  session.completeLevel(
    "starter-level-001",
    "starter-level-002",
    { coins: 500, stars: 1, reputation: 0 }
  );

  assert.equal(session.purchaseUpgrade("movement").purchased, true);
  assert.equal(session.purchaseUpgrade("service").purchased, true);
  assert.equal(session.purchaseUpgrade("profit").purchased, true);
  assert.deepEqual(session.upgrades(), { movement: 1, service: 1, profit: 1 });
  assert.equal(session.snapshot().coins, 80);
  assert.equal(session.movementSpeed(500), 540);
  assert.equal(session.serviceDuration(1000), 900);
  assert.deepEqual(
    session.completionEconomy(
      { coins: 80, stars: 1, reputation: 0 },
      { coins: 180, stars: 2, reputation: 3 }
    ),
    { coins: 190, stars: 2, reputation: 3 }
  );
});

test("Campaign replay keeps store growth while a hard reset clears it", () => {
  const session = createSession();
  session.completeLevel(
    "starter-level-005",
    undefined,
    { coins: 300, stars: 5, reputation: 10 }
  );
  session.purchaseUpgrade("movement");

  const replay = session.reset();
  assert.equal(replay.currentLevelId, "starter-level-001");
  assert.deepEqual(replay.completedLevelIds, []);
  assert.deepEqual(replay.upgrades, { movement: 1, service: 0, profit: 0 });
  assert.equal(replay.coins, 180);

  const hardReset = session.reset({ preserveMetaProgress: false });
  assert.equal(hardReset.currentLevelId, "starter-level-001");
  assert.deepEqual(hardReset.completedLevelIds, []);
  assert.deepEqual(hardReset.upgrades, { movement: 0, service: 0, profit: 0 });
  assert.deepEqual(session.initialEconomyFor("starter-level-001", 999), {
    coins: 100,
    stars: 0,
    reputation: 0
  });
});

test("Version 1 saves migrate without losing economy or campaign position", () => {
  const migrated = migrateCampaignSessionSnapshot({
    version: 1,
    campaignId: "main-campaign",
    currentLevelId: "starter-level-003",
    completedLevelIds: ["starter-level-001", "starter-level-002"],
    coins: 320,
    stars: 2,
    reputation: 4
  }, "main-campaign");

  assert.ok(migrated);
  assert.equal(migrated.version, 2);
  assert.equal(migrated.currentLevelId, "starter-level-003");
  assert.equal(migrated.coins, 320);
  assert.deepEqual(migrated.completedLevelIds, ["starter-level-001", "starter-level-002"]);
  assert.deepEqual(migrated.upgrades, { movement: 0, service: 0, profit: 0 });
  assert.deepEqual(validateCampaignSessionSnapshot(migrated, "main-campaign"), []);
});
