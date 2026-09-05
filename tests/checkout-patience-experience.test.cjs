const test = require("node:test");
const assert = require("node:assert/strict");

const {
  CHECKOUT_PATIENCE_EXPERIENCE_SPECS,
  resolveCheckoutPatienceExperienceSpec,
  validateCheckoutPatienceExperienceSpecs
} = require("../.test-dist/src/game/content/experience/CheckoutPatienceExperienceSpec.js");
const {
  STARTER_MARKET_LEVELS
} = require("../.test-dist/src/game/content/levels/starterMarketLevels.js");

test("Evening checkout owns eight patience and produce-weight decisions", () => {
  assert.equal(CHECKOUT_PATIENCE_EXPERIENCE_SPECS.length, 1);
  assert.deepEqual(validateCheckoutPatienceExperienceSpecs(STARTER_MARKET_LEVELS), []);

  const level = STARTER_MARKET_LEVELS.find((entry) => entry.id === "starter-level-007");
  assert.ok(level);
  const spec = resolveCheckoutPatienceExperienceSpec(level);
  assert.ok(spec);
  assert.equal(spec.customerCount, 8);
  assert.equal(spec.targetWeightsKg.length, 8);
  assert.deepEqual(spec.weightChoicesKg, [0.5, 1, 1.5]);
});

test("Wrong produce weight has a meaningful patience penalty", () => {
  const spec = CHECKOUT_PATIENCE_EXPERIENCE_SPECS[0];
  assert.equal(spec.patienceDurationMs, 28000);
  assert.equal(spec.wrongWeightPenaltyMs, 3000);
  assert.ok(spec.wrongWeightPenaltyMs < spec.patienceDurationMs);
  assert.equal(new Set(spec.standardProductAssetKeys).size, 5);
  assert.equal(spec.weighedProductAssetKey, "product-apple");
  assert.ok(spec.targetWeightsKg.every((weight) => spec.weightChoicesKg.includes(weight)));
});

test("L7 mixes regular, rushed and genuinely larger customer orders", () => {
  const spec = CHECKOUT_PATIENCE_EXPERIENCE_SPECS[0];
  assert.deepEqual(new Set(spec.customerProfiles.map((profile) => profile.type)), new Set([
    "regular",
    "rushed",
    "large-order"
  ]));
  assert.ok(spec.customerProfiles.filter((profile) => profile.type === "rushed").every((profile) => (
    profile.patienceDurationMs < spec.patienceDurationMs && profile.mistakePenaltyMultiplier > 1
  )));
  assert.ok(spec.customerProfiles.some((profile) => profile.type === "large-order" && profile.itemCount >= 4));
});

test("L7 exposes speed, accuracy and satisfaction scoring", () => {
  const source = require("node:fs").readFileSync(
    "src/game/presentation/ui/CheckoutPatienceDom.ts",
    "utf8"
  );
  assert.match(source, /SPEED/);
  assert.match(source, /ACCURACY/);
  assert.match(source, /SATISFACTION/);
  assert.match(source, /checkoutRushSpeed/);
});

test("L7 transitions between scanned products instead of replacing the image instantly", () => {
  const source = require("node:fs").readFileSync(
    "src/game/presentation/ui/CheckoutPatienceDom.ts",
    "utf8"
  );
  assert.match(source, /itemTransitioning/);
  assert.match(source, /loading the next product/);
  assert.match(source, /opacity 150ms ease/);
});

test("L7 payment is a single explicit READY -> controller transition", () => {
  const dom = require("node:fs").readFileSync(
    "src/game/presentation/ui/CheckoutPatienceDom.ts",
    "utf8"
  );
  const scene = require("node:fs").readFileSync(
    "src/game/presentation/scenes/CheckoutMarketScene.ts",
    "utf8"
  );
  assert.match(dom, /checkoutPatienceFlow = "ready"/);
  assert.match(dom, /confirmPatiencePayment/);
  assert.doesNotMatch(dom, /action\.emit\("pointerdown"\)/);
  assert.match(scene, /confirmPatiencePayment\(\): boolean/);
  assert.match(scene, /if \(lockDuration > 0\) this\.interactionGate\.lockFor\(lockDuration\)/);
});
