const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const source = fs.readFileSync("src/game/presentation/ui/CheckoutScanDom.ts", "utf8");

test("L3 checkout sizes visible product bounds instead of padded PNG canvases", () => {
  assert.match(source, /trimTransparentProduct/);
  assert.match(source, /getImageData/);
  assert.match(source, /dataset\.alphaTrimmed = "true"/);
  assert.match(source, /trimmedCheckoutProductSources/);
});

test("L3 checkout keeps packaging-aware sizes and bottom alignment", () => {
  assert.match(source, /product-apple.*width: 58, height: 58/);
  assert.match(source, /product-oats-canister.*width: 60, height: 64/);
  assert.match(source, /objectPosition: "center bottom"/);
  assert.match(source, /minHeight: "104px"/);
});
