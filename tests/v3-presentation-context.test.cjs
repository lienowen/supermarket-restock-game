const test = require("node:test");
const assert = require("node:assert/strict");

const {
  resolveGlobalAssetPack
} = require("../.test-dist/src/game/assets/GlobalAssetPackRegistry.js");
const {
  STARTER_MARKET_PRESENTATION,
  MAIN_LEVEL_CAMPAIGN_RUNTIME,
  createStarterMarketPresentationContext,
  validateStarterMarketPresentationContext
} = require("../.test-dist/src/game/presentation/context/StarterMarketPresentationContext.js");
const {
  CheckoutTargetResolver
} = require("../.test-dist/src/game/presentation/interactions/CheckoutTargetResolver.js");
const {
  RestockTargetResolver
} = require("../.test-dist/src/game/presentation/interactions/RestockTargetResolver.js");
const {
  STARTER_MARKET_LAYOUT
} = require("../.test-dist/src/game/world/starterMarketLayout.js");

const snapshot = (step, stockedRows = 0) => ({
  step,
  stockedRows,
  totalRows: 6,
  boxCollected: step !== "collect",
  boxLoaded: ["push", "park", "open", "restock", "complete"].includes(step),
  cartAtCooler: ["open", "restock", "complete"].includes(step),
  boxOpened: ["restock", "complete"].includes(step),
  coins: 100,
  stars: 0
});

const resolver = new RestockTargetResolver({
  backroomBox: STARTER_MARKET_PRESENTATION.world.backroomBox,
  cartStart: STARTER_MARKET_PRESENTATION.world.cartStart,
  cartDestination: STARTER_MARKET_PRESENTATION.world.cartCooler,
  coolerCentreX: STARTER_MARKET_PRESENTATION.visual.cooler.centre.x,
  coolerRowYs: STARTER_MARKET_PRESENTATION.visual.cooler.rowYs,
  coolerTargetWidth: STARTER_MARKET_PRESENTATION.visual.cooler.activeStockBounds.width
});

const contextForMode = (mode) => {
  const entry = MAIN_LEVEL_CAMPAIGN_RUNTIME.levels.find((level) => level.level.mode === mode);
  assert.ok(entry, `Missing configured ${mode} level`);
  return createStarterMarketPresentationContext(entry.level.id);
};

test("Every configured level presentation context is internally consistent", () => {
  const contexts = MAIN_LEVEL_CAMPAIGN_RUNTIME.levels.map((entry) => (
    createStarterMarketPresentationContext(entry.level.id)
  ));

  contexts.forEach((context) => (
    assert.deepEqual(validateStarterMarketPresentationContext(context), [])
  ));
  assert.deepEqual(
    contexts.map((context) => context.mode),
    ["restock", "restock", "checkout", "clean", "find-items"]
  );
});

test("Checkout assets are resolved from the configured global asset pack", () => {
  const checkout = contextForMode("checkout");
  const pack = resolveGlobalAssetPack(
    checkout.campaignLevel.level.presentation.assetPackId,
    "checkout"
  );

  assert.equal(checkout.runtime.fixture.id, "checkout-a");
  assert.equal(checkout.runtime.customerCount, 6);
  assert.deepEqual(
    checkout.levelAssets.customers.map((asset) => asset.key),
    pack.customerAssetKeys
  );
});

test("All levels share the same world, registry, and scene boundary", () => {
  const contexts = MAIN_LEVEL_CAMPAIGN_RUNTIME.levels.map((entry) => (
    createStarterMarketPresentationContext(entry.level.id)
  ));
  const first = contexts[0];
  const checkoutFixture = STARTER_MARKET_LAYOUT.fixtures.find((fixture) => (
    fixture.fixtureId === "checkout-a"
  ));
  const checkoutService = STARTER_MARKET_LAYOUT.interactions.find((interaction) => (
    interaction.id === "checkout-service-point"
  ));

  assert.ok(first);
  assert.ok(checkoutFixture);
  assert.ok(checkoutService);
  contexts.forEach((context) => {
    assert.equal(context.scene.key, first.scene.key);
    assert.equal(context.layout, first.layout);
    assert.equal(context.visual, first.visual);
    assert.equal(context.assets, first.assets);
    assert.deepEqual(context.world.checkout, checkoutFixture.position);
    assert.deepEqual(context.world.checkoutService, checkoutService.position);
  });
});

test("Campaign order supplies labels while level mode supplies task differences", () => {
  const levelOne = createStarterMarketPresentationContext("starter-level-001");
  const levelTwo = createStarterMarketPresentationContext("starter-level-002");
  const checkout = contextForMode("checkout");
  const clean = contextForMode("clean");
  const findItems = contextForMode("find-items");

  assert.equal(levelOne.labels.day, "DAY 1");
  assert.equal(levelTwo.labels.day, "DAY 2");
  assert.equal(levelOne.runtime.product.id, "cola-bottle");
  assert.equal(levelTwo.runtime.product.id, "water-bottle");
  assert.equal(checkout.runtime.mission.id, "assist-checkout-rush");
  assert.equal(clean.runtime.mission.id, "clean-store-floor");
  assert.equal(findItems.runtime.mission.id, "find-order-items");
  assert.notEqual(levelOne.productAssets.restockProductKey, levelTwo.productAssets.restockProductKey);
});

test("Restock target resolver maps workflow phases to the visible production props", () => {
  assert.deepEqual(resolver.resolve(snapshot("collect")), {
    x: STARTER_MARKET_PRESENTATION.world.backroomBox.x,
    y: STARTER_MARKET_PRESENTATION.world.backroomBox.y - 130,
    width: 215,
    height: 250
  });

  assert.deepEqual(resolver.resolve(snapshot("load")), {
    x: STARTER_MARKET_PRESENTATION.world.cartStart.x + 72,
    y: STARTER_MARKET_PRESENTATION.world.cartStart.y - 165,
    width: 330,
    height: 310
  });

  assert.deepEqual(resolver.resolve(snapshot("park")), {
    x: STARTER_MARKET_PRESENTATION.world.cartCooler.x,
    y: STARTER_MARKET_PRESENTATION.world.cartCooler.y,
    width: 280,
    height: 230
  });

  assert.deepEqual(resolver.resolve(snapshot("open")), {
    x: STARTER_MARKET_PRESENTATION.world.cartCooler.x + 24,
    y: STARTER_MARKET_PRESENTATION.world.cartCooler.y - 132,
    width: 205,
    height: 240
  });
});

test("Checkout target resolver uses the configured service point until completion", () => {
  const checkout = contextForMode("checkout");
  const checkoutResolver = new CheckoutTargetResolver(checkout.world.checkoutService);

  assert.deepEqual(checkoutResolver.resolve({
    step: "open",
    customersServed: 0,
    totalCustomers: checkout.runtime.customerCount,
    coins: 320,
    stars: 0,
    reputation: 0
  }), {
    x: checkout.world.checkoutService.x,
    y: checkout.world.checkoutService.y,
    width: 260,
    height: 190
  });
  assert.equal(checkoutResolver.resolve({
    step: "complete",
    customersServed: checkout.runtime.customerCount,
    totalCustomers: checkout.runtime.customerCount,
    coins: 400,
    stars: 1,
    reputation: 5
  }), undefined);
});

test("Each restock step targets the next independent cooler row", () => {
  STARTER_MARKET_PRESENTATION.visual.cooler.rowYs.forEach((rowY, rowIndex) => {
    const target = resolver.resolve(snapshot("restock", rowIndex));
    assert.equal(target.y, rowY);
    assert.equal(target.x, STARTER_MARKET_PRESENTATION.visual.cooler.centre.x);
  });
});

test("Completed restock work exposes no active world target", () => {
  assert.equal(resolver.resolve(snapshot("complete", 6)), undefined);
});
