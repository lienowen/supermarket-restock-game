import Phaser from "phaser";
import type { RestockSceneSnapshot } from "../../application/RestockSceneController";
import { RestockActorView, type RestockActorViewConfig } from "./RestockActorView";

const WATER_CASE_KEY = "prop-water-case-closed";
const WATER_BOTTLE_KEY = "product-water-bottle";

interface RestockActorInternals {
  readonly scene: Phaser.Scene;
  readonly config: RestockActorViewConfig;
  readonly caseBox: Phaser.GameObjects.Image;
}

interface WaterCaseOpenComposition {
  readonly root: Phaser.GameObjects.Container;
  readonly opening: Phaser.GameObjects.Graphics;
  readonly bottles: readonly Phaser.GameObjects.Image[];
}

const compositions = new WeakMap<RestockActorView, WaterCaseOpenComposition>();

const originalSync = RestockActorView.prototype.sync;
RestockActorView.prototype.sync = function syncWaterCaseOpenComposition(
  this: RestockActorView,
  snapshot: RestockSceneSnapshot
): void {
  originalSync.call(this, snapshot);

  const view = this as unknown as RestockActorInternals;
  if (view.config.caseAssetKey !== WATER_CASE_KEY) return;

  const composition = ensureComposition(this, view);
  const open = snapshot.boxOpened && (snapshot.step === "open" || snapshot.step === "restock");
  syncComposition(view, composition, open);

  document.body.dataset.waterCaseOpenVisual = open ? "layered-open-v1" : "closed";
};

function ensureComposition(
  owner: RestockActorView,
  view: RestockActorInternals
): WaterCaseOpenComposition {
  const existing = compositions.get(owner);
  if (existing) return existing;

  const opening = view.scene.add.graphics();
  opening.fillStyle(0x2b1a0f, 0.96);
  opening.fillRoundedRect(-46, -62, 92, 26, 7);

  // Rear flaps rise behind the bottles, front flaps frame the open carton mouth.
  opening.fillStyle(0xc98b47, 1);
  opening.fillPoints([
    new Phaser.Geom.Point(-46, -58),
    new Phaser.Geom.Point(-70, -82),
    new Phaser.Geom.Point(-15, -71),
    new Phaser.Geom.Point(-4, -51)
  ], true);
  opening.fillPoints([
    new Phaser.Geom.Point(46, -58),
    new Phaser.Geom.Point(70, -82),
    new Phaser.Geom.Point(15, -71),
    new Phaser.Geom.Point(4, -51)
  ], true);
  opening.lineStyle(2, 0x7b4e29, 0.8);
  opening.strokeRoundedRect(-46, -62, 92, 26, 7);

  const bottles = [-24, 0, 24].map((x, index) => view.scene.add.image(
    x,
    -60 - (index === 1 ? 5 : 0),
    WATER_BOTTLE_KEY
  )
    .setOrigin(0.5, 1)
    .setDisplaySize(18, 47)
    .setAngle(index === 0 ? -5 : index === 2 ? 5 : 0));

  const root = view.scene.add.container(0, 0, [opening, ...bottles])
    .setDepth(25.3)
    .setVisible(false)
    .setName("water-case-open-composition");

  const composition = { root, opening, bottles };
  compositions.set(owner, composition);
  view.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    root.destroy(true);
    compositions.delete(owner);
  });
  return composition;
}

function syncComposition(
  view: RestockActorInternals,
  composition: WaterCaseOpenComposition,
  visible: boolean
): void {
  if (!visible || !view.caseBox.visible || !view.scene.textures.exists(WATER_BOTTLE_KEY)) {
    composition.root.setVisible(false);
    return;
  }

  const referenceWidth = Math.max(1, view.caseBox.displayWidth);
  const scale = Phaser.Math.Clamp(referenceWidth / 132, 0.72, 1.55);
  composition.root
    .setPosition(view.caseBox.x, view.caseBox.y)
    .setScale(scale)
    .setAngle(view.caseBox.angle)
    .setDepth(view.caseBox.depth + 0.25)
    .setAlpha(view.caseBox.alpha)
    .setVisible(true);
}
