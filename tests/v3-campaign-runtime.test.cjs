const test = require("node:test");
const assert = require("node:assert/strict");

const {
  STARTER_MARKET_CONTENT
} = require("../.test-dist/src/game/content/starterMarket.js");
const {
  resolveCampaignRuntime,
  resolveCampaignShift,
  selectCampaignShift,
  validateCampaignRuntime
} = require("../.test-dist/src/game/application/CampaignRuntime.js");

const campaign = resolveCampaignRuntime(STARTER_MARKET_CONTENT, "main-campaign");

test("Main campaign contains Day 1 and Day 2 in one ordered sequence", () => {
  assert.deepEqual(validateCampaignRuntime(campaign), []);
  assert.deepEqual(
    campaign.shifts.map((entry) => entry.shift.id),
    ["starter-shift-001", "starter-shift-002"]
  );
  assert.deepEqual(
    campaign.shifts.map((entry) => entry.dayLabel),
    ["DAY 1", "DAY 2"]
  );
});

test("Day 1 and Day 2 share the same store and project systems", () => {
  const dayOne = resolveCampaignShift(campaign, "starter-shift-001");
  const dayTwo = resolveCampaignShift(campaign, "starter-shift-002");

  assert.equal(dayOne.store.id, "starter-market");
  assert.equal(dayTwo.store.id, dayOne.store.id);
  assert.equal(dayOne.nextShiftId, dayTwo.shift.id);
  assert.equal(dayTwo.previousShiftId, dayOne.shift.id);
});

test("Day 2 is content composition, not a separate architecture", () => {
  const dayTwo = resolveCampaignShift(campaign, "starter-shift-002");

  assert.deepEqual(dayTwo.shift.missionIds, [
    "restock-water-promotion",
    "assist-checkout-rush"
  ]);
  assert.deepEqual(
    dayTwo.missions.map((mission) => mission.objectives[0].type),
    ["transfer-product", "operate-checkout"]
  );
});

test("Campaign selector defaults to Day 1 and can select Day 2 by shift ID", () => {
  assert.equal(selectCampaignShift(campaign).shift.id, "starter-shift-001");
  assert.equal(
    selectCampaignShift(campaign, "starter-shift-002").shift.id,
    "starter-shift-002"
  );
  assert.throws(
    () => selectCampaignShift(campaign, "isolated-day-two"),
    /does not belong to campaign/
  );
});
