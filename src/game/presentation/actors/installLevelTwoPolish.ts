import Phaser from "phaser";
import type {
  RestockSceneAction,
  RestockSceneSnapshot
} from "../../application/RestockSceneController";
import type { RestockStarterMarketPresentationContext } from "../context/StarterMarketPresentationContext";
import { IntegratedBeverageCoolerView } from "../fixtures/IntegratedBeverageCoolerView";
import { StarterMarketScene } from "../scenes/StarterMarketScene";
import type { VisualPoint } from "../visual/StarterMarketVisualSpec";
import { RestockActorView } from "./RestockActorView";

const PROMOTION_LEVEL_ID = "starter-level-002";
const WATER_BOTTLE_KEY = "product-water-bottle";
const NORMALIZED_WATER_BOTTLE_KEY = "level-two-water-bottle-normalized";
const WATER_BOTTLE_SIZE = Object.freeze({ width: 30, height: 70 });
const CART_WATER_BOTTLE_SIZE = Object.freeze({ width: 20, height: 54 });
const WATER_BOTTLE_NAMES = Object.freeze([
  "restock-level-two-water-a",
  "restock-level-two-water-b",
  "restock-level-two-water-c"
]);
const AUTO_COLLECT_RADIUS = 132;
const AUTO_LOAD_RADIUS = 148;
const AUTO_PARK_RADIUS = 170;
const CART_BATCH_RADIUS = 108;
const COOLER_PLACE_RADIUS = 138;

interface RestockActorInternals {
  readonly scene: Phaser.Scene;
  readonly config: {
    readonly cartDestination: VisualPoint;
  };
  readonly caseBox: Phaser.GameObjects.Image;
  readonly handProduct: Phaser.GameObjects.Image;
  readonly currentSnapshot?: RestockSceneSnapshot;
}

interface CoolerInternals {
  readonly scene: Phaser.Scene;
}

interface CoolerPrototypeInternals {
  createStockBottle(
    this: IntegratedBeverageCoolerView,
    rowIndex: number,
    itemIndex: number,
    animate: boolean
  ): Phaser.GameObjects.Image;
}

interface LevelTwoSceneInternals {
  readonly context: RestockStarterMarketPresentationContext;
  readonly controller: {
    snapshot(): RestockSceneSnapshot;
  };
  readonly actors?: RestockActorView;
  readonly target?: {
    sync(bounds: undefined, enabled: boolean): void;
  };
  readonly hud?: {
    setActionEnabled(enabled: boolean): void;
  };
  readonly interactionGate: {
    isReady(): boolean;
  };
  readonly rush: {
    snapshot(now: number): {
      readonly activeRowIndex?: number;
      readonly complete: boolean;
    };
  };
  readonly memoryPreviewActive: boolean;
  dispatchSceneAction(action: RestockSceneAction, feedback?: boolean): boolean;
  selectRushRow(rowIndex: number): void;
}

interface LevelTwoContextState {
  carryingBatch: boolean;
  restockStarted: boolean;
  lastAutoAction?: RestockSceneAction;
}

interface PlaceControl {
  readonly root: Phaser.GameObjects.Container;
  readonly button: Phaser.GameObjects.Arc;
  readonly label: Phaser.GameObjects.Text;
}

const contextStateByScene = new WeakMap<StarterMarketScene, LevelTwoContextState>();
const placeControlByScene = new WeakMap<StarterMarketScene, PlaceControl>();

const isPromotionLevel = (): boolean => (
  document.body.dataset.activeLevel === PROMOTION_LEVEL_ID
);

const ensureNormalizedWaterTexture = (scene: Phaser.Scene): string => {
  if (scene.textures.exists(NORMALIZED_WATER_BOTTLE_KEY)) return NORMALIZED_WATER_BOTTLE_KEY;
  if (!scene.textures.exists(WATER_BOTTLE_KEY)) return WATER_BOTTLE_KEY;

  const source = scene.textures.get(WATER_BOTTLE_KEY).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const width = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
  const height = source instanceof HTMLImageElement ? source.naturalHeight : source.height;
  if (!width || !height) return WATER_BOTTLE_KEY;

  const scratch = document.createElement("canvas");
  scratch.width = width;
  scratch.height = height;
  const scratchContext = scratch.getContext("2d", { willReadFrequently: true });
  if (!scratchContext) return WATER_BOTTLE_KEY;
  scratchContext.drawImage(source, 0, 0, width, height);

  const pixels = scratchContext.getImageData(0, 0, width, height).data;
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = pixels[(y * width + x) * 4 + 3] ?? 0;
      if (alpha <= 8) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < left || bottom < top) return WATER_BOTTLE_KEY;

  const cropWidth = right - left + 1;
  const cropHeight = bottom - top + 1;
  const texture = scene.textures.createCanvas(
    NORMALIZED_WATER_BOTTLE_KEY,
    WATER_BOTTLE_SIZE.width,
    WATER_BOTTLE_SIZE.height
  );
  if (!texture) return WATER_BOTTLE_KEY;

  const context = texture.context;
  context.clearRect(0, 0, WATER_BOTTLE_SIZE.width, WATER_BOTTLE_SIZE.height);
  const scale = Math.min(
    WATER_BOTTLE_SIZE.width / cropWidth,
    WATER_BOTTLE_SIZE.height / cropHeight
  );
  const drawWidth = cropWidth * scale;
  const drawHeight = cropHeight * scale;
  context.drawImage(
    source,
    left,
    top,
    cropWidth,
    cropHeight,
    (WATER_BOTTLE_SIZE.width - drawWidth) / 2,
    WATER_BOTTLE_SIZE.height - drawHeight,
    drawWidth,
    drawHeight
  );
  texture.refresh();
  return NORMALIZED_WATER_BOTTLE_KEY;
};

/**
 * Level 2 keeps product-specific water art and adds the mature contextual work
 * loop: walk into a work zone, auto-pick the batch, then use one PLACE action
 * at the cooler. The shared controller still owns stock counts and rewards.
 */
const originalSync = RestockActorView.prototype.sync;
RestockActorView.prototype.sync = function syncLevelTwoWaterVisual(
  this: RestockActorView,
  snapshot: RestockSceneSnapshot
): void {
  originalSync.call(this, snapshot);
  if (!isPromotionLevel()) return;

  const view = this as unknown as RestockActorInternals;
  const waterTexture = ensureNormalizedWaterTexture(view.scene);
  if (view.scene.textures.exists(waterTexture)) {
    view.handProduct
      .setTexture(waterTexture)
      .setDisplaySize(CART_WATER_BOTTLE_SIZE.width, CART_WATER_BOTTLE_SIZE.height);
  }
  syncPromotionCartWater(view, snapshot);
  document.body.dataset.levelTwoActorControl = "contextual-walk-auto-pickup-place";
  document.body.dataset.levelTwoProductVisual = "normalized-water-bottle-only";
};

const originalUpdate = RestockActorView.prototype.update;
RestockActorView.prototype.update = function updateLevelTwoWaterVisual(
  this: RestockActorView,
  deltaMs: number
): void {
  originalUpdate.call(this, deltaMs);
  if (!isPromotionLevel()) return;

  const view = this as unknown as RestockActorInternals;
  const waterTexture = ensureNormalizedWaterTexture(view.scene);
  if (view.scene.textures.exists(waterTexture)) {
    view.handProduct
      .setTexture(waterTexture)
      .setDisplaySize(CART_WATER_BOTTLE_SIZE.width, CART_WATER_BOTTLE_SIZE.height);
  }
  const snapshot = view.currentSnapshot;
  if (snapshot) syncPromotionCartWater(view, snapshot);
};

const coolerPrototype = IntegratedBeverageCoolerView.prototype as unknown as CoolerPrototypeInternals;
const originalCreateStockBottle = coolerPrototype.createStockBottle;
coolerPrototype.createStockBottle = function createLevelTwoWaterStock(
  this: IntegratedBeverageCoolerView,
  rowIndex: number,
  itemIndex: number,
  animate: boolean
): Phaser.GameObjects.Image {
  const bottle = originalCreateStockBottle.call(this, rowIndex, itemIndex, animate);
  const view = this as unknown as CoolerInternals;
  if (!isPromotionLevel()) return bottle;
  const waterTexture = ensureNormalizedWaterTexture(view.scene);
  if (!view.scene.textures.exists(waterTexture)) return bottle;

  // The shared restock animation tweens scale back to 1. The texture itself is
  // therefore normalized to shelf size so it can never grow back to source PNG size.
  bottle
    .setTexture(waterTexture)
    .setDisplaySize(WATER_BOTTLE_SIZE.width, WATER_BOTTLE_SIZE.height);
  return bottle;
};

const originalSceneUpdate = StarterMarketScene.prototype.update;
StarterMarketScene.prototype.update = function updateLevelTwoContextualWork(
  this: StarterMarketScene,
  time: number,
  delta: number
): void {
  originalSceneUpdate.call(this, time, delta);
  if (!isPromotionLevel()) return;
  syncLevelTwoContextualWork(this);
};

function syncLevelTwoContextualWork(scene: StarterMarketScene): void {
  const view = scene as unknown as LevelTwoSceneInternals;
  const actors = view.actors;
  if (!actors) return;

  const state = contextState(scene);
  const snapshot = view.controller.snapshot();

  // L2 is controlled by movement + proximity + one contextual PLACE button.
  // Retire the old clickable target/HUD action so two control languages do not compete.
  view.target?.sync(undefined, false);
  view.hud?.setActionEnabled(false);

  if (snapshot.step !== "restock") {
    state.carryingBatch = false;
    state.restockStarted = false;
    setPlaceControlVisible(scene, false);

    if (!view.interactionGate.isReady()) return;
    switch (snapshot.step) {
      case "collect":
        if (actors.isNear(view.context.world.backroomBox, AUTO_COLLECT_RADIUS)) {
          autoDispatch(scene, view, state, "PICK_BOX");
        }
        return;
      case "load":
        if (actors.isNear(view.context.world.cartStart, AUTO_LOAD_RADIUS)) {
          if (autoDispatch(scene, view, state, "LOAD_CART")) {
            autoDispatch(scene, view, state, "PUSH_CART", false);
          }
        }
        return;
      case "push":
        if (actors.isNear(view.context.world.cartStart, AUTO_LOAD_RADIUS)) {
          autoDispatch(scene, view, state, "PUSH_CART", false);
        }
        return;
      case "park":
        if (actors.isNear(view.context.world.cartCooler, AUTO_PARK_RADIUS)) {
          if (autoDispatch(scene, view, state, "PARK_CART")) {
            autoDispatch(scene, view, state, "OPEN_BOX", false);
          }
        }
        return;
      case "open":
        if (actors.isNear(view.context.world.cartCooler, AUTO_PARK_RADIUS)) {
          autoDispatch(scene, view, state, "OPEN_BOX");
        }
        return;
      case "complete":
        return;
    }
  }

  state.restockStarted = true;
  const actorView = actors as unknown as RestockActorInternals;
  if (view.memoryPreviewActive || !view.interactionGate.isReady()) {
    actorView.handProduct.setVisible(state.carryingBatch && !view.memoryPreviewActive);
    setPlaceControlVisible(scene, false);
    return;
  }

  const player = actors.position();
  const cartPickupPoint = {
    x: view.context.world.cartCooler.x + 42,
    y: view.context.world.cartCooler.y - 6
  };
  const coolerPlacePoint = {
    x: view.context.world.beverageCooler.x,
    y: view.context.world.cartCooler.y - 8
  };

  if (!state.carryingBatch && distance(player, cartPickupPoint) <= CART_BATCH_RADIUS) {
    state.carryingBatch = true;
    actorView.handProduct.setVisible(true);
    showAutoPickupFeedback(scene, cartPickupPoint);
    document.body.dataset.levelTwoBatch = "carrying-3";
  }

  actorView.handProduct.setVisible(state.carryingBatch);
  const rushSnapshot = view.rush.snapshot(scene.time.now);
  const placeReady = Boolean(
    state.carryingBatch &&
    rushSnapshot.activeRowIndex !== undefined &&
    !rushSnapshot.complete &&
    distance(player, coolerPlacePoint) <= COOLER_PLACE_RADIUS
  );
  setPlaceControlVisible(scene, placeReady);
  document.body.dataset.levelTwoContextAction = placeReady ? "place-ready" : (
    state.carryingBatch ? "move-to-cooler" : "move-to-cart"
  );
}

function contextState(scene: StarterMarketScene): LevelTwoContextState {
  const existing = contextStateByScene.get(scene);
  if (existing) return existing;
  const created: LevelTwoContextState = {
    carryingBatch: false,
    restockStarted: false
  };
  contextStateByScene.set(scene, created);
  return created;
}

function autoDispatch(
  scene: StarterMarketScene,
  view: LevelTwoSceneInternals,
  state: LevelTwoContextState,
  action: RestockSceneAction,
  feedback = true
): boolean {
  if (state.lastAutoAction === action && !view.interactionGate.isReady()) return false;
  const accepted = view.dispatchSceneAction(action, feedback);
  if (!accepted) return false;
  state.lastAutoAction = action;
  document.body.dataset.levelTwoAutoAction = action.toLowerCase();
  return true;
}

function ensurePlaceControl(scene: StarterMarketScene): PlaceControl {
  const existing = placeControlByScene.get(scene);
  if (existing) return existing;

  const halo = scene.add.circle(0, 0, 72, 0x73d27b, 0.13)
    .setStrokeStyle(3, 0xcdf5c9, 0.5);
  const button = scene.add.circle(0, 0, 58, 0x4f9a52, 0.98)
    .setStrokeStyle(4, 0xbfe8a8, 0.95)
    .setName("level-two-place-action");
  const hand = scene.add.text(0, -10, "✋", {
    fontFamily: "Arial",
    fontSize: "42px",
    color: "#ffffff"
  }).setOrigin(0.5);
  const label = scene.add.text(0, 48, "PLACE", {
    fontFamily: "Arial",
    fontSize: "17px",
    color: "#ffffff",
    fontStyle: "bold",
    stroke: "#102516",
    strokeThickness: 5
  }).setOrigin(0.5);
  const keyHint = scene.add.text(0, 76, "E / SPACE", {
    fontFamily: "Arial",
    fontSize: "10px",
    color: "#d8f0d3",
    fontStyle: "bold"
  }).setOrigin(0.5);

  const root = scene.add.container(1480, 690, [halo, button, hand, label, keyHint])
    .setDepth(220)
    .setScrollFactor(0)
    .setVisible(false)
    .setName("level-two-context-place-control");

  const activate = (): void => activatePlace(scene);
  button.on("pointerdown", activate);
  scene.input.keyboard?.on("keydown-E", activate);
  scene.input.keyboard?.on("keydown-SPACE", activate);

  const control = { root, button, label };
  placeControlByScene.set(scene, control);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.input.keyboard?.off("keydown-E", activate);
    scene.input.keyboard?.off("keydown-SPACE", activate);
    root.destroy(true);
    placeControlByScene.delete(scene);
    contextStateByScene.delete(scene);
  });
  return control;
}

function setPlaceControlVisible(scene: StarterMarketScene, visible: boolean): void {
  const control = ensurePlaceControl(scene);
  control.root.setVisible(visible);
  control.button.disableInteractive();
  if (visible) control.button.setInteractive({ useHandCursor: true });
}

function activatePlace(scene: StarterMarketScene): void {
  if (!isPromotionLevel()) return;
  const view = scene as unknown as LevelTwoSceneInternals;
  const state = contextState(scene);
  if (!state.carryingBatch || view.memoryPreviewActive || !view.interactionGate.isReady()) return;

  const rushSnapshot = view.rush.snapshot(scene.time.now);
  const rowIndex = rushSnapshot.activeRowIndex;
  if (rowIndex === undefined || rushSnapshot.complete) return;

  const before = view.controller.snapshot().stockedRows;
  view.selectRushRow(rowIndex);
  const after = view.controller.snapshot().stockedRows;
  if (after <= before) return;

  state.carryingBatch = false;
  const actors = view.actors as unknown as RestockActorInternals | undefined;
  actors?.handProduct.setVisible(false);
  document.body.dataset.levelTwoBatch = "empty";
  setPlaceControlVisible(scene, false);
}

function showAutoPickupFeedback(scene: StarterMarketScene, point: VisualPoint): void {
  const label = scene.add.text(point.x, point.y - 110, "AUTO PICKUP · 3 WATER", {
    fontFamily: "Arial",
    fontSize: "14px",
    color: "#efffea",
    fontStyle: "bold",
    backgroundColor: "#173d22",
    padding: { x: 10, y: 6 }
  }).setOrigin(0.5).setDepth(215);
  scene.tweens.add({
    targets: label,
    y: label.y - 18,
    alpha: 0,
    duration: 760,
    ease: "Sine.Out",
    onComplete: () => label.destroy()
  });
}

function distance(a: VisualPoint, b: VisualPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function syncPromotionCartWater(
  view: RestockActorInternals,
  snapshot: RestockSceneSnapshot
): void {
  const show = snapshot.step === "restock";
  const x = view.config.cartDestination.x;
  const y = view.config.cartDestination.y - 86;
  const waterTexture = ensureNormalizedWaterTexture(view.scene);

  WATER_BOTTLE_NAMES.forEach((name, index) => {
    const bottle = getOrCreateWaterBottle(view.scene, name, waterTexture);
    bottle
      .setTexture(waterTexture)
      .setPosition(x + (index - 1) * 34, y + Math.abs(index - 1) * 3)
      .setDisplaySize(CART_WATER_BOTTLE_SIZE.width, CART_WATER_BOTTLE_SIZE.height)
      .setVisible(show)
      .setDepth(25.2 + index * 0.02);
  });

  if (show) view.caseBox.setVisible(false);
}

function getOrCreateWaterBottle(
  scene: Phaser.Scene,
  name: string,
  textureKey: string
): Phaser.GameObjects.Image {
  const existing = scene.children.getByName(name);
  if (existing instanceof Phaser.GameObjects.Image) return existing;
  return scene.add.image(0, 0, textureKey)
    .setOrigin(0.5, 1)
    .setVisible(false)
    .setName(name);
}
