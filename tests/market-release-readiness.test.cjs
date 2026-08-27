const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const read = (path) => fs.readFileSync(path, "utf8");

test("Level 5 products stay shelf-sized instead of becoming floating stickers", () => {
  const source = read("src/game/presentation/visual/TrimmedTexture.ts");
  assert.match(source, /GOLDEN_REQUESTED_ITEM_SCALE = 0\.62/);
  assert.match(source, /GOLDEN_DECOY_ITEM_SCALE = 0\.56/);
});

test("Level 6 uses its authored dispatch plate without duplicate store dressing", () => {
  const environment = read("src/game/presentation/world/StarterMarketEnvironmentView.ts");
  const assets = read("src/game/assets/LevelAssetResolver.ts");
  assert.match(environment, /"environment-dispatch-loading-l6"/);
  assert.match(assets, /"starter-level-006"/);
});

test("Level 6 suppresses generic cooler lines and cooler-only rule copy", () => {
  const scene = read("src/game/presentation/scenes/StarterMarketScene.ts");
  const cooler = read("src/game/presentation/fixtures/IntegratedBeverageCoolerView.ts");
  assert.match(scene, /showShelfForeground: !usesDispatchWarehouse/);
  assert.match(scene, /shelfRuleLabel: usesDispatchWarehouse \? ""/);
  assert.match(cooler, /showShelfForeground === false/);
});

test("runtime backgrounds and L1-L2 sprites use compact WebP assets", () => {
  const catalogue = read("src/game/assets/GlobalProjectAssetCatalogue.ts");
  const levelTwo = read("src/game/assets/LevelTwoAssetCatalogue.ts");
  assert.match(catalogue, /runtime-optimized\/backgrounds\/l1-market\.webp/);
  assert.match(levelTwo, /runtime-optimized\/l1-l2/);

  const optimizedFiles = [
    "public/assets/game/runtime-optimized/backgrounds/l1-market.webp",
    "public/assets/game/runtime-optimized/backgrounds/l2-water.webp",
    "public/assets/game/runtime-optimized/backgrounds/checkout.webp",
    "public/assets/game/runtime-optimized/backgrounds/cleaning.webp",
    "public/assets/game/runtime-optimized/backgrounds/order-hunt.webp",
    "public/assets/game/runtime-optimized/backgrounds/l6-dispatch.webp"
  ];
  optimizedFiles.forEach((path) => {
    assert.equal(fs.existsSync(path), true, `missing optimized runtime asset ${path}`);
    assert.ok(fs.statSync(path).size < 220_000, `${path} is too large for smooth level loading`);
  });
});

test("the next level is warmed only after the active scene starts", () => {
  const source = read("src/game/infrastructure/browser/NextLevelWarmup.ts");
  const bootstrap = read("src/game/infrastructure/phaser/createPhaserGame.ts");
  assert.match(source, /window\.setTimeout/);
  assert.match(source, /image\.decoding = "async"/);
  assert.match(source, /warmNextSceneCode\(config\.mode\)/);
  assert.match(bootstrap, /nextPresentation\.levelAssets\.preload\.map/);
});
