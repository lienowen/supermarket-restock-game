import Phaser from "phaser";
import type { RestockSceneSnapshot } from "../../application/RestockSceneController";
import type { RestockStarterMarketPresentationContext } from "../context/StarterMarketPresentationContext";
import { StarterMarketScene } from "../scenes/StarterMarketScene";

const LEVEL_TWO_ID = "starter-level-002";

interface LevelTwoSceneInternals {
  readonly context: RestockStarterMarketPresentationContext;
  readonly controller: { snapshot(): RestockSceneSnapshot };
  readonly memoryPreviewActive: boolean;
}

interface FocusGuide {
  readonly root: Phaser.GameObjects.Container;
  readonly ring: Phaser.GameObjects.Arc;
  readonly label: Phaser.GameObjects.Text;
}

interface VisibilityPort {
  setVisible(visible: boolean): unknown;
}

const guideByScene = new WeakMap<StarterMarketScene, FocusGuide>();

const isLevelTwo = (): boolean => document.body.dataset.activeLevel === LEVEL_TWO_ID;

const originalUpdate = StarterMarketScene.prototype.update;
StarterMarketScene.prototype.update = function updateWithLevelTwoClarity(
  this: StarterMarketScene,
  time: number,
  delta: number
): void {
  originalUpdate.call(this, time, delta);
  if (!isLevelTwo()) return;
  applyLevelTwoClarity(this);
};

function applyLevelTwoClarity(scene: StarterMarketScene): void {
  const view = scene as unknown as LevelTwoSceneInternals;
  const snapshot = view.controller.snapshot();

  // Defensive cleanup: if a cached/hot-reloaded scene still contains the richer
  // shared dressing, keep L2 focused on gameplay only.
  [
    "ambient-produce-display",
    "ambient-backroom-rack",
    "ambient-shopping-cart",
    "ambient-dairy-aisle",
    "ambient-cleaning-aisle",
    "ambient-checkout",
    "ambient-customer-a",
    "ambient-customer-b"
  ].forEach((name) => setObjectVisible(scene.children.getByName(name), false));

  setObjectVisible(scene.children.getByName("restock-cooler-shelf-rule"), false);

  compactPlaceControl(scene);
  syncFocusGuide(scene, view, snapshot);

  document.body.dataset.levelTwoVisualHierarchy = "single-focus-v2";
}

function setObjectVisible(object: Phaser.GameObjects.GameObject | null, visible: boolean): void {
  const candidate = object as unknown as Partial<VisibilityPort> | null;
  candidate?.setVisible?.(visible);
}

function compactPlaceControl(scene: StarterMarketScene): void {
  const root = scene.children.getByName("level-two-context-place-control");
  if (!(root instanceof Phaser.GameObjects.Container)) return;

  root.setScale(0.74).setPosition(1492, 712);
  root.list.forEach((child) => {
    if (!(child instanceof Phaser.GameObjects.Text)) return;
    if (child.text === "✋") child.setVisible(false);
    if (child.text === "E / SPACE" || child.text === "E / TAP") {
      child.setText("TAP").setFontSize(9).setY(67);
    }
  });
}

function syncFocusGuide(
  scene: StarterMarketScene,
  view: LevelTwoSceneInternals,
  snapshot: RestockSceneSnapshot
): void {
  const guide = ensureGuide(scene);
  const contextualAction = document.body.dataset.levelTwoContextAction;

  // Once the PLACE control is actionable it becomes the one primary prompt.
  // Do not show a second world-space PLACE label at the same time.
  if (
    snapshot.step === "complete" ||
    view.memoryPreviewActive ||
    contextualAction === "place-ready"
  ) {
    guide.root.setVisible(false);
    document.body.dataset.levelTwoPrimaryPrompt = contextualAction === "place-ready"
      ? "place-control"
      : "none";
    return;
  }

  const target = targetFor(view, snapshot);
  if (!target) {
    guide.root.setVisible(false);
    document.body.dataset.levelTwoPrimaryPrompt = "none";
    return;
  }

  guide.root.setPosition(target.x, target.y).setVisible(true);
  guide.label.setText(target.label);
  guide.ring.setStrokeStyle(3, target.color, 0.88).setFillStyle(target.color, 0.035);
  document.body.dataset.levelTwoPrimaryPrompt = "focus-guide";
}

function targetFor(
  view: LevelTwoSceneInternals,
  snapshot: RestockSceneSnapshot
): { readonly x: number; readonly y: number; readonly label: string; readonly color: number } | undefined {
  const world = view.context.world;
  switch (snapshot.step) {
    case "collect":
      return { x: world.backroomBox.x, y: world.backroomBox.y, label: "PICK BOX", color: 0xffd95e };
    case "load":
      return { x: world.cartStart.x, y: world.cartStart.y, label: "LOAD CART", color: 0xffd95e };
    case "push":
    case "park":
    case "open":
      return { x: world.cartCooler.x, y: world.cartCooler.y, label: "TO COOLER", color: 0x9be7ff };
    case "restock": {
      const carrying = document.body.dataset.levelTwoBatch === "carrying-3";
      if (carrying) {
        return {
          x: world.beverageCooler.x,
          y: world.cartCooler.y - 8,
          label: "PLACE 3",
          color: 0x83df8b
        };
      }
      return {
        x: world.cartCooler.x + 42,
        y: world.cartCooler.y - 6,
        label: "PICK 3",
        color: 0xffd95e
      };
    }
    case "complete":
      return undefined;
  }
}

function ensureGuide(scene: StarterMarketScene): FocusGuide {
  const existing = guideByScene.get(scene);
  if (existing) return existing;

  const ring = scene.add.circle(0, 0, 38, 0xffd95e, 0.035)
    .setStrokeStyle(3, 0xffd95e, 0.88);
  const arrow = scene.add.text(0, -55, "▼", {
    fontFamily: "Arial, sans-serif",
    fontSize: "20px",
    color: "#ffe27a",
    fontStyle: "bold",
    stroke: "#112319",
    strokeThickness: 3
  }).setOrigin(0.5);
  const label = scene.add.text(0, -77, "", {
    fontFamily: "Arial, sans-serif",
    fontSize: "12px",
    color: "#ffffff",
    fontStyle: "bold",
    backgroundColor: "#143321",
    padding: { x: 8, y: 4 }
  }).setOrigin(0.5);

  const root = scene.add.container(0, 0, [ring, arrow, label])
    .setDepth(205)
    .setName("level-two-focus-guide");

  scene.tweens.add({
    targets: [ring, arrow],
    y: "+=5",
    alpha: { from: 0.76, to: 1 },
    duration: 680,
    ease: "Sine.InOut",
    yoyo: true,
    repeat: -1
  });

  const guide = { root, ring, label };
  guideByScene.set(scene, guide);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    root.destroy(true);
    guideByScene.delete(scene);
  });
  return guide;
}
