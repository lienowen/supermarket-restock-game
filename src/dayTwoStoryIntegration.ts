import Phaser from "phaser";
import { Assets } from "./assets";
import { GameScene } from "./scenes/GameScene";
import { gameSession } from "./systems/GameSession";
import { SupermarketSceneAssets, SupermarketSceneAssetPaths } from "./supermarketSceneAssets";

type ProductId = "cola" | "water" | "milk";
type StoryView = "overview" | "drinks" | "stockroom" | "checkout";
type DrinksState = "empty" | "mid" | "full";

type RuntimeBox = {
  productId: ProductId;
  loaded: boolean;
  image: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
  positionIndex: number;
  homeX: number;
  homeY: number;
};

type RuntimeSlot = {
  productId: ProductId;
  hitArea: Phaser.GameObjects.Rectangle;
  missingTag?: Phaser.GameObjects.Image;
  typeLabel?: Phaser.GameObjects.Text;
  product?: Phaser.GameObjects.Image;
  productBottomY: number;
  reservedForCustomer: boolean;
};

type RuntimeGame = Phaser.Scene & {
  phase: "PREPARE" | "OPEN" | "RUSH" | "CLOSING" | "RESULT";
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
  stocked: number;
  soldCount: number;
  money: number;
  stars: number;
  purchaseEvent?: Phaser.Time.TimerEvent;
  snapCart: (destination: "WAREHOUSE" | "SALES") => void;
  showTransientHint: (message: string) => void;
  updateCartCount: () => void;
  updateHud: () => void;
  updateStars: () => void;
  advanceBusinessPhase: () => void;
  openStore: () => void;
  endShift: () => void;
  __dayTwoStory?: DayTwoStoryController;
};

type GamePrototype = {
  preload: () => void;
  create: (...args: unknown[]) => void;
};

type StoryButton = {
  container: Phaser.GameObjects.Container;
  label: Phaser.GameObjects.Text;
  hit: Phaser.GameObjects.Rectangle;
};

type DayTwoStoryController = {
  view: StoryView;
  transitioning: boolean;
  customerBusy: boolean;
  closingTransitioned: boolean;
  introShown: boolean;
  background: Phaser.GameObjects.Image;
  vignette: Phaser.GameObjects.Rectangle;
  locationText: Phaser.GameObjects.Text;
  radioText: Phaser.GameObjects.Text;
  actionText: Phaser.GameObjects.Text;
  overviewHotspot: StoryButton;
  overviewButton: StoryButton;
  stockroomButton: StoryButton;
  returnButton: StoryButton;
  closeButton: StoryButton;
  restockHit: Phaser.GameObjects.Rectangle;
  timer: Phaser.Time.TimerEvent;
  customerDueAt: number;
  lastSignature: string;
};

const STAGE = { x: 665, y: 622, width: 1330, height: 960 } as const;
const COLA_SLOT_POINTS = [
  { x: 915, y: 535, bottomY: 620 },
  { x: 915, y: 735, bottomY: 820 }
] as const;
const STOCK_BOX_POINTS = [
  { x: 150, y: 510 },
  { x: 300, y: 510 },
  { x: 150, y: 675 },
  { x: 300, y: 675 }
] as const;

const STORY_ASSETS = [
  SupermarketSceneAssets.backgrounds.store.overview01,
  SupermarketSceneAssets.backgrounds.navigation.aisleGeneral01,
  SupermarketSceneAssets.backgrounds.checkout.overview01,
  SupermarketSceneAssets.stockroom.overview01,
  SupermarketSceneAssets.restock.drinks.empty01,
  SupermarketSceneAssets.restock.drinks.mid01,
  SupermarketSceneAssets.restock.drinks.full01
] as const;

const prototype = GameScene.prototype as unknown as GamePrototype;
const originalPreload = prototype.preload;
const originalCreate = prototype.create;

prototype.preload = function preloadDayTwoStory(): void {
  originalPreload.call(this);
  const scene = this as unknown as Phaser.Scene;
  if (gameSession.day !== "day02") return;

  STORY_ASSETS.forEach((key) => {
    if (!scene.textures.exists(key)) scene.load.image(key, SupermarketSceneAssetPaths[key]);
  });
};

prototype.create = function createDayTwoStory(...args: unknown[]): void {
  originalCreate.apply(this, args);
  const scene = this as unknown as RuntimeGame;
  if (gameSession.day !== "day02") return;
  installDayTwoStory(scene);
};

function installDayTwoStory(scene: RuntimeGame): void {
  destroyExisting(scene);
  stopLeakedScenes(scene);
  scene.input.setDraggable(scene.cart, false);

  const protectedObjects = new Set<Phaser.GameObjects.GameObject>([
    scene.cart,
    scene.worker,
    ...scene.boxes.flatMap((box) => [box.image, box.shadow]),
    ...scene.shelfSlots.flatMap((slot) => [
      slot.hitArea,
      ...(slot.missingTag ? [slot.missingTag] : []),
      ...(slot.typeLabel ? [slot.typeLabel] : []),
      ...(slot.product ? [slot.product] : [])
    ])
  ]);

  retireLegacyStage(scene, protectedObjects);
  prepareShelfRuntime(scene);

  const background = mark(
    scene.add.image(STAGE.x, STAGE.y, SupermarketSceneAssets.backgrounds.store.overview01)
      .setDisplaySize(STAGE.width, STAGE.height)
      .setDepth(2)
  );
  const vignette = mark(
    scene.add.rectangle(STAGE.x, STAGE.y, STAGE.width, STAGE.height, 0x06100d, 0.06)
      .setDepth(3)
  );

  const locationText = mark(
    scene.add.text(38, 188, "MAIN STORE", {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#f8f0d2",
      fontStyle: "bold",
      backgroundColor: "rgba(12, 31, 26, 0.82)",
      padding: { x: 13, y: 8 }
    }).setDepth(8_700)
  );

  const radioText = mark(
    scene.add.text(665, 201, "", {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#ffffff",
      fontStyle: "bold",
      align: "center",
      wordWrap: { width: 760 },
      backgroundColor: "rgba(13, 34, 28, 0.86)",
      padding: { x: 18, y: 10 }
    }).setOrigin(0.5).setDepth(8_700)
  );

  const actionText = mark(
    scene.add.text(665, 980, "", {
      fontFamily: "Arial",
      fontSize: "17px",
      color: "#fff2b0",
      fontStyle: "bold",
      align: "center",
      backgroundColor: "rgba(12, 31, 26, 0.88)",
      padding: { x: 16, y: 9 }
    }).setOrigin(0.5).setDepth(8_700)
  );

  const overviewHotspot = createButton(scene, 1045, 820, 250, "DRINKS AISLE");
  const overviewButton = createButton(scene, 160, 1020, 245, "← STORE OVERVIEW");
  const stockroomButton = createButton(scene, 1165, 1020, 235, "STOCKROOM →");
  const returnButton = createButton(scene, 1135, 1020, 290, "RETURN TO AISLE →");
  const closeButton = createButton(scene, 665, 1015, 315, "FINISH THE SHIFT");

  const restockHit = mark(
    scene.add.rectangle(925, 655, 610, 600, 0xffffff, 0.001)
      .setDepth(8_650)
      .setInteractive({ useHandCursor: true })
      .setVisible(false)
  );

  const controller: DayTwoStoryController = {
    view: "overview",
    transitioning: false,
    customerBusy: false,
    closingTransitioned: false,
    introShown: false,
    background,
    vignette,
    locationText,
    radioText,
    actionText,
    overviewHotspot,
    overviewButton,
    stockroomButton,
    returnButton,
    closeButton,
    restockHit,
    timer: undefined as unknown as Phaser.Time.TimerEvent,
    customerDueAt: Number.POSITIVE_INFINITY,
    lastSignature: ""
  };
  scene.__dayTwoStory = controller;

  overviewHotspot.hit.on("pointerdown", () => setView(scene, controller, "drinks"));
  overviewButton.hit.on("pointerdown", () => setView(scene, controller, "overview"));
  stockroomButton.hit.on("pointerdown", () => enterStockroom(scene, controller));
  returnButton.hit.on("pointerdown", () => returnToDrinks(scene, controller));
  closeButton.hit.on("pointerdown", () => finishShift(scene, controller));
  restockHit.on("pointerdown", () => restockDrinks(scene, controller));

  controller.timer = scene.time.addEvent({
    delay: 180,
    loop: true,
    callback: () => synchronize(scene, controller)
  });

  setView(scene, controller, "overview", false);
  synchronize(scene, controller, true);

  scene.time.delayedCall(350, () => {
    if (!scene.scene.isActive() || gameSession.day !== "day02") return;
    controller.introShown = true;
    controller.radioText.setText("MANAGER: Weekend traffic starts soon. The drinks aisle needs two cola cases before opening.");
    scene.showTransientHint("Enter the drinks aisle, inspect the empty shelf, then collect two cola cases from the stockroom.");
  });

  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    controller.timer.remove(false);
    background.destroy();
    vignette.destroy();
    locationText.destroy();
    radioText.destroy();
    actionText.destroy();
    overviewHotspot.container.destroy(true);
    overviewButton.container.destroy(true);
    stockroomButton.container.destroy(true);
    returnButton.container.destroy(true);
    closeButton.container.destroy(true);
    restockHit.destroy();
    scene.__dayTwoStory = undefined;
    delete document.body.dataset.dayTwoStory;
  });
}

function createButton(scene: RuntimeGame, x: number, y: number, width: number, text: string): StoryButton {
  const plate = mark(
    scene.add.rectangle(0, 0, width, 60, 0x143b31, 0.92)
      .setStrokeStyle(2, 0xd8bd69, 0.9)
  );
  const label = mark(
    scene.add.text(0, 0, text, {
      fontFamily: "Arial",
      fontSize: "17px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setOrigin(0.5)
  );
  const hit = mark(
    scene.add.rectangle(0, 0, width + 12, 72, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true })
  );
  const container = mark(scene.add.container(x, y, [plate, label, hit]).setDepth(8_800));
  return { container, label, hit };
}

function setView(
  scene: RuntimeGame,
  controller: DayTwoStoryController,
  view: StoryView,
  animate = true
): void {
  if (controller.transitioning || controller.view === view || scene.shiftEnded) return;
  controller.view = view;
  controller.transitioning = animate;

  const key = textureForView(scene, view);
  scene.tweens.killTweensOf(controller.background);

  const apply = () => {
    controller.background.setTexture(key).setDisplaySize(STAGE.width, STAGE.height);
    layoutView(scene, controller);
    if (!animate) {
      controller.background.setAlpha(1);
      controller.transitioning = false;
      synchronize(scene, controller, true);
      return;
    }
    controller.background.setAlpha(0.18);
    scene.tweens.add({
      targets: controller.background,
      alpha: 1,
      duration: 220,
      ease: "Sine.Out",
      onComplete: () => {
        controller.transitioning = false;
        synchronize(scene, controller, true);
      }
    });
  };

  apply();
}

function textureForView(scene: RuntimeGame, view: StoryView): string {
  if (view === "overview") return SupermarketSceneAssets.backgrounds.store.overview01;
  if (view === "stockroom") return SupermarketSceneAssets.stockroom.overview01;
  if (view === "checkout") return SupermarketSceneAssets.backgrounds.checkout.overview01;

  const state = drinksState(scene);
  if (state === "empty") return SupermarketSceneAssets.restock.drinks.empty01;
  if (state === "mid") return SupermarketSceneAssets.restock.drinks.mid01;
  return SupermarketSceneAssets.restock.drinks.full01;
}

function layoutView(scene: RuntimeGame, controller: DayTwoStoryController): void {
  hideRuntimeActors(scene);
  hideRuntimeBoxes(scene);

  controller.overviewHotspot.container.setVisible(false);
  controller.overviewButton.container.setVisible(false);
  controller.stockroomButton.container.setVisible(false);
  controller.returnButton.container.setVisible(false);
  controller.closeButton.container.setVisible(false);
  controller.restockHit.setVisible(false);

  if (controller.view === "overview") {
    controller.locationText.setText("MAIN STORE");
    controller.overviewHotspot.container.setVisible(true);
    controller.actionText.setText("Walk to the drinks aisle before opening.");
    return;
  }

  if (controller.view === "drinks") {
    controller.locationText.setText("DRINKS AISLE");
    controller.overviewButton.container.setVisible(true);
    controller.stockroomButton.container.setVisible(true);
    controller.restockHit.setVisible(true);
    layoutDrinksActors(scene);
    return;
  }

  if (controller.view === "stockroom") {
    controller.locationText.setText("STOCKROOM");
    controller.returnButton.container.setVisible(true);
    layoutStockroom(scene);
    return;
  }

  controller.locationText.setText("CHECKOUT & CLOSING");
  controller.closeButton.container.setVisible(true);
  controller.actionText.setText("Return the cart and close the shift.");
}

function enterStockroom(scene: RuntimeGame, controller: DayTwoStoryController): void {
  if (controller.transitioning || scene.restockBusy || scene.movingCart) return;
  controller.transitioning = true;
  hideRuntimeActors(scene);

  const complete = () => {
    controller.transitioning = false;
    setView(scene, controller, "stockroom");
  };

  if (scene.cartAtShelf) {
    scene.movingCart = true;
    scene.snapCart("WAREHOUSE");
    scene.time.delayedCall(320, complete);
  } else {
    complete();
  }
}

function returnToDrinks(scene: RuntimeGame, controller: DayTwoStoryController): void {
  if (controller.transitioning || scene.restockBusy || scene.movingCart) return;
  if (scene.selectedBox) {
    scene.showTransientHint("Place the selected case on the cart first.");
    return;
  }

  const required = scene.phase === "PREPARE" ? 2 : 1;
  const colaCount = scene.loadedProducts.filter((product) => product === "cola").length;
  if (colaCount < required) {
    scene.showTransientHint(`Load ${required - colaCount} more cola case(s) before returning.`);
    return;
  }

  controller.transitioning = true;
  hideRuntimeActors(scene);
  scene.movingCart = true;
  scene.snapCart("SALES");
  scene.time.delayedCall(320, () => {
    controller.transitioning = false;
    setView(scene, controller, "drinks");
  });
}

function restockDrinks(scene: RuntimeGame, controller: DayTwoStoryController): void {
  if (controller.view !== "drinks" || controller.transitioning || scene.restockBusy || scene.movingCart) return;

  const target = colaSlots(scene).find((slot) => !slot.product);
  if (!target) {
    scene.showTransientHint("The drinks shelf is fully stocked.");
    return;
  }
  if (!scene.cartAtShelf) {
    scene.showTransientHint("Bring the replenishment cart back from the stockroom first.");
    return;
  }

  const productIndex = scene.loadedProducts.indexOf("cola");
  if (productIndex < 0) {
    scene.showTransientHint("No cola case is on the cart. Return to the stockroom.");
    return;
  }

  scene.restockBusy = true;
  scene.loadedProducts.splice(productIndex, 1);
  scene.updateCartCount();
  controller.actionText.setText("Opening case… facing bottles… filling the shelf…");
  controller.restockHit.disableInteractive();

  scene.time.delayedCall(720, () => {
    if (!scene.scene.isActive() || scene.shiftEnded) return;
    const product = scene.add.image(-1000, -1000, Assets.products.cola).setVisible(false);
    target.product = product;
    target.reservedForCustomer = false;
    scene.stocked += 1;
    scene.restockBusy = false;
    controller.restockHit.setInteractive({ useHandCursor: true });
    controller.background.setTexture(textureForView(scene, "drinks")).setDisplaySize(STAGE.width, STAGE.height);

    const state = drinksState(scene);
    if (state === "full" && scene.phase === "PREPARE") {
      scene.openStore();
      stopBaseCustomerLoop(scene);
      controller.customerDueAt = scene.time.now + 2600;
      controller.radioText.setText("MANAGER: Good. Doors are open. Keep this aisle ready while customers shop.");
      scene.showTransientHint("The store is open. Watch the drinks shelf and replenish every new gap.");
    } else {
      scene.showTransientHint(state === "mid" ? "One case placed. Add the second case." : "Shelf replenished.");
    }

    scene.updateHud();
    synchronize(scene, controller, true);
  });
}

function synchronize(scene: RuntimeGame, controller: DayTwoStoryController, force = false): void {
  if (!scene.scene.isActive() || gameSession.day !== "day02") return;
  stopLeakedScenes(scene);
  stopBaseCustomerLoop(scene);

  const signature = runtimeSignature(scene, controller);
  if (!force && signature === controller.lastSignature) {
    maybeTriggerCustomer(scene, controller);
    return;
  }
  controller.lastSignature = signature;

  scene.shelfSlots.forEach((slot) => {
    slot.missingTag?.setVisible(false);
    slot.typeLabel?.setVisible(false);
    slot.hitArea.setVisible(false).disableInteractive();
    if (slot.product?.active) slot.product.setVisible(false);
  });

  if (controller.view === "drinks") {
    controller.background.setTexture(textureForView(scene, "drinks")).setDisplaySize(STAGE.width, STAGE.height);
    layoutDrinksActors(scene);
    const state = drinksState(scene);
    controller.actionText.setText(drinksAction(scene, state));
    controller.restockHit.setVisible(true);
    if (!scene.restockBusy && !controller.transitioning) {
      controller.restockHit.setInteractive({ useHandCursor: true });
    }
  } else if (controller.view === "stockroom") {
    layoutStockroom(scene);
    const colaCount = scene.loadedProducts.filter((product) => product === "cola").length;
    const required = scene.phase === "PREPARE" ? 2 : 1;
    controller.actionText.setText(`Load cola cases onto the cart · ${colaCount}/${required}`);
  }

  if (scene.phase === "CLOSING" && !controller.closingTransitioned) {
    controller.closingTransitioned = true;
    controller.radioText.setText("MANAGER: Six customers served. Bring the cart home and close the front end.");
    scene.time.delayedCall(700, () => {
      if (scene.scene.isActive() && !scene.shiftEnded) setView(scene, controller, "checkout");
    });
  }

  document.body.dataset.dayTwoStory = `${controller.view}:${signature}`;
  maybeTriggerCustomer(scene, controller);
}

function maybeTriggerCustomer(scene: RuntimeGame, controller: DayTwoStoryController): void {
  if (
    controller.customerBusy ||
    controller.transitioning ||
    controller.view !== "drinks" ||
    (scene.phase !== "OPEN" && scene.phase !== "RUSH") ||
    scene.restockBusy ||
    scene.shiftEnded ||
    scene.time.now < controller.customerDueAt
  ) return;

  const available = colaSlots(scene).find((slot) => Boolean(slot.product));
  if (!available) {
    controller.customerDueAt = scene.time.now + 1800;
    controller.radioText.setText("CUSTOMER: Is the cola sold out again?");
    return;
  }

  controller.customerBusy = true;
  controller.radioText.setText(
    scene.soldCount === 0
      ? "CUSTOMER: Perfect timing—are these bottles ready to buy?"
      : "CUSTOMER: I found what I needed. Thank you."
  );
  controller.actionText.setText("A customer is selecting a drink…");

  scene.time.delayedCall(1150, () => {
    if (!scene.scene.isActive() || scene.shiftEnded) return;
    available.product?.destroy();
    available.product = undefined;
    available.reservedForCustomer = false;
    scene.stocked = Math.max(0, scene.stocked - 1);
    scene.soldCount += 1;
    scene.money += 12;
    scene.updateStars();
    scene.advanceBusinessPhase();
    stopBaseCustomerLoop(scene);
    scene.updateHud();

    controller.customerBusy = false;
    controller.customerDueAt = scene.time.now + (scene.phase === "RUSH" ? 3900 : 5600);
    controller.background.setTexture(textureForView(scene, "drinks")).setDisplaySize(STAGE.width, STAGE.height);
    scene.showTransientHint(`Customer served · ${scene.soldCount}/6 sales. Refill the new gap before the next shopper.`);
    synchronize(scene, controller, true);
  });
}

function finishShift(scene: RuntimeGame, controller: DayTwoStoryController): void {
  if (scene.shiftEnded || controller.transitioning || scene.restockBusy || scene.movingCart) return;
  controller.transitioning = true;
  controller.closeButton.container.setVisible(false);
  controller.radioText.setText("MANAGER: Strong recovery. Tomorrow the cold chain becomes your responsibility.");

  if (scene.cartAtShelf) {
    scene.movingCart = true;
    scene.snapCart("WAREHOUSE");
    return;
  }

  scene.time.delayedCall(650, () => {
    if (scene.scene.isActive() && !scene.shiftEnded) scene.endShift();
  });
}

function prepareShelfRuntime(scene: RuntimeGame): void {
  let prepared = 0;
  const offsets: Record<ProductId, number> = { cola: 0, water: 0, milk: 0 };

  scene.shelfSlots.forEach((slot) => {
    slot.missingTag?.setVisible(false).disableInteractive();
    slot.typeLabel?.setVisible(false).disableInteractive();
    slot.hitArea.setVisible(false).disableInteractive();

    if (slot.productId === "cola") {
      const point = COLA_SLOT_POINTS[offsets.cola++] ?? COLA_SLOT_POINTS[0];
      slot.hitArea.setPosition(point.x, point.y);
      slot.productBottomY = point.bottomY;
      slot.product?.destroy();
      slot.product = undefined;
      slot.reservedForCustomer = false;
      return;
    }

    offsets[slot.productId] += 1;
    slot.product?.destroy();
    const texture = slot.productId === "water" ? Assets.products.water : Assets.products.milk;
    slot.product = scene.add.image(-1000, -1000, texture).setVisible(false);
    slot.reservedForCustomer = true;
    prepared += 1;
  });

  scene.stocked = prepared;
  scene.loadedProducts.length = 0;
  scene.selectedBox = undefined;
  scene.cartAtShelf = false;
  scene.movingCart = false;
  scene.restockBusy = false;
  scene.cart.setVisible(false);
  scene.worker.setVisible(false);
  scene.updateCartCount();
  scene.updateHud();
}

function layoutDrinksActors(scene: RuntimeGame): void {
  hideRuntimeBoxes(scene);
  scene.worker.setVisible(false);
  scene.cart
    .setVisible(scene.cartAtShelf)
    .setPosition(250, 995)
    .setScale(0.58)
    .setDepth(34);
}

function layoutStockroom(scene: RuntimeGame): void {
  scene.worker.setVisible(false);
  scene.cart
    .setVisible(true)
    .setPosition(510, 940)
    .setScale(0.66)
    .setDepth(34);

  let colaIndex = 0;
  scene.boxes.forEach((box) => {
    if (box.productId !== "cola" || box.loaded) {
      box.image.setVisible(false);
      box.shadow.setVisible(false);
      if (box.image.input) box.image.input.enabled = false;
      return;
    }

    const point = STOCK_BOX_POINTS[colaIndex % STOCK_BOX_POINTS.length];
    colaIndex += 1;
    box.homeX = point.x;
    box.homeY = point.y;
    box.image
      .setVisible(true)
      .setPosition(point.x, point.y)
      .setOrigin(0.5, 1)
      .setDisplaySize(108, 108)
      .setDepth(25 + point.y / 10_000);
    box.shadow
      .setVisible(true)
      .setPosition(point.x, point.y + 3)
      .setDisplaySize(76, 15)
      .setAlpha(0.16)
      .setDepth(24 + point.y / 10_000);
    if (box.image.input) box.image.input.enabled = !scene.cartAtShelf && !scene.movingCart && !scene.restockBusy;
  });
}

function drinksAction(scene: RuntimeGame, state: DrinksState): string {
  if (scene.phase === "PREPARE") {
    if (state === "empty") return "Shelf empty · collect two cola cases from the stockroom.";
    if (state === "mid") return "Half stocked · place one more cola case.";
    return "Opening shelf complete · customers are entering.";
  }
  if (state === "empty") return "Sold out · return to the stockroom now.";
  if (state === "mid") return "One gap remains · replenish before the next customer.";
  return `Shelf ready · ${scene.soldCount}/6 customers served.`;
}

function drinksState(scene: RuntimeGame): DrinksState {
  const filled = colaSlots(scene).filter((slot) => Boolean(slot.product)).length;
  if (filled === 0) return "empty";
  if (filled === 1) return "mid";
  return "full";
}

function colaSlots(scene: RuntimeGame): RuntimeSlot[] {
  return scene.shelfSlots.filter((slot) => slot.productId === "cola");
}

function stopBaseCustomerLoop(scene: RuntimeGame): void {
  scene.purchaseEvent?.remove(false);
  scene.purchaseEvent = undefined;
}

function hideRuntimeActors(scene: RuntimeGame): void {
  scene.cart.setVisible(false);
  scene.worker.setVisible(false);
}

function hideRuntimeBoxes(scene: RuntimeGame): void {
  scene.boxes.forEach((box) => {
    box.image.setVisible(false);
    box.shadow.setVisible(false);
    if (box.image.input) box.image.input.enabled = false;
  });
}

function stopLeakedScenes(scene: RuntimeGame): void {
  ["back-stock", "day2-room-nav", "promotion-wing"].forEach((key) => {
    if (scene.scene.isActive(key)) scene.scene.stop(key);
  });
}

function retireLegacyStage(scene: RuntimeGame, protectedObjects: Set<Phaser.GameObjects.GameObject>): void {
  [...scene.children.list].forEach((child) => {
    if (protectedObjects.has(child)) return;
    const display = child as Phaser.GameObjects.GameObject & {
      active: boolean;
      depth: number;
      y: number;
      setVisible: (visible: boolean) => unknown;
      getBounds?: () => Phaser.Geom.Rectangle;
    };
    if (!display.active || display.depth >= 50) return;

    const bounds = display.getBounds?.();
    const top = bounds?.top ?? display.y;
    const bottom = bounds?.bottom ?? display.y;
    if (bottom < 155 || top > 1080) return;

    scene.tweens.killTweensOf(child);
    display.setVisible(false);
    child.disableInteractive();
  });
}

function runtimeSignature(scene: RuntimeGame, controller: DayTwoStoryController): string {
  return [
    controller.view,
    controller.transitioning ? "1" : "0",
    controller.customerBusy ? "1" : "0",
    scene.phase,
    scene.shiftEnded ? "1" : "0",
    scene.cartAtShelf ? "1" : "0",
    scene.movingCart ? "1" : "0",
    scene.restockBusy ? "1" : "0",
    scene.loadedProducts.join(","),
    scene.boxes.map((box) => (box.loaded ? "1" : "0")).join(""),
    colaSlots(scene).map((slot) => (slot.product ? "1" : "0")).join(""),
    scene.soldCount.toString()
  ].join("|");
}

function destroyExisting(scene: RuntimeGame): void {
  const existing = scene.__dayTwoStory;
  if (!existing) return;
  existing.timer?.remove(false);
  existing.background.destroy();
  existing.vignette.destroy();
  existing.locationText.destroy();
  existing.radioText.destroy();
  existing.actionText.destroy();
  existing.overviewHotspot.container.destroy(true);
  existing.overviewButton.container.destroy(true);
  existing.stockroomButton.container.destroy(true);
  existing.returnButton.container.destroy(true);
  existing.closeButton.container.destroy(true);
  existing.restockHit.destroy();
  scene.__dayTwoStory = undefined;
}

function mark<T extends Phaser.GameObjects.GameObject>(object: T): T {
  object.setData("dayTwoStory", true);
  return object;
}
