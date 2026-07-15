import Phaser from "phaser";
import { GameScene } from "./scenes/GameScene";
import { gameSession } from "./systems/GameSession";

type ProductId = "cola" | "water" | "milk";
type DayTwoRoom = "main" | "stock";

type RuntimeBox = {
  loaded: boolean;
  image: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
};

type RuntimeSlot = {
  index: number;
  productId: ProductId;
  hitArea: Phaser.GameObjects.Rectangle;
  missingTag?: Phaser.GameObjects.Image;
  typeLabel?: Phaser.GameObjects.Text;
  product?: Phaser.GameObjects.Image;
};

type ArrowControl = {
  container: Phaser.GameObjects.Container;
  hit: Phaser.GameObjects.Rectangle;
};

type StableController = {
  room: DayTwoRoom;
  mainRoom: Phaser.GameObjects.Container;
  stockRoom: Phaser.GameObjects.Container;
  mainFixtures: Array<{
    productId: ProductId;
    image: Phaser.GameObjects.Image;
    empty: string;
    low: string;
    full: string;
    width: number;
    height: number;
  }>;
  clickRing: Phaser.GameObjects.Image;
  backArrow: ArrowControl;
  floorArrow: ArrowControl;
  guideExpiresAt: number;
  lastSweepAt: number;
  transitionLocked: boolean;
  monitor: () => void;
};

type RuntimeGame = Phaser.Scene & {
  phase: string;
  shiftEnded: boolean;
  boxes: RuntimeBox[];
  shelfSlots: RuntimeSlot[];
  loadedProducts: ProductId[];
  selectedBox?: RuntimeBox;
  cart: Phaser.GameObjects.Container;
  worker: Phaser.GameObjects.Image;
  cartAtShelf: boolean;
  movingCart: boolean;
  restockBusy: boolean;
  departureRequirement: () => number;
  snapCart: (destination: "WAREHOUSE" | "SALES") => void;
  showTransientHint: (message: string) => void;
  __dayTwoImmersiveStore?: StableController;
};

type GamePrototype = {
  create: (...args: unknown[]) => void;
};

type VisibleObject = Phaser.GameObjects.GameObject & {
  visible: boolean;
  depth: number;
  y: number;
  setVisible: (visible: boolean) => VisibleObject;
};

const prototype = GameScene.prototype as unknown as GamePrototype;
const originalCreate = prototype.create;

prototype.create = function createStableDayTwo(...args: unknown[]): void {
  originalCreate.apply(this, args);
  const scene = this as unknown as RuntimeGame;
  if (gameSession.day !== "day02") return;

  const controller = scene.__dayTwoImmersiveStore;
  if (!controller) return;

  installStableDayTwo(scene, controller);
};

function installStableDayTwo(scene: RuntimeGame, controller: StableController): void {
  // The immersive integration registered a continuous POST_UPDATE sweep. Remove it
  // and only run the same synchronization when gameplay state actually changes.
  scene.events.off(Phaser.Scenes.Events.POST_UPDATE, controller.monitor);

  lockHidden(scene, controller.clickRing);
  scene.tweens.killTweensOf(controller.backArrow.container);
  scene.tweens.killTweensOf(controller.floorArrow.container);
  controller.backArrow.container.setScale(1);
  controller.floorArrow.container.setScale(1);
  controller.guideExpiresAt = -Infinity;

  lockLegacySceneObjects(scene);
  installInstantRoomNavigation(scene, controller);

  let lastSignature = "";
  const synchronize = (force = false): void => {
    if (!scene.scene.isActive() || gameSession.day !== "day02") return;

    const signature = runtimeSignature(scene, controller);
    if (!force && signature === lastSignature) return;
    lastSignature = signature;

    controller.guideExpiresAt = -Infinity;
    controller.lastSweepAt = -Infinity;
    controller.monitor();
    controller.clickRing.setVisible(false);
    lockLegacySceneObjects(scene);
    stabilizeFixtureTextures(scene, controller);
    document.body.dataset.dayTwoStableRender = controller.room;
  };

  synchronize(true);

  const timer = scene.time.addEvent({
    delay: 180,
    loop: true,
    callback: synchronize
  });

  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    timer.remove(false);
    delete document.body.dataset.dayTwoStableRender;
  });
}

function installInstantRoomNavigation(scene: RuntimeGame, controller: StableController): void {
  controller.backArrow.hit.removeAllListeners("pointerdown");
  controller.floorArrow.hit.removeAllListeners("pointerdown");

  controller.backArrow.hit.on("pointerdown", () => {
    if (controller.room !== "main" || controller.transitionLocked) return;
    if (scene.shiftEnded || scene.movingCart || scene.restockBusy) return;
    if (scene.selectedBox) {
      scene.showTransientHint("Finish placing the selected case before entering the backroom.");
      return;
    }

    controller.transitionLocked = true;
    controller.room = "stock";
    if (scene.cartAtShelf) {
      scene.movingCart = true;
      scene.snapCart("WAREHOUSE");
    }
    controller.transitionLocked = false;
    controller.lastSweepAt = -Infinity;
    controller.monitor();
  });

  controller.floorArrow.hit.on("pointerdown", () => {
    if (controller.room !== "stock" || controller.transitionLocked) return;
    if (scene.shiftEnded || scene.movingCart || scene.restockBusy) return;
    if (scene.selectedBox) {
      scene.showTransientHint("Place the selected case on the cart first.");
      return;
    }

    const required = Math.max(1, scene.departureRequirement());
    if (scene.loadedProducts.length < required) {
      scene.showTransientHint(`Load ${required - scene.loadedProducts.length} more case(s) before entering the main floor.`);
      return;
    }

    controller.transitionLocked = true;
    controller.room = "main";
    scene.movingCart = true;
    scene.snapCart("SALES");
    controller.transitionLocked = false;
    controller.lastSweepAt = -Infinity;
    controller.monitor();
  });
}

function runtimeSignature(scene: RuntimeGame, controller: StableController): string {
  return [
    controller.room,
    controller.transitionLocked ? "1" : "0",
    scene.phase,
    scene.shiftEnded ? "1" : "0",
    scene.cartAtShelf ? "1" : "0",
    scene.movingCart ? "1" : "0",
    scene.restockBusy ? "1" : "0",
    scene.selectedBox ? "1" : "0",
    scene.loadedProducts.join(","),
    scene.boxes.map((box) => (box.loaded ? "1" : "0")).join(""),
    scene.shelfSlots.map((slot) => (slot.product?.active ? "1" : "0")).join("")
  ].join("|");
}

function stabilizeFixtureTextures(scene: RuntimeGame, controller: StableController): void {
  for (const fixture of controller.mainFixtures) {
    const slots = scene.shelfSlots.filter((slot) => slot.productId === fixture.productId);
    const filled = slots.filter((slot) => Boolean(slot.product?.active)).length;
    const state = filled === 0 ? "empty" : filled < slots.length ? "low" : "full";
    const targetTexture = fixture[state];
    const currentTexture = fixture.image.texture.key;

    if (currentTexture !== targetTexture) {
      fixture.image.setTexture(targetTexture).setDisplaySize(fixture.width, fixture.height);
    }
  }
}

function lockLegacySceneObjects(scene: RuntimeGame): void {
  const protectedObjects = new Set<Phaser.GameObjects.GameObject>([
    scene.cart,
    scene.worker,
    ...scene.boxes.flatMap((box) => [box.image, box.shadow]),
    ...scene.shelfSlots.map((slot) => slot.hitArea)
  ]);

  for (const slot of scene.shelfSlots) {
    if (slot.missingTag) lockHidden(scene, slot.missingTag);
    if (slot.typeLabel) lockHidden(scene, slot.typeLabel);
    if (slot.product) lockHidden(scene, slot.product);
  }

  for (const child of [...scene.children.list]) {
    if (protectedObjects.has(child) || child.getData("dayTwoImmersive")) continue;
    if (containsLegacyInstruction(child)) {
      lockHidden(scene, child as VisibleObject);
      continue;
    }

    const display = child as VisibleObject;
    if (!display.active || display.depth >= 50) continue;

    if (child instanceof Phaser.GameObjects.Container) {
      lockHidden(scene, display);
      continue;
    }

    if (
      child instanceof Phaser.GameObjects.Text ||
      child instanceof Phaser.GameObjects.Image ||
      child instanceof Phaser.GameObjects.Rectangle ||
      child instanceof Phaser.GameObjects.Ellipse
    ) {
      if (display.y >= 150 && display.y <= 1085) lockHidden(scene, display);
    }
  }
}

function containsLegacyInstruction(object: Phaser.GameObjects.GameObject): boolean {
  const texts: string[] = [];
  collectText(object, texts);
  const value = texts.join(" ").toUpperCase();
  return (
    value.includes("FINISH THE OPENING SHELF") ||
    value.includes("PROMOTION ROOM UNLOCKS") ||
    value.includes("NO STOCK")
  );
}

function collectText(object: Phaser.GameObjects.GameObject, output: string[]): void {
  if (object instanceof Phaser.GameObjects.Text) {
    output.push(object.text);
    return;
  }
  if (!(object instanceof Phaser.GameObjects.Container)) return;
  for (const child of object.list) collectText(child, output);
}

function lockHidden(scene: Phaser.Scene, object: VisibleObject): void {
  if (!object.active || object.getData("dayTwoLockedHidden")) return;
  scene.tweens.killTweensOf(object);
  object.setVisible(false);
  object.setData("dayTwoLockedHidden", true);

  const originalSetVisible = object.setVisible.bind(object);
  const lockedSetter = (_visible: boolean): VisibleObject => originalSetVisible(false);
  (object as unknown as { setVisible: (visible: boolean) => VisibleObject }).setVisible = lockedSetter;
}
