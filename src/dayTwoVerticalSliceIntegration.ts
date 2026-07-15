import Phaser from "phaser";
import { GameScene } from "./scenes/GameScene";
import { gameSession } from "./systems/GameSession";
import { SupermarketAssets, SupermarketBackgroundPaths } from "./supermarketAssets";
import { ProductionAssets, ProductionAssetPaths } from "./supermarketProductionAssets";

type ProductId = "cola" | "water" | "milk";
type MainView = "overview" | ProductId;
type ViewId = MainView | "stock";
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
  __dayTwoVerticalSlice?: VerticalSliceController;
};

type GamePrototype = {
  preload: () => void;
  create: (...args: unknown[]) => void;
};

type CameraTransform = {
  focusX: number;
  focusY: number;
  zoom: number;
};

type ShelfDefinition = {
  productId: ProductId;
  title: string;
  worldX: number;
  worldY: number;
  width: number;
  height: number;
  transform: CameraTransform;
  slotPoints: Array<{ x: number; y: number; bottomY: number }>;
};

type ShelfVisual = {
  definition: ShelfDefinition;
  cover: Phaser.GameObjects.Graphics;
  overviewButton: NavButton;
  state?: ShelfState;
};

type NavButton = {
  container: Phaser.GameObjects.Container;
  plate: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  hit: Phaser.GameObjects.Rectangle;
};

type VerticalSliceController = {
  view: ViewId;
  previousMainView: MainView;
  transitioning: boolean;
  mainBackground: Phaser.GameObjects.Image;
  stockBackground: Phaser.GameObjects.Image;
  mainBaseScaleX: number;
  mainBaseScaleY: number;
  shelfVisuals: ShelfVisual[];
  focusHit: Phaser.GameObjects.Rectangle;
  focusTitle: Phaser.GameObjects.Text;
  focusSubtitle: Phaser.GameObjects.Text;
  overviewButton: NavButton;
  stockButton: NavButton;
  returnButton: NavButton;
  timer: Phaser.Time.TimerEvent;
  lastSignature: string;
};

const GAMEPLAY_CENTER = { x: 665, y: 622 };
const GAMEPLAY_SIZE = { width: 1330, height: 960 };

const OVERVIEW_TRANSFORM: CameraTransform = {
  focusX: GAMEPLAY_CENTER.x,
  focusY: GAMEPLAY_CENTER.y,
  zoom: 1
};

const SHELVES: ShelfDefinition[] = [
  {
    productId: "cola",
    title: "DRINKS AISLE",
    worldX: 215,
    worldY: 620,
    width: 235,
    height: 300,
    transform: { focusX: 235, focusY: 610, zoom: 1.55 },
    slotPoints: [
      { x: 205, y: 560, bottomY: 630 },
      { x: 220, y: 700, bottomY: 770 }
    ]
  },
  {
    productId: "water",
    title: "WATER END-CAP",
    worldX: 445,
    worldY: 555,
    width: 175,
    height: 245,
    transform: { focusX: 450, focusY: 560, zoom: 1.72 },
    slotPoints: [
      { x: 440, y: 510, bottomY: 570 },
      { x: 450, y: 620, bottomY: 680 }
    ]
  },
  {
    productId: "milk",
    title: "DAIRY AISLE",
    worldX: 1085,
    worldY: 545,
    width: 245,
    height: 270,
    transform: { focusX: 1080, focusY: 560, zoom: 1.55 },
    slotPoints: [
      { x: 1070, y: 495, bottomY: 560 },
      { x: 1090, y: 620, bottomY: 685 }
    ]
  }
];

const STOCK_BOX_POINTS = [
  { x: 170, y: 510 },
  { x: 310, y: 510 },
  { x: 450, y: 510 },
  { x: 170, y: 650 },
  { x: 310, y: 650 },
  { x: 450, y: 650 }
] as const;

const prototype = GameScene.prototype as unknown as GamePrototype;
const originalPreload = prototype.preload;
const originalCreate = prototype.create;

prototype.preload = function preloadDayTwoVerticalSlice(): void {
  originalPreload.call(this);
  const scene = this as unknown as Phaser.Scene;
  if (gameSession.day !== "day02") return;

  const paths = {
    ...SupermarketBackgroundPaths,
    [ProductionAssets.backgrounds.stockDock]: ProductionAssetPaths[ProductionAssets.backgrounds.stockDock]
  };

  Object.entries(paths).forEach(([key, path]) => {
    if (!scene.textures.exists(key)) scene.load.image(key, path);
  });
};

prototype.create = function createDayTwoVerticalSlice(...args: unknown[]): void {
  originalCreate.apply(this, args);
  const scene = this as unknown as RuntimeGame;
  if (gameSession.day !== "day02") return;

  installVerticalSlice(scene);
};

function installVerticalSlice(scene: RuntimeGame): void {
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

  const mainBackground = mark(
    scene.add.image(GAMEPLAY_CENTER.x, GAMEPLAY_CENTER.y, SupermarketAssets.backgrounds.mainFloor)
      .setDisplaySize(GAMEPLAY_SIZE.width, GAMEPLAY_SIZE.height)
      .setDepth(2)
  );
  const mainBaseScaleX = mainBackground.scaleX;
  const mainBaseScaleY = mainBackground.scaleY;

  const stockBackground = mark(
    scene.add.image(GAMEPLAY_CENTER.x, GAMEPLAY_CENTER.y, ProductionAssets.backgrounds.stockDock)
      .setDisplaySize(GAMEPLAY_SIZE.width, GAMEPLAY_SIZE.height)
      .setDepth(2)
      .setVisible(false)
  );

  const shelfVisuals = SHELVES.map((definition) => createShelfVisual(scene, definition));

  const focusHit = mark(
    scene.add.rectangle(665, 615, 500, 590, 0xffffff, 0.001)
      .setDepth(8_850)
      .setInteractive({ useHandCursor: true })
      .setVisible(false)
  );
  const focusTitle = mark(
    scene.add.text(665, 205, "", {
      fontFamily: "Arial",
      fontSize: "27px",
      color: "#ffffff",
      fontStyle: "bold",
      stroke: "#10251c",
      strokeThickness: 7
    }).setOrigin(0.5).setDepth(8_851).setVisible(false)
  );
  const focusSubtitle = mark(
    scene.add.text(665, 245, "", {
      fontFamily: "Arial",
      fontSize: "17px",
      color: "#fff0a4",
      fontStyle: "bold",
      backgroundColor: "#173f35",
      padding: { x: 14, y: 7 }
    }).setOrigin(0.5).setDepth(8_851).setVisible(false)
  );

  const overviewButton = createButton(scene, 665, 1018, 250, "AISLE OVERVIEW");
  const stockButton = createButton(scene, 155, 1018, 250, "← BACKROOM");
  const returnButton = createButton(scene, 1135, 1018, 300, "RETURN TO STORE →");

  const controller: VerticalSliceController = {
    view: "overview",
    previousMainView: "overview",
    transitioning: false,
    mainBackground,
    stockBackground,
    mainBaseScaleX,
    mainBaseScaleY,
    shelfVisuals,
    focusHit,
    focusTitle,
    focusSubtitle,
    overviewButton,
    stockButton,
    returnButton,
    timer: undefined as unknown as Phaser.Time.TimerEvent,
    lastSignature: ""
  };
  scene.__dayTwoVerticalSlice = controller;

  shelfVisuals.forEach((visual) => {
    visual.overviewButton.hit.on("pointerdown", () => requestMainView(scene, controller, visual.definition.productId));
  });
  focusHit.on("pointerdown", () => attemptFocusedRestock(scene, controller));
  overviewButton.hit.on("pointerdown", () => requestMainView(scene, controller, "overview"));
  stockButton.hit.on("pointerdown", () => requestStockRoom(scene, controller));
  returnButton.hit.on("pointerdown", () => returnToStore(scene, controller));

  applyMainTransform(scene, controller, "overview", false);
  synchronize(scene, controller, true);

  controller.timer = scene.time.addEvent({
    delay: 160,
    loop: true,
    callback: () => synchronize(scene, controller)
  });

  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    controller.timer.remove(false);
    mainBackground.destroy();
    stockBackground.destroy();
    shelfVisuals.forEach((visual) => {
      visual.cover.destroy();
      visual.overviewButton.container.destroy(true);
    });
    focusHit.destroy();
    focusTitle.destroy();
    focusSubtitle.destroy();
    overviewButton.container.destroy(true);
    stockButton.container.destroy(true);
    returnButton.container.destroy(true);
    scene.__dayTwoVerticalSlice = undefined;
    delete document.body.dataset.dayTwoVerticalSlice;
  });

  scene.time.delayedCall(250, () => {
    if (!scene.scene.isActive() || gameSession.day !== "day02") return;
    scene.showTransientHint("Choose a shelf, inspect the empty bays, then collect matching cases from the backroom.");
  });
}

function createShelfVisual(scene: RuntimeGame, definition: ShelfDefinition): ShelfVisual {
  const cover = mark(scene.add.graphics().setDepth(24));
  const overviewButton = createButton(scene, definition.worldX, definition.worldY - definition.height / 2 - 26, 185, definition.title);
  overviewButton.container.setDepth(8_820);
  return { definition, cover, overviewButton };
}

function createButton(scene: RuntimeGame, x: number, y: number, width: number, text: string): NavButton {
  const plate = mark(
    scene.add.rectangle(0, 0, width, 62, 0x173f35, 0.95)
      .setStrokeStyle(3, 0xf0c95c, 0.95)
  );
  const label = mark(
    scene.add.text(0, 0, text, {
      fontFamily: "Arial",
      fontSize: "17px",
      color: "#ffffff",
      fontStyle: "bold",
      align: "center"
    }).setOrigin(0.5)
  );
  const hit = mark(
    scene.add.rectangle(0, 0, width + 12, 74, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true })
  );
  const container = mark(scene.add.container(x, y, [plate, label, hit]).setDepth(8_900));
  hit.on("pointerover", () => container.setScale(1.025));
  hit.on("pointerout", () => container.setScale(1));
  return { container, plate, label, hit };
}

function requestMainView(scene: RuntimeGame, controller: VerticalSliceController, view: MainView): void {
  if (controller.transitioning || controller.view === view || scene.restockBusy || scene.movingCart) return;
  if (controller.view === "stock") return;
  applyMainTransform(scene, controller, view, true);
}

function applyMainTransform(
  scene: RuntimeGame,
  controller: VerticalSliceController,
  view: MainView,
  animated: boolean
): void {
  const transform = view === "overview"
    ? OVERVIEW_TRANSFORM
    : SHELVES.find((definition) => definition.productId === view)!.transform;

  controller.view = view;
  controller.previousMainView = view;
  controller.transitioning = animated;
  controller.mainBackground.setVisible(true);
  controller.stockBackground.setVisible(false);

  const target = backgroundTarget(transform);
  scene.tweens.killTweensOf(controller.mainBackground);
  if (animated) {
    scene.tweens.add({
      targets: controller.mainBackground,
      x: target.x,
      y: target.y,
      scaleX: controller.mainBaseScaleX * transform.zoom,
      scaleY: controller.mainBaseScaleY * transform.zoom,
      duration: 360,
      ease: "Sine.InOut",
      onUpdate: () => layoutShelfVisuals(controller, transform),
      onComplete: () => {
        controller.transitioning = false;
        layoutShelfVisuals(controller, transform);
        layoutSlotsForView(scene, view, transform);
        synchronize(scene, controller, true);
      }
    });
  } else {
    controller.mainBackground
      .setPosition(target.x, target.y)
      .setScale(controller.mainBaseScaleX * transform.zoom, controller.mainBaseScaleY * transform.zoom);
    layoutShelfVisuals(controller, transform);
    layoutSlotsForView(scene, view, transform);
    controller.transitioning = false;
  }

  layoutMainActors(scene, view);
  updateControls(scene, controller);
}

function backgroundTarget(transform: CameraTransform): { x: number; y: number } {
  return {
    x: GAMEPLAY_CENTER.x - (transform.focusX - GAMEPLAY_CENTER.x) * transform.zoom,
    y: GAMEPLAY_CENTER.y - (transform.focusY - GAMEPLAY_CENTER.y) * transform.zoom
  };
}

function mapWorldPoint(transform: CameraTransform, worldX: number, worldY: number): { x: number; y: number } {
  const target = backgroundTarget(transform);
  return {
    x: target.x + (worldX - GAMEPLAY_CENTER.x) * transform.zoom,
    y: target.y + (worldY - GAMEPLAY_CENTER.y) * transform.zoom
  };
}

function layoutShelfVisuals(controller: VerticalSliceController, transform: CameraTransform): void {
  controller.shelfVisuals.forEach((visual) => {
    const point = mapWorldPoint(transform, visual.definition.worldX, visual.definition.worldY);
    visual.cover.setPosition(point.x, point.y).setScale(transform.zoom);

    const buttonPoint = mapWorldPoint(
      transform,
      visual.definition.worldX,
      visual.definition.worldY - visual.definition.height / 2 - 26
    );
    visual.overviewButton.container.setPosition(buttonPoint.x, buttonPoint.y);
  });
}

function layoutSlotsForView(scene: RuntimeGame, view: MainView, transform: CameraTransform): void {
  const offsets: Record<ProductId, number> = { cola: 0, water: 0, milk: 0 };

  scene.shelfSlots.forEach((slot) => {
    const definition = SHELVES.find((candidate) => candidate.productId === slot.productId)!;
    const pointDefinition = definition.slotPoints[offsets[slot.productId]++] ?? definition.slotPoints[0];
    const point = mapWorldPoint(transform, pointDefinition.x, pointDefinition.y);
    const bottom = mapWorldPoint(transform, pointDefinition.x, pointDefinition.bottomY);

    slot.hitArea
      .setPosition(point.x, point.y)
      .setSize(definition.width * transform.zoom * 0.72, definition.height * transform.zoom * 0.36)
      .setAlpha(0.001)
      .setVisible(false);
    if (slot.hitArea.input) slot.hitArea.input.enabled = false;
    slot.productBottomY = bottom.y;
    slot.missingTag?.setVisible(false);
    slot.typeLabel?.setVisible(false);
    if (slot.product?.active) slot.product.setVisible(false);
  });

  if (view === "overview") return;
  const activeDefinition = SHELVES.find((definition) => definition.productId === view)!;
  const activePoint = mapWorldPoint(transform, activeDefinition.worldX, activeDefinition.worldY);
  scene.__dayTwoVerticalSlice?.focusHit
    .setPosition(activePoint.x, activePoint.y)
    .setSize(activeDefinition.width * transform.zoom * 1.05, activeDefinition.height * transform.zoom * 1.05);
}

function requestStockRoom(scene: RuntimeGame, controller: VerticalSliceController): void {
  if (controller.transitioning || controller.view === "stock" || scene.restockBusy || scene.movingCart) return;
  if (scene.selectedBox) {
    scene.showTransientHint("Finish placing the selected case first.");
    return;
  }

  controller.previousMainView = controller.view;
  controller.view = "stock";
  controller.transitioning = true;
  hideActors(scene);

  if (scene.cartAtShelf) {
    scene.movingCart = true;
    scene.snapCart("WAREHOUSE");
  }

  scene.time.delayedCall(280, () => {
    if (!scene.scene.isActive()) return;
    controller.mainBackground.setVisible(false);
    controller.stockBackground.setVisible(true);
    layoutStockRoom(scene);
    controller.transitioning = false;
    synchronize(scene, controller, true);
  });
}

function returnToStore(scene: RuntimeGame, controller: VerticalSliceController): void {
  if (controller.transitioning || controller.view !== "stock" || scene.restockBusy || scene.movingCart) return;
  if (scene.selectedBox) {
    scene.showTransientHint("Place the selected case on the cart before returning to the store.");
    return;
  }

  const required = Math.max(1, scene.departureRequirement());
  if (scene.loadedProducts.length < required) {
    scene.showTransientHint(`Load ${required - scene.loadedProducts.length} more case(s) before returning to the store.`);
    return;
  }

  const targetView = controller.previousMainView === "overview" ? "cola" : controller.previousMainView;
  controller.transitioning = true;
  hideActors(scene);
  scene.movingCart = true;
  scene.snapCart("SALES");

  scene.time.delayedCall(280, () => {
    if (!scene.scene.isActive()) return;
    controller.stockBackground.setVisible(false);
    controller.mainBackground.setVisible(true);
    applyMainTransform(scene, controller, targetView, false);
    controller.transitioning = false;
    synchronize(scene, controller, true);
  });
}

function attemptFocusedRestock(scene: RuntimeGame, controller: VerticalSliceController): void {
  if (controller.transitioning || controller.view === "overview" || controller.view === "stock") return;
  if (scene.shiftEnded || scene.movingCart || scene.restockBusy) return;

  const productId = controller.view;
  const target = scene.shelfSlots.find(
    (slot) => slot.productId === productId && !slot.product?.active && !slot.reservedForCustomer
  );
  if (!target) {
    scene.showTransientHint("This shelf is fully stocked. Return to the aisle overview.");
    return;
  }

  if (!scene.cartAtShelf) {
    scene.showTransientHint("The shelf is empty. Go to BACKROOM and bring the matching cases.");
    return;
  }

  if (!scene.loadedProducts.includes(productId)) {
    scene.showTransientHint(`No matching case on the cart. Return to BACKROOM for ${productId.toUpperCase()}.`);
    return;
  }

  target.hitArea.emit("pointerdown");
  scene.time.delayedCall(760, () => synchronize(scene, controller, true));
}

function synchronize(scene: RuntimeGame, controller: VerticalSliceController, force = false): void {
  if (!scene.scene.isActive() || gameSession.day !== "day02") return;
  stopLeakedScenes(scene);

  const signature = runtimeSignature(scene, controller);
  if (!force && signature === controller.lastSignature) return;
  controller.lastSignature = signature;

  scene.shelfSlots.forEach((slot) => {
    slot.missingTag?.setVisible(false);
    slot.typeLabel?.setVisible(false);
    if (slot.product?.active) slot.product.setVisible(false);
  });

  controller.shelfVisuals.forEach((visual) => updateShelfCover(scene, visual));

  if (controller.view === "stock") {
    layoutStockRoom(scene);
  } else {
    layoutMainActors(scene, controller.view);
  }

  updateControls(scene, controller);
  document.body.dataset.dayTwoVerticalSlice = `${controller.view}:${signature}`;
}

function updateShelfCover(scene: RuntimeGame, visual: ShelfVisual): void {
  const slots = scene.shelfSlots.filter((slot) => slot.productId === visual.definition.productId);
  const filled = slots.filter((slot) => Boolean(slot.product?.active)).length;
  const state: ShelfState = filled === 0 ? "empty" : filled < slots.length ? "low" : "full";
  if (visual.state === state) return;
  visual.state = state;

  visual.cover.clear();
  if (state === "full") return;

  const width = visual.definition.width;
  const height = visual.definition.height;
  const coverWidth = state === "empty" ? width : width * 0.52;
  const offsetX = state === "empty" ? 0 : width * 0.24;
  const topWidth = coverWidth * 0.9;
  const halfHeight = height / 2;

  visual.cover.fillStyle(0x3c403d, state === "empty" ? 0.9 : 0.82);
  visual.cover.fillPoints([
    new Phaser.Math.Vector2(offsetX - topWidth / 2, -halfHeight),
    new Phaser.Math.Vector2(offsetX + topWidth / 2, -halfHeight),
    new Phaser.Math.Vector2(offsetX + coverWidth / 2, halfHeight),
    new Phaser.Math.Vector2(offsetX - coverWidth / 2, halfHeight)
  ], true);

  visual.cover.lineStyle(4, 0xc5b47f, 0.9);
  for (let level = 1; level <= 4; level += 1) {
    const y = -halfHeight + (height / 5) * level;
    const perspective = 0.9 + (level / 4) * 0.1;
    visual.cover.lineBetween(
      offsetX - (coverWidth * perspective) / 2,
      y,
      offsetX + (coverWidth * perspective) / 2,
      y
    );
  }

  visual.cover.lineStyle(2, 0x69706a, 0.85);
  const columns = state === "empty" ? 4 : 2;
  for (let column = 1; column < columns; column += 1) {
    const x = offsetX - coverWidth / 2 + (coverWidth / columns) * column;
    visual.cover.lineBetween(x, -halfHeight + 8, x, halfHeight - 8);
  }
}

function updateControls(scene: RuntimeGame, controller: VerticalSliceController): void {
  const stock = controller.view === "stock";
  const overview = controller.view === "overview";
  const focused = !stock && !overview;
  const blocked = controller.transitioning || scene.restockBusy || scene.movingCart;

  controller.stockButton.container.setVisible(!stock && !blocked);
  controller.returnButton.container.setVisible(stock && !blocked);
  controller.overviewButton.container.setVisible(focused && !blocked);
  controller.focusHit.setVisible(focused && !blocked);
  controller.focusTitle.setVisible(focused);
  controller.focusSubtitle.setVisible(focused);

  controller.shelfVisuals.forEach((visual) => {
    visual.cover.setVisible(!stock);
    visual.overviewButton.container.setVisible(overview && !blocked);
  });

  if (focused) {
    const definition = SHELVES.find((candidate) => candidate.productId === controller.view)!;
    const slots = scene.shelfSlots.filter((slot) => slot.productId === controller.view);
    const filled = slots.filter((slot) => Boolean(slot.product?.active)).length;
    controller.focusTitle.setText(definition.title);
    controller.focusSubtitle.setText(
      filled === slots.length
        ? "FULLY STOCKED"
        : scene.cartAtShelf
          ? `TAP THE EMPTY BAY · ${filled}/${slots.length} FILLED`
          : `EMPTY BAYS ${filled}/${slots.length} · COLLECT CASES IN BACKROOM`
    );
  }
}

function layoutMainActors(scene: RuntimeGame, view: MainView): void {
  const cartVisible = scene.cartAtShelf;
  scene.cart.setVisible(cartVisible).setDepth(33);
  scene.worker.setVisible(true).setDepth(34);

  if (scene.movingCart || scene.restockBusy || scene.selectedBox) return;

  if (view === "overview") {
    if (cartVisible) scene.cart.setPosition(1040, 1010).setScale(0.68);
    scene.worker.setPosition(cartVisible ? 910 : 665, 1000).setDisplaySize(145, 290);
    return;
  }

  if (cartVisible) scene.cart.setPosition(985, 1015).setScale(0.72);
  scene.worker.setPosition(cartVisible ? 835 : 805, 995).setDisplaySize(150, 300);
}

function layoutStockRoom(scene: RuntimeGame): void {
  scene.cart.setVisible(true).setPosition(580, 960).setScale(0.78).setDepth(33);
  scene.worker.setVisible(true).setPosition(450, 950).setDisplaySize(160, 320).setDepth(34);

  scene.boxes.forEach((box, index) => {
    const point = STOCK_BOX_POINTS[box.positionIndex % STOCK_BOX_POINTS.length] ?? STOCK_BOX_POINTS[index % STOCK_BOX_POINTS.length];
    box.homeX = point.x;
    box.homeY = point.y;
    if (box.loaded) {
      box.image.setVisible(false);
      box.shadow.setVisible(false);
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

function hideActors(scene: RuntimeGame): void {
  scene.cart.setVisible(false);
  scene.worker.setVisible(false);
  scene.boxes.forEach((box) => {
    box.image.setVisible(false);
    box.shadow.setVisible(false);
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
      visible: boolean;
      setVisible: (visible: boolean) => unknown;
      getBounds?: () => Phaser.Geom.Rectangle;
    };
    if (!display.active) return;

    const bounds = display.getBounds?.();
    const top = bounds?.top ?? display.y;
    const bottom = bounds?.bottom ?? display.y;
    const isHud = display.depth >= 50 && (bottom <= 175 || top >= 1060);
    if (isHud) return;

    scene.tweens.killTweensOf(child);
    display.setVisible(false);
    child.disableInteractive();
  });
}

function lockSlotChrome(scene: RuntimeGame): void {
  scene.shelfSlots.forEach((slot) => {
    slot.hitArea.setVisible(false).disableInteractive();
    slot.missingTag?.setVisible(false).disableInteractive();
    slot.typeLabel?.setVisible(false).disableInteractive();
  });
}

function stopLeakedScenes(scene: RuntimeGame): void {
  ["back-stock", "day2-room-nav"].forEach((key) => {
    if (scene.scene.isActive(key)) scene.scene.stop(key);
  });
}

function runtimeSignature(scene: RuntimeGame, controller: VerticalSliceController): string {
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

function destroyExisting(scene: RuntimeGame): void {
  const existing = scene.__dayTwoVerticalSlice;
  if (!existing) return;
  existing.timer?.remove(false);
  existing.mainBackground.destroy();
  existing.stockBackground.destroy();
  existing.shelfVisuals.forEach((visual) => {
    visual.cover.destroy();
    visual.overviewButton.container.destroy(true);
  });
  existing.focusHit.destroy();
  existing.focusTitle.destroy();
  existing.focusSubtitle.destroy();
  existing.overviewButton.container.destroy(true);
  existing.stockButton.container.destroy(true);
  existing.returnButton.container.destroy(true);
  scene.__dayTwoVerticalSlice = undefined;
}

function mark<T extends Phaser.GameObjects.GameObject>(object: T): T {
  object.setData("dayTwoVerticalSlice", true);
  return object;
}
