const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");

const read = (path) => readFileSync(path, "utf8");

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

test("Restock scene remains a composition root instead of a drawing monolith", () => {
  const source = read("src/game/presentation/scenes/StarterMarketScene.ts");
  assert.equal(source.includes("this.add."), false);
  assert.equal(source.includes("this.tweens."), false);
  assert.equal(source.includes("createFloor()"), false);
  assert.equal(source.includes("createBackroom()"), false);
  assert.equal(source.includes("new StarterMarketEnvironmentView"), true);
  assert.equal(source.includes("new BeverageCoolerView"), true);
  assert.equal(source.includes("new RestockActorView"), true);
  assert.equal(source.includes("CheckoutWorkflow"), false);
  assert.equal(source.includes("CheckoutStationView"), false);
});

test("Checkout scene composes checkout modules without importing restock rules", () => {
  const source = read("src/game/presentation/scenes/CheckoutMarketScene.ts");
  assert.equal(source.includes("this.add."), false);
  assert.equal(source.includes("this.tweens."), false);
  assert.equal(source.includes("new StarterMarketEnvironmentView"), true);
  assert.equal(source.includes("new CheckoutStationView"), true);
  assert.equal(source.includes("new CheckoutSceneController"), true);
  assert.equal(source.includes("RestockWorkflow"), false);
  assert.equal(source.includes("RestockSceneController"), false);
  assert.equal(source.includes("BeverageCoolerView"), false);
});

test("Phaser factory selects a scene from the validated level mode", () => {
  const source = read("src/game/infrastructure/phaser/createPhaserGame.ts");
  assert.equal(source.includes('presentation.mode === "restock"'), true);
  assert.equal(source.includes("new StarterMarketScene"), true);
  assert.equal(source.includes("new CheckoutMarketScene"), true);
});

test("Legacy scene delegates to the project presentation scene", () => {
  const source = read("src/game-v2/presentation/ImmersiveDayOneScene.ts").trim();
  assert.equal(source.includes("StarterMarketScene as ImmersiveDayOneScene"), true);
  assert.equal(source.includes("class ImmersiveDayOneScene"), false);
});
