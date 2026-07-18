const test = require("node:test");
const assert = require("node:assert/strict");

const {
  STARTER_MARKET_PRESENTATION,
  createStarterMarketPresentationContext,
  validateStarterMarketPresentationContext
} = require("../.test-dist/src/game/presentation/context/StarterMarketPresentationContext.js");
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

test("Day 1 and Day 2 contexts are internally consistent", () => {
  const dayOne = createStarterMarketPresentationContext("starter-shift-001");
  const dayTwo = createStarterMarketPresentationContext("starter-shift-002");

  assert.deepEqual(validateStarterMarketPresentationContext(dayOne), []);
  assert.deepEqual(validateStarterMarketPresentationContext(dayTwo), []);
  assert.equal(dayOne.runtime.slotCount, dayOne.visual.cooler.rowYs.length);
  assert.equal(dayTwo.runtime.slotCount, dayTwo.visual.cooler.rowYs.length);
  assert.equal(dayOne.runtime.store.worldLayoutId, dayOne.layout.id);
  assert.equal(dayTwo.runtime.store.worldLayoutId, dayTwo.layout.id);
});

test("Both days use the same scene, world layout, fixture, and presentation modules", () => {
  const dayOne = createStarterMarketPresentationContext("starter-shift-001");
  const dayTwo = createStarterMarketPresentationContext("starter-shift-002");

  assert.equal(dayOne.scene.key, "starter-market-shift");
  assert.equal(dayTwo.scene.key, dayOne.scene.key);
  assert.equal(dayTwo.layout, dayOne.layout);
  assert.equal(dayTwo.visual, dayOne.visual);
  assert.equal(dayTwo.assets, dayOne.assets);
  assert.equal(dayTwo.runtime.store.id, dayOne.runtime.store.id);
  assert.equal(dayTwo.runtime.fixture.id, dayOne.runtime.fixture.id);
});

test("Campaign order supplies day labels while shift content supplies task differences", () => {
  const dayOne = createStarterMarketPresentationContext("starter-shift-001");
  const dayTwo = createStarterMarketPresentationContext("starter-shift-002");

  assert.equal(dayOne.labels.day, "DAY 1");
  assert.equal(dayTwo.labels.day, "DAY 2");
  assert.equal(dayOne.runtime.product.id, "cola-bottle");
  assert.equal(dayTwo.runtime.product.id, "water-bottle");
  assert.equal(dayOne.runtime.mission.id, "restock-cola-cooler");
  assert.equal(dayTwo.runtime.mission.id, "restock-water-promotion");
  assert.notEqual(dayOne.productAssets.restockProductKey, dayTwo.productAssets.restockProductKey);
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

test("Each restock step targets the next independent cooler row", () => {
  STARTER_MARKET_PRESENTATION.visual.cooler.rowYs.forEach((rowY, rowIndex) => {
    const target = resolver.resolve(snapshot("restock", rowIndex));
    assert.equal(target.y, rowY);
    assert.equal(target.x, STARTER_MARKET_PRESENTATION.visual.cooler.centre.x);
  });
});

test("Completed work exposes no active world target", () => {
  assert.equal(resolver.resolve(snapshot("complete", 6)), undefined);
});
