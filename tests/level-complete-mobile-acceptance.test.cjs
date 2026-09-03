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
  assert.match(source, /buttonHitWidth = compactMobile \? 540 : 460/);
  assert.match(source, /buttonHitHeight = compactMobile \? 150 : 120/);
  assert.match(source, /completion-primary-action-hit/);
  assert.match(source, /buttonArrow,\s*buttonHit/);
  assert.match(source, /buttonHit\.on\("pointerup"/);
  assert.doesNotMatch(source, /buttonContainer\.on\("pointer(?:down|up)"/);
  assert.match(source, /\.setSize\(buttonHitWidth, buttonHitHeight\)/);
  assert.match(source, /window\.addEventListener\("pointerup", this\.mobileActionFallback, true\)/);
  assert.match(source, /mapSoftwareLandscapeClientPoint/);
  assert.match(source, /halfWidth = \(compactMobile \? 300 : 250\) \* finalScaleX/);
  assert.match(source, /halfHeight = \(compactMobile \? 92 : 72\) \* finalScaleY/);
});

test("software-landscape briefing is compact and uses the rotated viewport axes", () => {
  const css = readFileSync("src/mobile-playability.css", "utf8");
  assert.match(css, /width: min\(900px, calc\(100dvh - 28px\)\)/);
  assert.match(css, /max-height: calc\(100dvw - 20px\)/);
  assert.match(css, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
});
