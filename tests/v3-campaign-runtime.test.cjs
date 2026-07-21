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

test("Main campaign contains all configured shifts in one ordered sequence", () => {
  assert.deepEqual(validateCampaignRuntime(campaign), []);
  assert.deepEqual(
    campaign.shifts.map((entry) => entry.shift.id),
    [
      "starter-shift-001",
      "starter-shift-002",
      "starter-shift-003",
      "starter-shift-004"
    ]
  );
  assert.deepEqual(
    campaign.shifts.map((entry) => entry.dayLabel),
    ["DAY 1", "DAY 2", "DAY 3", "DAY 4"]
  );
});

test("Every campaign shift shares the same store and project systems", () => {
  const shifts = campaign.shifts.map((entry) => resolveCampaignShift(campaign, entry.shift.id));
  assert.deepEqual(new Set(shifts.map((entry) => entry.store.id)), new Set(["starter-market"]));
  shifts.forEach((entry, index) => {
    assert.equal(entry.previousShiftId, campaign.shifts[index - 1]?.shift.id);
    assert.equal(entry.nextShiftId, campaign.shifts[index + 1]?.shift.id);
  });
});

test("A shift composes missions without creating a separate architecture", () => {
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

test("Campaign selector defaults to the first shift and accepts configured IDs", () => {
  assert.equal(selectCampaignShift(campaign).shift.id, "starter-shift-001");
  assert.equal(
    selectCampaignShift(campaign, "starter-shift-004").shift.id,
    "starter-shift-004"
  );
  assert.throws(
    () => selectCampaignShift(campaign, "isolated-day-two"),
    /does not belong to campaign/
  );
});
