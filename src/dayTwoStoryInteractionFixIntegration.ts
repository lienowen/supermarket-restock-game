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
  __dayTwoStory?: StoryController;
  __dayTwoPresence?: PresenceController;
};

type GamePrototype = {
  create: (...args: unknown[]) => void;
  isOverCart: (image: Phaser.GameObjects.Image) => boolean;
};

type InteractionFixController = {
  postUpdate: () => void;
};

const prototype = GameScene.prototype as unknown as GamePrototype;
const originalCreate = prototype.create;
const originalIsOverCart = prototype.isOverCart;

prototype.isOverCart = function isOverCartDayTwo(image: Phaser.GameObjects.Image): boolean {
  const scene = this as unknown as RuntimeGame;
  const story = scene.__dayTwoStory;

  if (gameSession.day === "day02" && story?.view === "stockroom") {
    const bounds = scene.cart.getBounds();
    const generousDropZone = new Phaser.Geom.Rectangle(
      bounds.x - 110,
      bounds.y - 130,
      bounds.width + 220,
      bounds.height + 220
    );

    if (generousDropZone.contains(image.x, image.y)) return true;

    const basketX = scene.cart.x;
    const basketY = scene.cart.y - 105;
    if (Phaser.Math.Distance.Between(image.x, image.y, basketX, basketY) <= 210) return true;
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
  scene.boxes.forEach((box) => {
    const image = box.image;

    image.on("dragstart", () => {
      if (!isDayTwoStockroom(scene, box)) return;
      image.setData("dayTwoDragging", true);
      image.setData("dayTwoDragX", image.x);
      image.setData("dayTwoDragY", image.y);
      box.shadow.setVisible(false);
    });

    image.on("drag", (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
      if (!image.getData("dayTwoDragging")) return;
      image.setData("dayTwoDragX", dragX);
      image.setData("dayTwoDragY", dragY);
      image.setPosition(dragX, dragY).setVisible(true).setDepth(9_050);
      box.shadow.setVisible(false);
    });

    image.on("dragend", () => {
      if (!image.getData("dayTwoDragging")) return;

      const droppedOnCart = isInsideDayTwoCart(scene, image);
      image.setData("dayTwoDragging", false);

      if (droppedOnCart) {
        image.setData("dayTwoLoading", true);
        image.setVisible(false);
        box.shadow.setVisible(false);
        scene.time.delayedCall(450, () => {
          if (image.active) image.setData("dayTwoLoading", false);
        });
      }
    });
  });

  const controller: InteractionFixController = {
    postUpdate: () => {
      preserveDraggedBoxes(scene);
      forceEnglishGuide(scene);
    }
  };

  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, controller.postUpdate);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, controller.postUpdate);
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

    image.setVisible(true).setPosition(dragX, dragY).setDepth(9_050);
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
    bounds.x - 110,
    bounds.y - 130,
    bounds.width + 220,
    bounds.height + 220
  );
  return zone.contains(image.x, image.y) ||
    Phaser.Math.Distance.Between(image.x, image.y, scene.cart.x, scene.cart.y - 105) <= 210;
}
