const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");

const source = readFileSync(
  "src/game/presentation/ui/LevelCompleteOverlay.ts",
  "utf8"
);

test("mobile completion overlay uses a compact vertical scale", () => {
  assert.match(source, /mobileLandscape === "required"/);
  assert.match(source, /finalScaleY = compactMobile \? 0\.82 : 1/);
  assert.match(source, /scaleY: finalScaleY/);
});

test("completion action owns one full-width topmost mobile hit surface", () => {
  assert.match(source, /390, 112, 0xffffff, 0\.001/);
  assert.match(source, /completion-primary-action-hit/);
  assert.match(source, /buttonArrow,\s*buttonHit/);
  assert.match(source, /buttonHit\.on\("pointerdown"/);
});
