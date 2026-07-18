const test = require("node:test");
const assert = require("node:assert/strict");

const {
  STARTER_MARKET_PRESENTATION,
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

test("Global starter market presentation context is internally consistent", () => {
  assert.deepEqual(validateStarterMarketPresentationContext(), []);
  assert.equal(
    STARTER_MARKET_PRESENTATION.runtime.slotCount,
    STARTER_MARKET_PRESENTATION.visual.cooler.rowYs.length
  );
  assert.equal(
    STARTER_MARKET_PRESENTATION.runtime.store.worldLayoutId,
    STARTER_MARKET_PRESENTATION.layout.id
  );
});

test("Restock target resolver maps workflow phases without knowing Phaser", () => {
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
