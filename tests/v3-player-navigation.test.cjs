const test = require("node:test");
const assert = require("node:assert/strict");

const {
  PlayerNavigationController
} = require("../.test-dist/src/game/application/PlayerNavigationController.js");

const createController = () => new PlayerNavigationController({
  start: { x: 100, y: 100 },
  bounds: { x: 50, y: 60, width: 200, height: 180 },
  speed: 100
});

test("Keyboard-style direction movement is normalized and bounded", () => {
  const controller = createController();
  assert.equal(controller.moveDirection(1, 1, 1000), true);

  const moved = controller.snapshot().position;
  assert.ok(Math.abs(moved.x - 170.710678) < 0.001);
  assert.ok(Math.abs(moved.y - 170.710678) < 0.001);

  controller.moveDirection(10, 10, 10000);
  assert.deepEqual(controller.snapshot().position, { x: 250, y: 240 });
});

test("Tap destination movement stops exactly at the clamped destination", () => {
  const controller = createController();
  controller.setDestination({ x: 400, y: 20 });

  for (let frame = 0; frame < 20; frame += 1) controller.update(100);

  assert.deepEqual(controller.snapshot(), {
    position: { x: 250, y: 60 },
    destination: undefined,
    moving: false
  });
});

test("Proximity checks use player position rather than target visuals", () => {
  const controller = createController();
  assert.equal(controller.isNear({ x: 160, y: 100 }, 60), true);
  assert.equal(controller.isNear({ x: 161, y: 100 }, 60), false);
  assert.throws(() => controller.isNear({ x: 100, y: 100 }, -1), /cannot be negative/);
});
