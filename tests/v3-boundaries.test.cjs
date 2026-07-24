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

test("Pointer input has one owner instead of duplicate window and Phaser handlers", () => {
  const source = read("src/game/presentation/actors/PlayerNavigationView.ts");
  assert.equal(source.includes("scene.input.topOnly = true"), true);
  assert.equal(source.includes('window.addEventListener("mousedown"'), false);
  assert.equal(source.includes('window.addEventListener("click"'), false);
  assert.equal(source.includes('window.addEventListener("touchstart"'), false);
  assert.equal(source.includes("handleWalkAreaPointerDown"), true);
});

test("Restock actor presentation composes the shared navigation view", () => {
  const source = read("src/game/presentation/actors/RestockActorView.ts");
  assert.equal(source.includes("new PlayerNavigationView"), true);
  assert.equal(source.includes("this.scene.tweens.add"), false);
  assert.equal(source.includes("travelDurationMs"), false);
  assert.equal(source.includes("onManualNavigation"), true);
});

test("Restock scene auto-approaches targets and removes low-value delivery clicks", () => {
  const source = read("src/game/presentation/scenes/StarterMarketScene.ts");
  assert.equal(source.includes("requestCurrentAction"), true);
  assert.equal(source.includes("advancePendingAction"), true);
  assert.equal(source.includes('this.dispatchSceneAction("PUSH_CART", false)'), true);
  assert.equal(source.includes('this.dispatchSceneAction("OPEN_BOX", false)'), true);
  assert.equal(source.includes("FAST STOCK x"), true);
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

test("Utility scene delegates the cleaning station and spill drawing to a reusable view", () => {
  const source = read("src/game/presentation/scenes/UtilityTaskScene.ts");
  const view = read("src/game/presentation/cleaning/CleaningTaskView.ts");

  assert.equal(source.includes("new CleaningTaskView"), true);
  assert.equal(source.includes("clean-spill"), false);
  assert.equal(view.includes("clean-spill"), true);
  assert.equal(view.includes("spotPositions"), true);
  assert.equal(view.includes("starter-level-"), false);
});

test("Phaser bootstrap delegates mode selection to the gameplay scene registry", () => {
  const source = read("src/game/infrastructure/phaser/createPhaserGame.ts");
  assert.equal(source.includes("createGameplayScene"), true);
  assert.equal(source.includes("new StarterMarketScene"), false);
  assert.equal(source.includes("new CheckoutMarketScene"), false);
  assert.equal(source.includes("switch (presentation.mode)"), false);
});

test("Gameplay runtime selection is owned by a mode registry", () => {
  const source = read("src/game/application/LevelRuntimeContent.ts");
  assert.equal(source.includes("resolveGameplayRuntime"), true);
  assert.equal(source.includes("resolveRestockShiftRuntime"), false);
  assert.equal(source.includes("resolveCheckoutLevelRuntime"), false);
});

test("Gameplay code never branches on a concrete level id", () => {
  const runtimeRoots = [
    "src/game/application",
    "src/game/infrastructure",
    "src/game/presentation"
  ];
  const branchPattern = /(if\s*\([^\n]*starter-level-|case\s+["']starter-level-|===?\s*["']starter-level-|!==?\s*["']starter-level-)/;
  const offenders = runtimeRoots
    .flatMap(sourceFilesUnder)
    .filter((path) => branchPattern.test(read(path)));
  assert.deepEqual(offenders, []);
});

test("Level configuration contains variables but no asset paths or methods", () => {
  const source = read("src/game/content/levels/starterMarketLevels.ts");
  assert.equal(source.includes("assetPackId"), true);
  assert.equal(source.includes("visualPresetId"), true);
  assert.equal(source.includes('mode: "restock"'), true);
  assert.equal(source.includes('mode: "checkout"'), true);
  assert.equal(source.includes('mode: "clean"'), true);
  assert.equal(source.includes('mode: "find-items"'), true);
  assert.equal(source.includes("AssetKey"), false);
  assert.equal(source.includes("assets/game/"), false);
  assert.equal(source.includes("new Phaser"), false);
  assert.equal(source.includes("Scene"), false);
});

test("Global asset packs own reusable character and equipment bindings", () => {
  const source = read("src/game/assets/GlobalAssetPackRegistry.ts");
  assert.equal(source.includes("market-restock-v1"), true);
  assert.equal(source.includes("market-checkout-v1"), true);
  assert.equal(source.includes("market-clean-v1"), true);
  assert.equal(source.includes("market-find-items-v1"), true);
  assert.equal(source.includes("caseAssetsByProductId"), true);
});

test("Scenes resolve presentation from the active level configuration", () => {
  for (const path of [
    "src/game/presentation/scenes/StarterMarketScene.ts",
    "src/game/presentation/scenes/CheckoutMarketScene.ts",
    "src/game/presentation/scenes/UtilityTaskScene.ts"
  ]) {
    const source = read(path);
    assert.equal(source.includes("resolveLevelVisualPreset"), true, path);
  }
});

test("Legacy scene delegates to the project presentation scene", () => {
  const source = read("src/game-v2/presentation/ImmersiveDayOneScene.ts").trim();
  assert.equal(source.includes("StarterMarketScene as ImmersiveDayOneScene"), true);
  assert.equal(source.includes("class ImmersiveDayOneScene"), false);
});
