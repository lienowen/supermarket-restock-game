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
  assert.match(source, /460, 120, 0xffffff, 0\.001/);
  assert.match(source, /completion-primary-action-hit/);
  assert.match(source, /buttonArrow,\s*buttonHit/);
  assert.match(source, /buttonHit\.on\("pointerdown"/);
  assert.match(source, /buttonContainer\.on\("pointerdown"/);
  assert.match(source, /\.setSize\(460, 120\)/);
  assert.match(source, /window\.addEventListener\("pointerdown", this\.mobileActionFallback, true\)/);
  assert.match(source, /mapSoftwareLandscapeClientPoint/);
  assert.match(source, /Math\.abs\(mapped\.x - config\.centreX\) <= 250 \* finalScaleX/);
});

test("software-landscape briefing is compact and uses the rotated viewport axes", () => {
  const css = readFileSync("src/mobile-playability.css", "utf8");
  assert.match(css, /width: min\(900px, calc\(100dvh - 28px\)\)/);
  assert.match(css, /max-height: calc\(100dvw - 20px\)/);
  assert.match(css, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
});
