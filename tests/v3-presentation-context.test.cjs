const test = require("node:test");
const assert = require("node:assert/strict");

const {
  STARTER_MARKET_PRESENTATION,
  createStarterMarketPresentationContext,
  validateStarterMarketPresentationContext
} = require("../.test-dist/src/game/presentation/context/StarterMarketPresentationContext.js");
const {
  CheckoutTargetResolver
} = require("../.test-dist/src/game/presentation/interactions/CheckoutTargetResolver.js");
const {
  RestockTargetResolver
} = require("../.test-dist/src/game/presentation/interactions/RestockTargetResolver.js");

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

test("Restock and checkout contexts are internally consistent", () => {
  const dayOne = createStarterMarketPresentationContext("starter-level-001");
  const dayTwoRestock = createStarterMarketPresentationContext("starter-level-002");
  const dayTwoCheckout = createStarterMarketPresentationContext("starter-level-003");

  assert.deepEqual(validateStarterMarketPresentationContext(dayOne), []);
  assert.deepEqual(validateStarterMarketPresentationContext(dayTwoRestock), []);
  assert.deepEqual(validateStarterMarketPresentationContext(dayTwoCheckout), []);
  assert.equal(dayOne.mode, "restock");
  assert.equal(dayTwoRestock.mode, "restock");
  assert.equal(dayTwoCheckout.mode, "checkout");
  assert.equal(dayTwoCheckout.runtime.fixture.id, "checkout-a");
  assert.equal(dayTwoCheckout.runtime.customerCount, 6);
  assert.deepEqual(
    dayTwoCheckout.levelAssets.customers.map((asset) => asset.key),
    ["customer-a-carry-basket", "customer-b-carry-basket"]
  );
});

test("All levels share the same world, registry, and scene boundary", () => {
  const levelOne = createStarterMarketPresentationContext("starter-level-001");
  const levelTwo = createStarterMarketPresentationContext("starter-level-002");
  const levelThree = createStarterMarketPresentationContext("starter-level-003");

  assert.equal(levelOne.scene.key, "starter-market-shift");
  assert.equal(levelTwo.scene.key, levelOne.scene.key);
  assert.equal(levelThree.scene.key, levelOne.scene.key);
  assert.equal(levelTwo.layout, levelOne.layout);
  assert.equal(levelThree.layout, levelOne.layout);
  assert.equal(levelTwo.visual, levelOne.visual);
  assert.equal(levelThree.visual, levelOne.visual);
  assert.equal(levelTwo.assets, levelOne.assets);
  assert.equal(levelThree.assets, levelOne.assets);
  assert.equal(levelThree.world.checkout.x, 470);
  assert.equal(levelThree.world.checkoutService.x, 520);
});

test("Campaign order supplies labels while level mode supplies task differences", () => {
  const levelOne = createStarterMarketPresentationContext("starter-level-001");
  const levelTwo = createStarterMarketPresentationContext("starter-level-002");
  const levelThree = createStarterMarketPresentationContext("starter-level-003");

  assert.equal(levelOne.labels.day, "DAY 1");
  assert.equal(levelTwo.labels.day, "DAY 2");
  assert.equal(levelThree.labels.day, "DAY 2");
  assert.equal(levelOne.runtime.product.id, "cola-bottle");
  assert.equal(levelTwo.runtime.product.id, "water-bottle");
  assert.equal(levelThree.runtime.mission.id, "assist-checkout-rush");
  assert.notEqual(levelOne.productAssets.restockProductKey, levelTwo.productAssets.restockProductKey);
});

test("Restock target resolver maps workflow phases without knowing day or Phaser", () => {
  assert.deepEqual(resolver.resolve(snapshot("collect")), {
    x: STARTER_MARKET_PRESENTATION.world.backroomBox.x,
    y: STARTER_MARKET_PRESENTATION.world.backroomBox.y,
    width: 150,
    height: 112
  });

  assert.deepEqual(resolver.resolve(snapshot("park")), {
    x: STARTER_MARKET_PRESENTATION.world.cartCooler.x,
    y: STARTER_MARKET_PRESENTATION.world.cartCooler.y,
    width: 280,
    height: 230
  });
});

test("Checkout target resolver exposes one service point until completion", () => {
  const checkout = createStarterMarketPresentationContext("starter-level-003");
  const checkoutResolver = new CheckoutTargetResolver(checkout.world.checkoutService);

  assert.deepEqual(checkoutResolver.resolve({
    step: "open",
    customersServed: 0,
    totalCustomers: 6,
    coins: 320,
    stars: 0,
    reputation: 0
  }), {
    x: 520,
    y: 680,
    width: 260,
    height: 190
  });
  assert.equal(checkoutResolver.resolve({
    step: "complete",
    customersServed: 6,
    totalCustomers: 6,
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
