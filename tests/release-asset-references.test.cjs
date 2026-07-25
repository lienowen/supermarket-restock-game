const test = require("node:test");
const assert = require("node:assert/strict");

const loadAnalyzer = () => import("../scripts/runtime-asset-references.mjs");

test("Release analysis recognizes direct asset paths", async () => {
  const { containsReference } = await loadAnalyzer();
  const source = 'loader.image("worker", "assets/game/characters/worker.png")';
  assert.equal(containsReference(source, "assets/game/characters/worker.png"), true);
  assert.equal(containsReference(source, "assets/game/characters/customer.png"), false);
});

test("Release analysis preserves a directory family used by a template path", async () => {
  const { containsReference } = await loadAnalyzer();
  const source = 'path: `assets/game/props/cases/${product}-case-closed.png`';
  assert.equal(containsReference(source, "assets/game/props/cases/water-case-closed.png"), true);
  assert.equal(containsReference(source, "assets/game/props/cases/milk-case-closed.png"), true);
  assert.equal(containsReference(source, "assets/game/props/crates/apple-crate.png"), false);
});

test("A concrete sibling path does not retain every file in its directory", async () => {
  const { containsReference } = await loadAnalyzer();
  const source = 'path: "assets/ui/ui_icon_coin.png"';
  assert.equal(containsReference(source, "assets/ui/ui_icon_coin.png"), true);
  assert.equal(containsReference(source, "assets/ui/ui_icon_star.png"), false);
});
