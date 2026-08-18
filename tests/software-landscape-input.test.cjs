const test = require("node:test");
const assert = require("node:assert/strict");

const {
  inverseSoftwareLandscapeClientPoint,
  mapSoftwareLandscapeClientPoint
} = require("../.test-dist/src/game/infrastructure/phaser/SoftwareLandscapeGeometry.js");

const closeTo = (actual, expected, epsilon = 0.001) => {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `expected ${actual} to be within ${epsilon} of ${expected}`
  );
};

test("software landscape inverse rotation maps portrait client coordinates back to stage space", () => {
  const bodyRect = { left: 0, top: 0, width: 900, height: 1600 };
  const point = inverseSoftwareLandscapeClientPoint(49, 1228, bodyRect);

  assert.deepEqual(point, { x: 1228, y: 851 });
});

test("software landscape mapping hits a Phaser HUD button with a full-fit canvas", () => {
  const mapped = mapSoftwareLandscapeClientPoint({
    clientX: 49,
    clientY: 1228,
    bodyRect: { left: 0, top: 0, width: 900, height: 1600 },
    canvasRect: { left: 0, top: 0, width: 900, height: 1600 },
    logicalWidth: 1600,
    logicalHeight: 900
  });

  assert.ok(mapped);
  closeTo(mapped.x, 1228);
  closeTo(mapped.y, 851);
});

test("software landscape mapping follows the rendered canvas under dynamic viewport letterboxing", () => {
  const bodyRect = { left: 12, top: 24, width: 930, height: 1700 };
  const fitScale = 930 / 900;
  const canvasStageWidth = 1600 * fitScale;
  const canvasStageLeft = (1700 - canvasStageWidth) / 2;
  const canvasRect = {
    left: bodyRect.left,
    top: bodyRect.top + canvasStageLeft,
    width: 930,
    height: canvasStageWidth
  };

  const logicalX = 1228;
  const logicalY = 851;
  const stageX = canvasStageLeft + logicalX * fitScale;
  const stageY = logicalY * fitScale;
  const clientX = bodyRect.left + bodyRect.width - stageY;
  const clientY = bodyRect.top + stageX;

  const mapped = mapSoftwareLandscapeClientPoint({
    clientX,
    clientY,
    bodyRect,
    canvasRect,
    logicalWidth: 1600,
    logicalHeight: 900
  });

  assert.ok(mapped);
  closeTo(mapped.x, logicalX);
  closeTo(mapped.y, logicalY);
});

test("software landscape mapping fails safely when the rendered canvas has no usable size", () => {
  const mapped = mapSoftwareLandscapeClientPoint({
    clientX: 100,
    clientY: 100,
    bodyRect: { left: 0, top: 0, width: 900, height: 1600 },
    canvasRect: { left: 0, top: 0, width: 0, height: 0 },
    logicalWidth: 1600,
    logicalHeight: 900
  });

  assert.equal(mapped, undefined);
});
