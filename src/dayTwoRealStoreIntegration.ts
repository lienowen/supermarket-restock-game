import Phaser from "phaser";
import { GameScene } from "./scenes/GameScene";
import { gameSession } from "./systems/GameSession";
import { SupermarketAssets, SupermarketBackgroundPaths } from "./supermarketAssets";
import { ProductionAssets, ProductionAssetPaths } from "./supermarketProductionAssets";

type ProductId = "cola" | "water" | "milk";
type ViewId = "overview" | "stock" | ProductId;
type ShelfState = "empty" | "low" | "full";

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
  index: number;
  productId: ProductId;
  hitArea: Phaser.GameObjects.Rectangle;
  missingTag?: Phaser.GameObjects.Image;
  typeLabel?: Phaser.GameObjects.Text;
  productBottomY: number;
  product?: Phaser.GameObjects.Image;
  reservedForCustomer?: boolean;
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
  __dayTwoRealStore?: RealStoreController;
};

type GamePrototype = {
  preload: () => void;
  create: (...args: unknown[]) => void;
};

type ZoneDefinition = {
  productId: ProductId;
  label: string;
  overviewX: number;
  overviewY: number;
  background: string;
  empty: string;
  low: string;
  full: string;
  shelfWidth: number;
  shelfHeight: number;
};

type Hotspot = {
  container: Phaser.GameObjects.Container;
  plate: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  state: Phaser.GameObjects.Text;
  hit: Phaser.GameObjects.Rectangle;
};

type Button = {
  container: Phaser.GameObjects.Container;
  hit: Phaser.GameObjects.Rectangle;
};

type RealStoreController = {
  view: ViewId;
  previousFocus: ProductId;
  transitioning: boolean;
  overviewLayer: Phaser.GameObjects.Container;
  focusLayer: Phaser.GameObjects.Container;
  stockLayer: Phaser.GameObjects.Container;
  focusBackground: Phaser.GameObjects.Image;
  focusShelf: Phaser.GameObjects.Image;
  focusShadow: Phaser.GameObjects.Ellipse;
  focusTitle: Phaser.GameObjects.Text;
  focusSubtitle: Phaser.GameObjects.Text;
  focusHit: Phaser.GameObjects.Rectangle;
  hotspots: Record<ProductId, Hotspot>;
  overviewButton: Button;
  stockButton: Button;
  returnButton: Button;
  timer: Phaser.Time.TimerEvent;
  lastSignature: string;
  renderedProduct?: ProductId;
  renderedState?: ShelfState;
};

const GAMEPLAY_CENTER = { x: 665, y: 622 };
const GAMEPLAY_SIZE = { width: 1330, height: 960 };

const ZONES: Record<ProductId, ZoneDefinition> = {
  cola: {
    productId: "cola",
    label: "DRINKS AISLE",
    overviewX: 188,
    overviewY: 605,
    background: SupermarketAssets.backgrounds.promotionWing,
    empty: ProductionAssets.fixtures.checkoutEmpty,
    low: ProductionAssets.fixtures.checkoutLow,
    full: ProductionAssets.fixtures.checkoutFull,
    shelfWidth: 560,
    shelfHeight: 650
  },
  water: {
    productId: "water",
    label: "WATER & BEVERAGES",
    overviewX: 515,
    overviewY: 505,
    background: SupermarketAssets.backgrounds.mainFloor,
    empty: ProductionAssets.fixtures.healthBeautyEmpty,
    low: ProductionAssets.fixtures.healthBeautyLow,
    full: ProductionAssets.fixtures.healthBeautyFull,
    shelfWidth: 550,
    shelfHeight: 650
  },
  milk: {
    productId: "milk",
    label: "DAIRY AISLE",
    overviewX: 1125,
    overviewY: 520,
    background: SupermarketAssets.backgrounds.coldCase,
    empty: ProductionAssets.fixtures.frozenEmpty,
    low: ProductionAssets.fixtures.frozenLow,
    full: ProductionAssets.fixtures.frozenFull,
    shelfWidth: 585,
    shelfHeight: 680
  }
};

const STOCK_BOX_POINTS = [
  { x: 165, y: 510 },
  { x: 305, y: 510 },
  { x: 445, y: 510 },
  { x: 165, y: 655 },
  { x: 305, y: 655 },
  { x: 445, y: 655 }
] as const;

const prototype = GameScene.prototype as unknown as GamePrototype;
const originalPreload = prototype.preload;
const originalCreate = prototype.create;

prototype.preload = function preloadDayTwoRealStore(): void {
  originalPreload.call(this);
  const scene = this as unknown as Phaser.Scene;
  if (gameSession.day !== "day02") return;

  const paths = {
    ...SupermarketBackgroundPaths,
    [ProductionAssets.backgrounds.stockDock]: ProductionAssetPaths[ProductionAssets.backgrounds.stockDock],
    [ProductionAssets.fixtures.rackBackroomEmpty]: ProductionAssetPaths[ProductionAssets.fixtures.rackBackroomEmpty],
    [ProductionAssets.fixtures.checkoutEmpty]: ProductionAssetPaths[ProductionAssets.fixtures.checkoutEmpty],
    [ProductionAssets.fixtures.checkoutLow]: ProductionAssetPaths[ProductionAssets.fixtures.checkoutLow],
    [ProductionAssets.fixtures.checkoutFull]: ProductionAssetPaths[ProductionAssets.fixtures.checkoutFull],
    [ProductionAssets.fixtures.healthBeautyEmpty]: ProductionAssetPaths[ProductionAssets.fixtures.healthBeautyEmpty],
    [ProductionAssets.fixtures.healthBeautyLow]: ProductionAssetPaths[ProductionAssets.fixtures.healthBeautyLow],
    [ProductionAssets.fixtures.healthBeautyFull]: ProductionAssetPaths[ProductionAssets.fixtures.healthBeautyFull],
    [ProductionAssets.fixtures.frozenEmpty]: ProductionAssetPaths[ProductionAssets.fixtures.frozenEmpty],
    [ProductionAssets.fixtures.frozenLow]: ProductionAssetPaths[ProductionAssets.fixtures.frozenLow],
    [ProductionAssets.fixtures.frozenFull]: ProductionAssetPaths[ProductionAssets.fixtures.frozenFull]
  };

  Object.entries(paths).forEach(([key, path]) => {
    if (!scene.textures.exists(key)) scene.load.image(key, path);
  });
};

prototype.create = function createDayTwoRealStore(...args: unknown[]): void {
  originalCreate.apply(this, args);
  const scene = this as unknown as RuntimeGame;
  if (gameSession.day !== "day02") return;
  installRealStore(scene);
};

function installRealStore(scene: RuntimeGame): void {
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

  retireLegacyGameplay(scene, protectedObjects);
  lockSlotChrome(scene);

  const overviewBackground = mark(
    scene.add.image(GAMEPLAY_CENTER.x, GAMEPLAY_CENTER.y, SupermarketAssets.backgrounds.mainFloor)
      .setDisplaySize(GAMEPLAY_SIZE.width, GAMEPLAY_SIZE.height)
  );
  const overviewShade = mark(
    scene.add.rectangle(GAMEPLAY_CENTER.x, GAMEPLAY_CENTER.y, GAMEPLAY_SIZE.width, GAMEPLAY_SIZE.height, 0x07110f, 0.035)
  );
  const overviewLayer = mark(scene.add.container(0, 0, [overviewBackground, overviewShade]).setDepth(2));

  const hotspots: Record<ProductId, Hotspot> = {
    cola: createHotspot(scene, ZONES.cola),
    water: createHotspot(scene, ZONES.water),
    milk: createHotspot(scene, ZONES.milk)
  };
  Object.values(hotspots).forEach((hotspot) => overviewLayer.add(hotspot.container));

  const focusBackground = mark(
    scene.add.image(GAMEPLAY_CENTER.x, GAMEPLAY_CENTER.y, SupermarketAssets.backgrounds.mainFloor)
      .setDisplaySize(GAMEPLAY_SIZE.width, GAMEPLAY_SIZE.height)
  );
  const focusShade = mark(
    scene.add.rectangle(GAMEPLAY_CENTER.x, GAMEPLAY_CENTER.y, GAMEPLAY_SIZE.width, GAMEPLAY_SIZE.height, 0x06100e, 0.17)
  );
  const focusGlow = mark(scene.add.ellipse(705, 920, 760, 185, 0xffe6ac, 0.12));
  const focusShadow = mark(scene.add.ellipse(705, 1005, 540, 72, 0x07100d, 0.3));
  const focusShelf = mark(
    scene.add.image(705, 1000, ProductionAssets.fixtures.checkoutEmpty)
      .setOrigin(0.5, 1)
      .setDisplaySize(560, 650)
  );
  const focusTitle = mark(
    scene.add.text(665, 215, "", {
      fontFamily: "Arial",
      fontSize: "28px",
      color: "#ffffff",
      fontStyle: "bold",
      stroke: "#10251c",
      strokeThickness: 7
    }).setOrigin(0.5)
  );
  const focusSubtitle = mark(
    scene.add.text(665, 255, "", {
      fontFamily: "Arial",
      fontSize: "17px",
      color: "#fff0ad",
      fontStyle: "bold",
      backgroundColor: "#173f35",
      padding: { x: 14, y: 7 }
    }).setOrigin(0.5)
  );
  const focusHit = mark(
    scene.add.rectangle(705, 690, 570, 610, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true })
  );
  const overviewButton = createButton(scene, 170, 1018, 245, "← AISLE OVERVIEW");
  const stockButton = createButton(scene, 1150, 1018, 235, "BACKROOM →");
  const focusLayer = mark(
    scene.add.container(0, 0, [
      focusBackground,
      focusShade,
      focusGlow,
      focusShadow,
      focusShelf,
      focusTitle,
      focusSubtitle,
      focusHit,
      overviewButton.container,
      stockButton.container
    ]).setDepth(2).setVisible(false)
  );

  const stockBackground = mark(
    scene.add.image(GAMEPLAY_CENTER.x, GAMEPLAY_CENTER.y, ProductionAssets.backgrounds.stockDock)
      .setDisplaySize(GAMEPLAY_SIZE.width, GAMEPLAY_SIZE.height)
  );
  const stockShade = mark(
    scene.add.rectangle(GAMEPLAY_CENTER.x, GAMEPLAY_CENTER.y, GAMEPLAY_SIZE.width, GAMEPLAY_SIZE.height, 0x07100d, 0.06)
  );
  const stockRackShadow = mark(scene.add.ellipse(315, 1000, 520, 78, 0x07100d, 0.28));
  const stockRack = mark(
    scene.add.image(315, 995, ProductionAssets.fixtures.rackBackroomEmpty)
      .setOrigin(0.5, 1)
      .setDisplaySize(520, 650)
  );
  const stockTitle = mark(
    scene.add.text(315, 220, "BACKROOM STOCK", {
      fontFamily: "Arial",
      fontSize: "25px",
      color: "#ffffff",
      fontStyle: "bold",
      stroke: "#10251c",
      strokeThickness: 7
    }).setOrigin(0.5)
  );
  const returnButton = createButton(scene, 1115, 1018, 300, "RETURN TO AISLE →");
  const stockLayer = mark(
    scene.add.container(0, 0, [
      stockBackground,
      stockShade,
      stockRackShadow,
      stockRack,
      stockTitle,
      returnButton.container
    ]).setDepth(2).setVisible(false)
  );

  const controller: RealStoreController = {
    view: "overview",
    previousFocus: "cola",
    transitioning: false,
    overviewLayer,
    focusLayer,
    stockLayer,
    focusBackground,
    focusShelf,
    focusShadow,
    focusTitle,
    focusSubtitle,
    focusHit,
    hotspots,
    overviewButton,
    stockButton,
    returnButton,
    timer: undefined as unknown as Phaser.Time.TimerEvent,
    lastSignature: ""
  };
  scene.__dayTwoRealStore = controller;

  (Object.keys(hotspots) as ProductId[]).forEach((productId) => {
    hotspots[productId].hit.on("pointerdown", () => enterFocus(scene, controller, productId));
  });
  focusHit.on("pointerdown", () => attemptRestock(scene, controller));
  overviewButton.hit.on("pointerdown", () => enterOverview(scene, controller));
  stockButton.hit.on("pointerdown", () => enterStock(scene, controller));
  returnButton.hit.on("pointerdown", () => returnToAisle(scene, controller));

  synchronize(scene, controller, true);
  controller.timer = scene.time.addEvent({
    delay: 180,
    loop: true,
    callback: () => synchronize(scene, controller)
  });

  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    controller.timer.remove(false);
    overviewLayer.destroy(true);
    focusLayer.destroy(true);
    stockLayer.destroy(true);
    scene.__dayTwoRealStore = undefined;
    delete document.body.dataset.dayTwoRealStore;
  });

  scene.time.delayedCall(250, () => {
    if (!scene.scene.isActive() || gameSession.day !== "day02") return;
    scene.showTransientHint("Choose an aisle, inspect the shelf, then collect matching cases from the backroom.");
  });
}

function createHotspot(scene: RuntimeGame, zone: ZoneDefinition): Hotspot {
  const pin = mark(scene.add.ellipse(0, 0, 30, 20, 0xffd75a, 0.92));
  const plate = mark(
    scene.add.rectangle(0, -38, 190, 46, 0x173f35, 0.92)
      .setStrokeStyle(2, 0xffd75a, 0.9)
  );
  const label = mark(
    scene.add.text(0, -44, zone.label, {
      fontFamily: "Arial",
      fontSize: "15px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setOrigin(0.5)
  );
  const state = mark(
    scene.add.text(0, -22, "EMPTY", {
      fontFamily: "Arial",
      fontSize: "11px",
      color: "#fff0ad",
      fontStyle: "bold"
    }).setOrigin(0.5)
  );
  const hit = mark(
    scene.add.rectangle(0, -28, 210, 80, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true })
  );
  const container = mark(scene.add.container(zone.overviewX, zone.overviewY, [pin, plate, label, state, hit]).setDepth(8_900));
  hit.on("pointerover", () => container.setScale(1.025));
  hit.on("pointerout", () => container.setScale(1));
  return { container, plate, label, state, hit };
}

function createButton(scene: RuntimeGame, x: number, y: number, width: number, label: string): Button {
  const plate = mark(
    scene.add.rectangle(0, 0, width, 62, 0x173f35, 0.96)
      .setStrokeStyle(3, 0xffd75a, 0.95)
  );
  const text = mark(
    scene.add.text(0, 0, label, {
      fontFamily: "Arial",
      fontSize: "17px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setOrigin(0.5)
  );
  const hit = mark(
    scene.add.rectangle(0, 0, width + 12, 74, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true })
  );
  const container = mark(scene.add.container(x, y, [plate, text, hit]).setDepth(8_900));
  hit.on("pointerover", () => container.setScale(1.025));
  hit.on("pointerout", () => container.setScale(1));
  return { container, hit };
}

function enterFocus(scene: RuntimeGame, controller: RealStoreController, productId: ProductId): void {
  if (controller.transitioning || scene.restockBusy || scene.movingCart) return;
  controller.previousFocus = productId;
  transition(scene, controller, () => {
    controller.view = productId;
    synchronize(scene, controller, true);
  });
}

function enterOverview(scene: RuntimeGame, controller: RealStoreController): void {
  if (controller.transitioning || controller.view === "overview" || scene.restockBusy || scene.movingCart) return;
  transition(scene, controller, () => {
    controller.view = "overview";
    synchronize(scene, controller, true);
  });
}

function enterStock(scene: RuntimeGame, controller: RealStoreController): void {
  if (controller.transitioning || !isProductView(controller.view) || scene.restockBusy || scene.movingCart) return;
  if (scene.selectedBox) {
    scene.showTransientHint("Finish placing the selected case first.");
    return;
  }

  controller.previousFocus = controller.view;
  transition(scene, controller, () => {
    controller.view = "stock";
    if (scene.cartAtShelf) {
      scene.movingCart = true;
      scene.snapCart("WAREHOUSE");
    }
    synchronize(scene, controller, true);
  });
}

function returnToAisle(scene: RuntimeGame, controller: RealStoreController): void {
  if (controller.transitioning || controller.view !== "stock" || scene.restockBusy || scene.movingCart) return;
  if (scene.selectedBox) {
    scene.showTransientHint("Place the selected case on the cart before returning to the store.");
    return;
  }

  const required = Math.max(1, scene.departureRequirement());
  if (scene.loadedProducts.length < required) {
    scene.showTransientHint(`Load ${required - scene.loadedProducts.length} more case(s) before returning to the aisle.`);
    return;
  }

  transition(scene, controller, () => {
    controller.view = controller.previousFocus;
    scene.movingCart = true;
    scene.snapCart("SALES");
    synchronize(scene, controller, true);
  });
}

function attemptRestock(scene: RuntimeGame, controller: RealStoreController): void {
  if (!isProductView(controller.view) || controller.transitioning) return;
  if (scene.shiftEnded || scene.movingCart || scene.restockBusy) return;

  const productId = controller.view;
  const target = scene.shelfSlots.find(
    (slot) => slot.productId === productId && !slot.product?.active && !slot.reservedForCustomer
  );

  if (!target) {
    scene.showTransientHint("This shelf is already full.");
    return;
  }
  if (!scene.cartAtShelf) {
    scene.showTransientHint("Go to the backroom and bring the matching cases first.");
    return;
  }
  if (!scene.loadedProducts.includes(productId)) {
    scene.showTransientHint(`No matching ${productId.toUpperCase()} case on the cart.`);
    return;
  }

  configureFocusSlots(scene, productId);
  target.hitArea.emit("pointerdown");
  scene.time.delayedCall(850, () => synchronize(scene, controller, true));
}

function transition(scene: RuntimeGame, controller: RealStoreController, midpoint: () => void): void {
  controller.transitioning = true;
  const cover = mark(
    scene.add.rectangle(GAMEPLAY_CENTER.x, GAMEPLAY_CENTER.y, GAMEPLAY_SIZE.width, GAMEPLAY_SIZE.height, 0x07100d, 0)
      .setDepth(9_800)
      .setInteractive()
  );

  scene.tweens.add({
    targets: cover,
    alpha: 0.62,
    duration: 130,
    onComplete: () => {
      midpoint();
      scene.tweens.add({
        targets: cover,
        alpha: 0,
        duration: 170,
        onComplete: () => {
          cover.destroy();
          controller.transitioning = false;
          synchronize(scene, controller, true);
        }
      });
    }
  });
}

function synchronize(scene: RuntimeGame, controller: RealStoreController, force = false): void {
  if (!scene.scene.isActive() || gameSession.day !== "day02") return;
  stopLeakedScenes(scene);

  const signature = runtimeSignature(scene, controller);
  if (!force && signature === controller.lastSignature) return;
  controller.lastSignature = signature;

  hideSlotProducts(scene);
  updateHotspots(scene, controller);

  controller.overviewLayer.setVisible(controller.view === "overview");
  controller.focusLayer.setVisible(isProductView(controller.view));
  controller.stockLayer.setVisible(controller.view === "stock");

  if (controller.view === "overview") {
    layoutOverviewActors(scene);
  } else if (controller.view === "stock") {
    layoutStockRoom(scene);
  } else {
    updateFocusScene(scene, controller, controller.view);
  }

  document.body.dataset.dayTwoRealStore = `${controller.view}:${signature}`;
}

function updateHotspots(scene: RuntimeGame, controller: RealStoreController): void {
  (Object.keys(controller.hotspots) as ProductId[]).forEach((productId) => {
    const state = shelfState(scene, productId);
    const hotspot = controller.hotspots[productId];
    hotspot.state.setText(state === "full" ? "READY" : state === "low" ? "LOW STOCK" : "EMPTY");
    hotspot.plate.setFillStyle(
      state === "full" ? 0x214c39 : state === "low" ? 0x5b4b1d : 0x4a251d,
      0.92
    );
  });
}

function updateFocusScene(scene: RuntimeGame, controller: RealStoreController, productId: ProductId): void {
  const zone = ZONES[productId];
  const state = shelfState(scene, productId);
  const targetTexture = zone[state];

  controller.focusBackground.setTexture(zone.background).setDisplaySize(GAMEPLAY_SIZE.width, GAMEPLAY_SIZE.height);
  if (controller.renderedProduct !== productId || controller.renderedState !== state || controller.focusShelf.texture.key !== targetTexture) {
    controller.focusShelf
      .setTexture(targetTexture)
      .setDisplaySize(zone.shelfWidth, zone.shelfHeight)
      .setPosition(705, 1000);
    controller.focusShadow.setDisplaySize(zone.shelfWidth * 0.86, 72);
    controller.renderedProduct = productId;
    controller.renderedState = state;
  }

  const slots = scene.shelfSlots.filter((slot) => slot.productId === productId);
  const filled = slots.filter((slot) => Boolean(slot.product?.active)).length;
  controller.focusTitle.setText(zone.label);
  controller.focusSubtitle.setText(
    state === "full"
      ? "FULLY STOCKED"
      : scene.cartAtShelf
        ? `TAP THE SHELF TO RESTOCK · ${filled}/${slots.length}`
        : `EMPTY BAYS ${filled}/${slots.length} · COLLECT CASES IN BACKROOM`
  );

  configureFocusSlots(scene, productId);
  layoutFocusActors(scene);

  const blocked = controller.transitioning || scene.movingCart || scene.restockBusy;
  controller.focusHit.setVisible(!blocked);
  if (controller.focusHit.input) controller.focusHit.input.enabled = !blocked;
  controller.overviewButton.container.setVisible(!blocked);
  controller.stockButton.container.setVisible(!blocked);
}

function configureFocusSlots(scene: RuntimeGame, productId: ProductId): void {
  const active = scene.shelfSlots.filter((slot) => slot.productId === productId);
  const points = [
    { x: 640, y: 600, bottomY: 700 },
    { x: 740, y: 760, bottomY: 860 }
  ];

  active.forEach((slot, index) => {
    const point = points[index] ?? points[0];
    slot.hitArea
      .setPosition(point.x, point.y)
      .setSize(430, 220)
      .setAlpha(0.001)
      .setVisible(false);
    slot.productBottomY = point.bottomY;
  });
}

function layoutOverviewActors(scene: RuntimeGame): void {
  scene.boxes.forEach((box) => {
    box.image.setVisible(false);
    box.shadow.setVisible(false);
  });
  scene.cart.setVisible(false);
  scene.worker.setVisible(true).setDepth(34);
  if (!scene.movingCart && !scene.restockBusy && !scene.selectedBox) {
    scene.worker.setPosition(665, 995).setDisplaySize(135, 270);
  }
}

function layoutFocusActors(scene: RuntimeGame): void {
  scene.boxes.forEach((box) => {
    box.image.setVisible(false);
    box.shadow.setVisible(false);
  });

  scene.cart.setVisible(scene.cartAtShelf).setDepth(33);
  scene.worker.setVisible(true).setDepth(34);
  if (scene.movingCart || scene.restockBusy || scene.selectedBox) return;

  if (scene.cartAtShelf) scene.cart.setPosition(1010, 1010).setScale(0.72);
  scene.worker.setPosition(scene.cartAtShelf ? 420 : 470, 995).setDisplaySize(165, 330);
}

function layoutStockRoom(scene: RuntimeGame): void {
  scene.cart.setVisible(true).setDepth(33);
  scene.worker.setVisible(true).setDepth(34);
  if (!scene.movingCart && !scene.restockBusy && !scene.selectedBox) {
    scene.cart.setPosition(650, 975).setScale(0.78);
    scene.worker.setPosition(520, 965).setDisplaySize(165, 330);
  }

  scene.boxes.forEach((box, index) => {
    const point = STOCK_BOX_POINTS[box.positionIndex % STOCK_BOX_POINTS.length] ?? STOCK_BOX_POINTS[index % STOCK_BOX_POINTS.length];
    box.homeX = point.x;
    box.homeY = point.y;

    const dragging = scene.selectedBox === box && scene.input.activePointer.isDown;
    if (box.loaded || dragging) {
      if (box.loaded) {
        box.image.setVisible(false);
        box.shadow.setVisible(false);
      }
      return;
    }

    box.image
      .setVisible(true)
      .setPosition(point.x, point.y)
      .setOrigin(0.5, 1)
      .setDisplaySize(100, 100)
      .setDepth(24 + point.y / 10_000);
    box.shadow
      .setVisible(true)
      .setPosition(point.x, point.y + 3)
      .setDisplaySize(70, 14)
      .setAlpha(0.16)
      .setDepth(23 + point.y / 10_000);
    if (box.image.input) box.image.input.enabled = !scene.cartAtShelf && !scene.movingCart;
  });
}

function shelfState(scene: RuntimeGame, productId: ProductId): ShelfState {
  const slots = scene.shelfSlots.filter((slot) => slot.productId === productId);
  const filled = slots.filter((slot) => Boolean(slot.product?.active)).length;
  if (filled === 0) return "empty";
  if (filled < slots.length) return "low";
  return "full";
}

function hideSlotProducts(scene: RuntimeGame): void {
  scene.shelfSlots.forEach((slot) => {
    slot.missingTag?.setVisible(false);
    slot.typeLabel?.setVisible(false);
    if (slot.product?.active) slot.product.setVisible(false);
  });
}

function lockSlotChrome(scene: RuntimeGame): void {
  scene.shelfSlots.forEach((slot) => {
    slot.hitArea.setVisible(false).disableInteractive();
    slot.missingTag?.setVisible(false).disableInteractive();
    slot.typeLabel?.setVisible(false).disableInteractive();
    if (slot.product?.active) slot.product.setVisible(false);
  });
}

function retireLegacyGameplay(
  scene: RuntimeGame,
  protectedObjects: Set<Phaser.GameObjects.GameObject>
): void {
  [...scene.children.list].forEach((child) => {
    if (protectedObjects.has(child)) return;
    const display = child as Phaser.GameObjects.GameObject & {
      active: boolean;
      depth: number;
      y: number;
      setVisible: (visible: boolean) => unknown;
      getBounds?: () => Phaser.Geom.Rectangle;
    };
    if (!display.active) return;

    const bounds = display.getBounds?.();
    const top = bounds?.top ?? display.y;
    const bottom = bounds?.bottom ?? display.y;
    const hud = display.depth >= 50 && (bottom <= 175 || top >= 1060);
    if (hud) return;

    scene.tweens.killTweensOf(child);
    display.setVisible(false);
    child.disableInteractive();
  });
}

function stopLeakedScenes(scene: RuntimeGame): void {
  ["back-stock", "day2-room-nav"].forEach((key) => {
    if (scene.scene.isActive(key)) scene.scene.stop(key);
  });
}

function runtimeSignature(scene: RuntimeGame, controller: RealStoreController): string {
  return [
    controller.view,
    controller.transitioning ? "1" : "0",
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

function isProductView(view: ViewId): view is ProductId {
  return view === "cola" || view === "water" || view === "milk";
}

function destroyExisting(scene: RuntimeGame): void {
  const existing = scene.__dayTwoRealStore;
  if (!existing) return;
  existing.timer?.remove(false);
  existing.overviewLayer.destroy(true);
  existing.focusLayer.destroy(true);
  existing.stockLayer.destroy(true);
  scene.__dayTwoRealStore = undefined;
}

function mark<T extends Phaser.GameObjects.GameObject>(object: T): T {
  object.setData("dayTwoRealStore", true);
  return object;
}
