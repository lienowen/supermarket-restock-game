const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync, readdirSync, statSync } = require("node:fs");
const { join } = require("node:path");

const read = (path) => readFileSync(path, "utf8");

const sourceFilesUnder = (root) => {
  const result = [];
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    if (statSync(path).isDirectory()) result.push(...sourceFilesUnder(path));
    else if (path.endsWith(".ts")) result.push(path);
  }
  return result;
};

test("Project bootstrap owns runtime creation without importing game-v2", () => {
  const source = read("src/game/bootstrap.ts");
  assert.equal(source.includes("game-v2"), false);
  assert.equal(source.includes("./infrastructure/phaser/createPhaserGame"), true);
});

test("Legacy bootstrap is only a compatibility export", () => {
  const source = read("src/game-v2/bootstrap.ts").trim();
  assert.equal(source.includes("new Phaser.Game"), false);
  assert.equal(source.includes("createPhaserGame as bootstrapImmersiveGame"), true);
});

test("Player navigation rules remain independent from Phaser and mission modes", () => {
  const source = read("src/game/application/PlayerNavigationController.ts");
  assert.equal(source.includes('from "phaser"'), false);
  assert.equal(source.includes("RestockWorkflow"), false);
  assert.equal(source.includes("CheckoutWorkflow"), false);
  assert.equal(source.includes("Phaser."), false);
});

test("Pointer input has one owner and click movement uses the Phaser clock", () => {
  const source = read("src/game/presentation/actors/PlayerNavigationView.ts");
  assert.equal(source.includes("scene.input.topOnly = true"), true);
  assert.equal(source.includes('window.addEventListener("mousedown"'), false);
  assert.equal(source.includes('window.addEventListener("click"'), false);
  assert.equal(source.includes('window.addEventListener("touchstart"'), false);
  assert.equal(source.includes("handleWalkAreaPointerDown"), true);
  assert.equal(source.includes("requestAnimationFrame"), false);
  assert.equal(source.includes("performance.now"), false);
  assert.equal(source.includes("this.scene.tweens.add"), true);
  assert.equal(source.includes("destinationTween"), true);
  assert.equal(source.includes("this.controller.setPosition(travel)"), true);
  assert.equal(source.includes("pointer.worldX"), true);
});

test("Renderer stays antialiased and requests the high-performance GPU path", () => {
  const source = read("src/game/infrastructure/phaser/createPhaserGame.ts");
  assert.equal(source.includes("antialias: true"), true);
  assert.equal(source.includes("pixelArt: false"), true);
  assert.equal(source.includes('powerPreference: "high-performance"'), true);
});

test("Every mode builds the store from layered assets instead of a stretched backdrop", () => {
  const source = read("src/game/presentation/world/StarterMarketEnvironmentView.ts");
  assert.equal(source.includes("restock-aisle-v2-background"), false);
  assert.equal(source.includes("createRestockAisle"), false);
  assert.equal(source.includes("this.createBase()"), true);
  assert.equal(source.includes("this.createFloor()"), true);
  assert.equal(source.includes("fixture-backroom-rack-a"), true);
  assert.equal(source.includes("fixture-produce-display-a"), true);
});

test("Restock actor presentation composes the shared navigation view", () => {
  const source = read("src/game/presentation/actors/RestockActorView.ts");
  assert.equal(source.includes("new PlayerNavigationView"), true);
  assert.equal(source.includes("this.scene.tweens.add"), false);
  assert.equal(source.includes("travelDurationMs"), false);
  assert.equal(source.includes("onManualNavigation"), true);
});

test("Restock scene auto-approaches targets and completes shelves only after three items", () => {
  const source = read("src/game/presentation/scenes/StarterMarketScene.ts");
  assert.equal(source.includes("requestCurrentAction"), true);
  assert.equal(source.includes("advancePendingAction"), true);
  assert.equal(source.includes('this.dispatchSceneAction("PUSH_CART", false)'), true);
  assert.equal(source.includes('this.dispatchSceneAction("OPEN_BOX", false)'), true);
  assert.equal(source.includes("itemsPerRow: COOLER_STOCK_ITEMS_PER_SLOT"), true);
  assert.equal(source.includes("result.rowCompleted"), true);
  assert.equal(source.includes("STOCKED ${itemLabel}"), true);
  assert.equal(source.includes("SHELF FULL ${itemLabel}"), true);
});

test("Restock scene remains a composition root instead of a drawing monolith", () => {
  const source = read("src/game/presentation/scenes/StarterMarketScene.ts");
  assert.equal(source.includes("this.add."), false);
  assert.equal(source.includes("this.tweens."), false);
  assert.equal(source.includes("new StarterMarketEnvironmentView"), true);
  assert.equal(source.includes("new BeverageCoolerView"), true);
  assert.equal(source.includes("new RestockActorView"), true);
  assert.equal(source.includes("CheckoutStationView"), false);
});

test("Checkout scene composes checkout and shared navigation modules without restock rules", () => {
  const source = read("src/game/presentation/scenes/CheckoutMarketScene.ts");
  assert.equal(source.includes("this.add."), false);
  assert.equal(source.includes("this.tweens."), false);
  assert.equal(source.includes("new StarterMarketEnvironmentView"), true);
  assert.equal(source.includes("new CheckoutStationView"), true);
  assert.equal(source.includes("new PlayerNavigationView"), true);
  assert.equal(source.includes("new CheckoutSceneController"), true);
  assert.equal(source.includes("RestockSceneController"), false);
});

test("Utility scene delegates phase-driven cleaning focus to a reusable view", () => {
  const source = read("src/game/presentation/scenes/UtilityTaskScene.ts");
  const view = read("src/game/presentation/cleaning/CleaningTaskView.ts");

  assert.equal(source.includes("new CleaningTaskView"), true);
  assert.equal(source.includes("cleaningView?.sync"), true);
  assert.equal(source.includes("clean-spill"), false);
  assert.equal(view.includes("clean-spill"), true);
  assert.equal(view.includes("completedSpills"), true);
  assert.equal(view.includes("setVisible(false)"), true);
  assert.equal(view.includes("activeSpillAlpha"), true);
  assert.equal(view.includes("spotPositions"), true);
  assert.equal(view.includes("starter-level-"), false);
});

test("Utility scene delegates the order summary to a reusable view", () => {
  const source = read("src/game/presentation/scenes/UtilityTaskScene.ts");
  const view = read("src/game/presentation/findItems/OrderTicketView.ts");

  assert.equal(source.includes("new OrderTicketView"), true);
  assert.equal(source.includes("orderTicket?.sync"), true);
  assert.equal(view.includes("ORDER LIST"), true);
  assert.equal(view.includes("productIds"), true);
});

test("Order hunt is driven by player shelf choices rather than a revealed answer", () => {
  const source = read("src/game/presentation/scenes/UtilityTaskScene.ts");
  assert.equal(source.includes("attemptFindProduct"), true);
  assert.equal(source.includes("requestFindProduct"), true);
  assert.equal(source.includes("recordFindMistake"), true);
  assert.equal(source.includes("findChallenge.selectProduct"), true);
  assert.equal(source.includes("findChallenge.recordMistake"), true);
});

test("Phaser bootstrap delegates mode selection to the gameplay scene registry", () => {
  const source = read("src/game/infrastructure/phaser/createPhaserGame.ts");
  assert.equal(source.includes("createGameplayScene"), true);
  assert.equal(source.includes("new StarterMarketScene"), false);
  assert.equal(source.includes("new CheckoutMarketScene"), false);
  assert.equal(source.includes("new UtilityTaskScene"), false);
});

test("Gameplay runtime selection is owned by a mode registry", () => {
  const source = read("src/game/application/GameplayModeRegistry.ts");
  assert.equal(source.includes("resolveGameplayRuntime"), true);
  assert.equal(source.includes("validateGameplayRuntime"), true);
  assert.equal(source.includes("switch (level.mode)"), true);
});

test("Gameplay code never branches on a concrete level id", () => {
  const roots = [
    "src/game/application",
    "src/game/presentation",
    "src/game/infrastructure"
  ];
  const offenders = roots
    .flatMap((root) => sourceFilesUnder(root))
    .filter((path) => read(path).includes("starter-level-"));
  assert.deepEqual(offenders, []);
});
