import Phaser from "phaser";
import { GameScene } from "./scenes/GameScene";
import { gameSession } from "./systems/GameSession";

type ProductId = "cola" | "water" | "milk";
type StoryView = "overview" | "drinks" | "stockroom" | "checkout";

type RuntimeBox = {
  productId: ProductId;
  loaded: boolean;
  image: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
  homeX: number;
  homeY: number;
};

type StoryController = {
  view: StoryView;
  transitioning: boolean;
  customerBusy: boolean;
};

type PresenceController = {
  guideLabel: Phaser.GameObjects.Text;
};

type RuntimeGame = Phaser.Scene & {
  cart: Phaser.GameObjects.Container;
  boxes: RuntimeBox[];
  selectedBox?: RuntimeBox;
  loadedProducts: ProductId[];
  shelfSlots: Array<{ productId: ProductId; product?: Phaser.GameObjects.Image }>;
  cartAtShelf: boolean;
  movingCart: boolean;
  restockBusy: boolean;
  phase: "PREPARE" | "OPEN" | "RUSH" | "CLOSING" | "RESULT";
  shiftEnded: boolean;
  loadSelectedBox: () => void;
  returnBoxHome: (box: RuntimeBox) => void;
  __dayTwoStory?: StoryController;
  __dayTwoPresence?: PresenceController;
  __dayTwoInteractionFix?: InteractionFixController;
};

type GamePrototype = {
  create: (...args: unknown[]) => void;
  isOverCart: (image: Phaser.GameObjects.Image) => boolean;
};

type ManualHandle = {
  box: RuntimeBox;
  hit: Phaser.GameObjects.Rectangle;
};

type InteractionFixController = {
  handles: ManualHandle[];
  activeBox?: RuntimeBox;
  pointerOffsetX: number;
  pointerOffsetY: number;
  postUpdate: () => void;
  pointerMove: (pointer: Phaser.Input.Pointer) => void;
  pointerUp: (pointer: Phaser.Input.Pointer) => void;
};

const prototype = GameScene.prototype as unknown as GamePrototype;
const originalCreate = prototype.create;
const originalIsOverCart = prototype.isOverCart;

prototype.isOverCart = function isOverCartDayTwo(image: Phaser.GameObjects.Image): boolean {
  const scene = this as unknown as RuntimeGame;
  const story = scene.__dayTwoStory;

  if (gameSession.day === "day02" && story?.view === "stockroom") {
    if (isInsideDayTwoCart(scene, image)) return true;
  }

  return originalIsOverCart.call(this, image);
};

prototype.create = function createDayTwoInteractionFix(...args: unknown[]): void {
  originalCreate.apply(this, args);
  const scene = this as unknown as RuntimeGame;
  if (gameSession.day !== "day02" || !scene.__dayTwoStory) return;

  installInteractionFix(scene);
};

function installInteractionFix(scene: RuntimeGame): void {
  destroyExisting(scene);

  const handles = scene.boxes
    .filter((box) => box.productId === "cola")
    .map((box) => {
      const hit = scene.add.rectangle(box.image.x, box.image.y - 56, 142, 142, 0xffffff, 0.001)
        .setDepth(9_200)
        .setInteractive({ useHandCursor: true })
        .setVisible(false);
      hit.setData("dayTwoManualHandle", true);
      return { box, hit };
    });

  const controller: InteractionFixController = {
    handles,
    pointerOffsetX: 0,
    pointerOffsetY: 0,
    postUpdate: () => {
      synchronizeManualHandles(scene, controller);
      preserveDraggedBoxes(scene);
      forceEnglishGuide(scene);
    },
    pointerMove: (pointer) => moveManualDrag(scene, controller, pointer),
    pointerUp: (pointer) => finishManualDrag(scene, controller, pointer)
  };
  scene.__dayTwoInteractionFix = controller;

  handles.forEach(({ box, hit }) => {
    hit.on("pointerdown", (pointer: Phaser.Input.Pointer) => beginManualDrag(scene, controller, box, pointer));
  });

  scene.input.on("pointermove", controller.pointerMove);
  scene.input.on("pointerup", controller.pointerUp);
  scene.input.on("pointerupoutside", controller.pointerUp);
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, controller.postUpdate);

  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => destroyExisting(scene));
  synchronizeManualHandles(scene, controller);
}

function beginManualDrag(
  scene: RuntimeGame,
  controller: InteractionFixController,
  box: RuntimeBox,
  pointer: Phaser.Input.Pointer
): void {
  if (!isDayTwoStockroom(scene, box)) return;

  controller.activeBox = box;
  controller.pointerOffsetX = box.image.x - pointer.worldX;
  controller.pointerOffsetY = box.image.y - pointer.worldY;
  scene.selectedBox = box;

  box.image
    .setData("dayTwoDragging", true)
    .setData("dayTwoDragX", box.image.x)
    .setData("dayTwoDragY", box.image.y)
    .setVisible(true)
    .setDepth(9_150)
    .setTint(0xfff0a6);
  box.shadow.setVisible(false);
}

function moveManualDrag(
  scene: RuntimeGame,
  controller: InteractionFixController,
  pointer: Phaser.Input.Pointer
): void {
  const box = controller.activeBox;
  if (!box || !pointer.isDown || !box.image.active) return;

  const dragX = Phaser.Math.Clamp(pointer.worldX + controller.pointerOffsetX, 45, 1260);
  const dragY = Phaser.Math.Clamp(pointer.worldY + controller.pointerOffsetY, 260, 1070);

  box.image
    .setData("dayTwoDragX", dragX)
    .setData("dayTwoDragY", dragY)
    .setPosition(dragX, dragY)
    .setVisible(true)
    .setDepth(9_150);
  box.shadow.setVisible(false);
}

function finishManualDrag(
  scene: RuntimeGame,
  controller: InteractionFixController,
  _pointer: Phaser.Input.Pointer
): void {
  const box = controller.activeBox;
  if (!box) return;
  controller.activeBox = undefined;

  const droppedOnCart = isInsideDayTwoCart(scene, box.image);
  box.image.setData("dayTwoDragging", false).clearTint();

  if (droppedOnCart) {
    box.image.setData("dayTwoLoading", true);
    scene.selectedBox = box;
    scene.loadSelectedBox();
    scene.time.delayedCall(500, () => {
      if (box.image.active) box.image.setData("dayTwoLoading", false);
    });
    return;
  }

  scene.returnBoxHome(box);
}

function synchronizeManualHandles(scene: RuntimeGame, controller: InteractionFixController): void {
  const stockroomReady = scene.__dayTwoStory?.view === "stockroom" && !scene.shiftEnded;

  controller.handles.forEach(({ box, hit }) => {
    const dragging = controller.activeBox === box || Boolean(box.image.getData("dayTwoDragging"));
    const available = stockroomReady && !box.loaded && !box.image.getData("dayTwoLoading");

    // The high-depth transparent handle owns Day 2 dragging. Disable the old image
    // input so legacy listeners and room overlays cannot compete for the pointer.
    if (box.image.input) box.image.input.enabled = false;

    hit
      .setVisible(available)
      .setPosition(box.image.x, box.image.y - 56)
      .setDisplaySize(dragging ? 170 : 142, dragging ? 170 : 142);
    if (hit.input) hit.input.enabled = available;
  });
}

function preserveDraggedBoxes(scene: RuntimeGame): void {
  if (scene.__dayTwoStory?.view !== "stockroom") return;

  scene.boxes.forEach((box) => {
    const image = box.image;

    if (image.getData("dayTwoLoading")) {
      image.setVisible(false);
      box.shadow.setVisible(false);
      return;
    }

    if (!image.getData("dayTwoDragging")) return;

    const dragX = Number(image.getData("dayTwoDragX"));
    const dragY = Number(image.getData("dayTwoDragY"));
    if (!Number.isFinite(dragX) || !Number.isFinite(dragY)) return;

    image.setVisible(true).setPosition(dragX, dragY).setDepth(9_150);
    box.shadow.setVisible(false);
  });
}

function forceEnglishGuide(scene: RuntimeGame): void {
  const story = scene.__dayTwoStory;
  const presence = scene.__dayTwoPresence;
  if (!story || !presence?.guideLabel?.visible || story.transitioning || scene.shiftEnded) return;

  if (story.view === "overview") {
    presence.guideLabel.setText("STEP 1 · ENTER DRINKS AISLE");
    return;
  }

  if (story.view === "drinks") {
    const filled = scene.shelfSlots.filter((slot) => slot.productId === "cola" && slot.product).length;
    const colaOnCart = scene.loadedProducts.filter((product) => product === "cola").length;

    if (!scene.cartAtShelf || colaOnCart === 0) {
      presence.guideLabel.setText("STEP 2 · GO TO STOCKROOM");
    } else if (filled < 2) {
      presence.guideLabel.setText("STEP 3 · TAP SHELF TO RESTOCK");
    }
    return;
  }

  if (story.view === "stockroom") {
    const required = scene.phase === "PREPARE" ? 2 : 1;
    const colaOnCart = scene.loadedProducts.filter((product) => product === "cola").length;

    if (scene.selectedBox) {
      presence.guideLabel.setText("DRAG THE CASE ONTO THE CART");
    } else if (colaOnCart < required) {
      presence.guideLabel.setText(`LOAD COLA CASES · ${colaOnCart}/${required}`);
    } else {
      presence.guideLabel.setText("CARGO READY · RETURN TO DRINKS AISLE");
    }
    return;
  }

  presence.guideLabel.setText("FINISH THE SHIFT");
}

function isDayTwoStockroom(scene: RuntimeGame, box: RuntimeBox): boolean {
  return (
    scene.__dayTwoStory?.view === "stockroom" &&
    box.productId === "cola" &&
    !box.loaded &&
    !scene.cartAtShelf &&
    !scene.movingCart &&
    !scene.restockBusy
  );
}

function isInsideDayTwoCart(scene: RuntimeGame, image: Phaser.GameObjects.Image): boolean {
  const bounds = scene.cart.getBounds();
  const zone = new Phaser.Geom.Rectangle(
    bounds.x - 150,
    bounds.y - 170,
    bounds.width + 300,
    bounds.height + 300
  );
  return zone.contains(image.x, image.y) ||
    Phaser.Math.Distance.Between(image.x, image.y, scene.cart.x, scene.cart.y - 105) <= 260;
}

function destroyExisting(scene: RuntimeGame): void {
  const existing = scene.__dayTwoInteractionFix;
  if (!existing) return;

  scene.events.off(Phaser.Scenes.Events.POST_UPDATE, existing.postUpdate);
  scene.input.off("pointermove", existing.pointerMove);
  scene.input.off("pointerup", existing.pointerUp);
  scene.input.off("pointerupoutside", existing.pointerUp);
  existing.handles.forEach(({ hit }) => hit.destroy());
  scene.__dayTwoInteractionFix = undefined;
}