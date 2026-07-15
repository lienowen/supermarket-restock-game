import Phaser from "phaser";
import { GameScene } from "./scenes/GameScene";
import { gameSession } from "./systems/GameSession";
import { SupermarketAssets, SupermarketBackgroundPaths } from "./supermarketAssets";
import { ProductionAssetPaths, ProductionAssets } from "./supermarketProductionAssets";

type DayTwoRoom = "main" | "stock";
type ProductId = "cola" | "water" | "milk";
type FixtureState = "empty" | "low" | "full";

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
  departureRequirement: () => number;
  snapCart: (destination: "WAREHOUSE" | "SALES") => void;
  showTransientHint: (message: string) => void;
  __dayTwoImmersiveStore?: DayTwoStoreController;
};

type GamePrototype = {
  preload: () => void;
  create: (...args: unknown[]) => void;
};

type FixtureVisual = {
  productId: ProductId;
  image: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
  label: Phaser.GameObjects.Container;
  empty: string;
  low: string;
  full: string;
  width: number;
  height: number;
};

type ArrowControl = {
  container: Phaser.GameObjects.Container;
  hit: Phaser.GameObjects.Rectangle;
};

type DayTwoStoreController = {
  room: DayTwoRoom;
  mainRoom: Phaser.GameObjects.Container;
  stockRoom: Phaser.GameObjects.Container;
  mainFixtures: FixtureVisual[];
  clickRing: Phaser.GameObjects.Image;
  backArrow: ArrowControl;
  floorArrow: ArrowControl;
  knownFilledSlots: Set<number>;
  guideExpiresAt: number;
  lastSweepAt: number;
  transitionLocked: boolean;
  monitor: () => void;
};

type DisplayObject = Phaser.GameObjects.GameObject & {
  active: boolean;
  visible: boolean;
  x: number;
  y: number;
  depth: number;
  setVisible: (value: boolean) => DisplayObject;
};

const MAIN_SLOT_LAYOUT: Record<ProductId, Array<{ x: number; y: number; bottomY: number }>> = {
  cola: [
    { x: 330, y: 640, bottomY: 750 },
    { x: 330, y: 790, bottomY: 900 }
  ],
  water: [
    { x: 665, y: 640, bottomY: 750 },
    { x: 665, y: 790, bottomY: 900 }
  ],
  milk: [
    { x: 1000, y: 640, bottomY: 750 },
    { x: 1000, y: 790, bottomY: 900 }
  ]
};

const STOCK_BOX_POINTS = [
  { x: 182, y: 505 },
  { x: 312, y: 505 },
  { x: 442, y: 505 },
  { x: 182, y: 610 },
  { x: 312, y: 610 },
  { x: 442, y: 610 }
] as const;

const prototype = GameScene.prototype as unknown as GamePrototype;
const originalPreload = prototype.preload;
const originalCreate = prototype.create;

prototype.preload = function preloadDayTwoImmersiveStore(): void {
  originalPreload.call(this);
  const scene = this as unknown as Phaser.Scene;
  if (gameSession.day !== "day02") return;

  const paths = {
    ...SupermarketBackgroundPaths,
    ...ProductionAssetPaths
  };
  Object.entries(paths).forEach(([key, path]) => {
    if (!scene.textures.exists(key)) scene.load.image(key, path);
  });
};

prototype.create = function createDayTwoImmersiveStore(...args: unknown[]): void {
  originalCreate.apply(this, args);
  const scene = this as unknown as RuntimeGame;
  if (gameSession.day !== "day02") return;

  installDayTwoStore(scene);
};

function installDayTwoStore(scene: RuntimeGame): void {
  destroyExistingController(scene);
  hideLegacyGameplay(scene);
  configureMainSlots(scene);
  scene.input.setDraggable(scene.cart, false);

  const mainRoom = createMainRoom(scene);
  const stockRoom = createStockRoom(scene);
  const mainFixtures = createMainFixtures(scene, mainRoom);

  const clickRing = mark(
    scene.add.image(0, 0, ProductionAssets.effects.clickRing)
      .setDisplaySize(132, 132)
      .setDepth(8_930)
      .setAlpha(0.5)
      .setVisible(false)
  );

  const backArrow = createArrow(scene, 170, "← BACKROOM", () => requestRoom(scene, "stock"));
  const floorArrow = createArrow(scene, 1160, "MAIN FLOOR →", () => requestRoom(scene, "main"));

  const controller: DayTwoStoreController = {
    room: "main",
    mainRoom,
    stockRoom,
    mainFixtures,
    clickRing,
    backArrow,
    floorArrow,
    knownFilledSlots: new Set(filledSlotIndexes(scene)),
    guideExpiresAt: -Infinity,
    lastSweepAt: -Infinity,
    transitionLocked: false,
    monitor: () => undefined
  };
  scene.__dayTwoImmersiveStore = controller;

  const monitor = (): void => {
    if (!scene.scene.isActive()) return;
    if (scene.time.now - controller.lastSweepAt < 120) return;
    controller.lastSweepAt = scene.time.now;

    applyRoomVisibility(scene, controller);
    updateFixtureTextures(scene, controller);
    updateRoomActors(scene, controller.room);
    updateClickGuide(scene, controller);
    detectRestock(scene, controller);

    document.body.dataset.dayTwoImmersiveRoom = controller.room;
  };

  controller.monitor = monitor;
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, monitor);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, monitor);
    mainRoom.destroy(true);
    stockRoom.destroy(true);
    clickRing.destroy();
    backArrow.container.destroy(true);
    floorArrow.container.destroy(true);
    scene.__dayTwoImmersiveStore = undefined;
    delete document.body.dataset.dayTwoImmersiveRoom;
  });

  monitor();
  pulseArrowOnce(scene, backArrow.container);

  scene.time.delayedCall(0, () => hideLegacyGameplay(scene));
  scene.time.delayedCall(220, () => hideLegacyGameplay(scene));
  scene.time.delayedCall(650, () => hideLegacyGameplay(scene));
  scene.time.delayedCall(420, () => {
    if (!scene.scene.isActive() || gameSession.day !== "day02") return;
    scene.showTransientHint("The store floor is open. Enter BACKROOM, load matching cases, then return to restock the aisles.");
  });
}

function destroyExistingController(scene: RuntimeGame): void {
  const existing = scene.__dayTwoImmersiveStore;
  if (!existing) return;
  existing.mainRoom.destroy(true);
  existing.stockRoom.destroy(true);
  existing.clickRing.destroy();
  existing.backArrow.container.destroy(true);
  existing.floorArrow.container.destroy(true);
  scene.__dayTwoImmersiveStore = undefined;
}

function createMainRoom(scene: RuntimeGame): Phaser.GameObjects.Container {
  const room = mark(scene.add.container(0, 0).setDepth(4));
  const background = mark(
    scene.add.image(665, 622, SupermarketAssets.backgrounds.mainFloor)
      .setDisplaySize(1330, 960)
  );
  const atmosphere = mark(scene.add.rectangle(665, 622, 1330, 960, 0x08120f, 0.035));
  const aisleGlow = mark(scene.add.ellipse(665, 960, 760, 145, 0xffe4a0, 0.07));
  const label = createRoomLabel(scene, 665, 225, "MAIN FLOOR · RESTOCK AISLES");
  room.add([background, atmosphere, aisleGlow, label]);
  return room;
}

function createStockRoom(scene: RuntimeGame): Phaser.GameObjects.Container {
  const room = mark(scene.add.container(0, 0).setDepth(4));
  const background = mark(
    scene.add.image(665, 622, ProductionAssets.backgrounds.stockDock)
      .setDisplaySize(1330, 960)
      .setAlpha(0.98)
  );
  const shade = mark(scene.add.rectangle(665, 622, 1330, 960, 0x07100d, 0.05));
  const rackShadow = mark(scene.add.ellipse(320, 997, 520, 82, 0x07100d, 0.25));
  const rack = mark(
    scene.add.image(315, 995, ProductionAssets.fixtures.rackBackroomEmpty)
      .setOrigin(0.5, 1)
      .setDisplaySize(530, 660)
  );
  const label = createRoomLabel(scene, 315, 225, "BACKROOM · LOAD THE CART");
  const loadingZone = mark(
    scene.add.rectangle(760, 930, 360, 175, 0x173f35, 0.13)
      .setStrokeStyle(3, 0xffd75a, 0.62)
  );
  const loadingLabel = mark(
    scene.add.text(760, 858, "CART LOADING ZONE", {
      fontFamily: "Arial",
      fontSize: "15px",
      color: "#fff1b0",
      fontStyle: "bold",
      backgroundColor: "#173f35",
      padding: { x: 12, y: 6 }
    }).setOrigin(0.5)
  );
  room.add([background, shade, rackShadow, rack, label, loadingZone, loadingLabel]);
  return room;
}

function createMainFixtures(scene: RuntimeGame, room: Phaser.GameObjects.Container): FixtureVisual[] {
  const specs: Array<{
    productId: ProductId;
    department: string;
    x: number;
    bottomY: number;
    width: number;
    height: number;
    empty: string;
    low: string;
    full: string;
  }> = [
    {
      productId: "cola",
      department: "DRINKS",
      x: 330,
      bottomY: 965,
      width: 250,
      height: 380,
      empty: ProductionAssets.fixtures.checkoutEmpty,
      low: ProductionAssets.fixtures.checkoutLow,
      full: ProductionAssets.fixtures.checkoutFull
    },
    {
      productId: "water",
      department: "WATER",
      x: 665,
      bottomY: 965,
      width: 245,
      height: 405,
      empty: ProductionAssets.fixtures.healthBeautyEmpty,
      low: ProductionAssets.fixtures.healthBeautyLow,
      full: ProductionAssets.fixtures.healthBeautyFull
    },
    {
      productId: "milk",
      department: "DAIRY",
      x: 1000,
      bottomY: 965,
      width: 300,
      height: 470,
      empty: ProductionAssets.fixtures.frozenEmpty,
      low: ProductionAssets.fixtures.frozenLow,
      full: ProductionAssets.fixtures.frozenFull
    }
  ];

  return specs.map((spec) => {
    const shadow = mark(scene.add.ellipse(spec.x, spec.bottomY + 6, spec.width * 0.82, 52, 0x07100d, 0.22));
    const image = mark(
      scene.add.image(spec.x, spec.bottomY, spec.empty)
        .setOrigin(0.5, 1)
        .setDisplaySize(spec.width, spec.height)
    );
    const label = createDepartmentLabel(scene, spec.x, spec.bottomY - spec.height - 22, spec.department);
    room.add([shadow, image, label]);
    return { ...spec, image, shadow, label };
  });
}

function configureMainSlots(scene: RuntimeGame): void {
  const productOffsets: Record<ProductId, number> = { cola: 0, water: 0, milk: 0 };
  for (const slot of scene.shelfSlots) {
    const layout = MAIN_SLOT_LAYOUT[slot.productId][productOffsets[slot.productId]++] ?? MAIN_SLOT_LAYOUT[slot.productId][0];
    slot.hitArea
      .setPosition(layout.x, layout.y)
      .setSize(220, 150)
      .setVisible(true)
      .setDepth(28);
    slot.productBottomY = layout.bottomY;
    slot.missingTag?.setVisible(false);
    slot.typeLabel?.setVisible(false);
    slot.product?.setVisible(false);
  }
}

function requestRoom(scene: RuntimeGame, target: DayTwoRoom): void {
  const controller = scene.__dayTwoImmersiveStore;
  if (!controller || target === controller.room || controller.transitionLocked) return;
  if (scene.shiftEnded || scene.movingCart || scene.restockBusy) return;

  if (target === "main") {
    if (scene.selectedBox) {
      scene.showTransientHint("Place the selected case on the cart before returning to the main floor.");
      return;
    }

    const required = Math.max(1, scene.departureRequirement());
    if (scene.loadedProducts.length < required) {
      scene.showTransientHint(`Load ${required - scene.loadedProducts.length} more case(s) before entering the main floor.`);
      return;
    }

    controller.transitionLocked = true;
    scene.movingCart = true;
    scene.snapCart("SALES");
    runRoomTransition(scene, "MAIN FLOOR", () => {
      controller.room = "main";
      controller.guideExpiresAt = scene.time.now + 1300;
      controller.transitionLocked = false;
      controller.monitor();
    });
    return;
  }

  if (scene.selectedBox) {
    scene.showTransientHint("Return the selected case before entering the backroom.");
    return;
  }

  controller.transitionLocked = true;
  if (scene.cartAtShelf) {
    scene.movingCart = true;
    scene.snapCart("WAREHOUSE");
  }
  runRoomTransition(scene, "BACKROOM", () => {
    controller.room = "stock";
    controller.guideExpiresAt = -Infinity;
    controller.transitionLocked = false;
    controller.monitor();
  });
}

function runRoomTransition(scene: RuntimeGame, label: string, onMidpoint: () => void): void {
  const cover = mark(
    scene.add.rectangle(665, 622, 1330, 960, 0x07100d, 0)
      .setDepth(9_500)
      .setInteractive()
  );
  const text = mark(
    scene.add.text(665, 610, label, {
      fontFamily: "Arial",
      fontSize: "38px",
      color: "#fff0ad",
      fontStyle: "bold",
      stroke: "#10251c",
      strokeThickness: 8
    }).setOrigin(0.5).setDepth(9_501).setAlpha(0)
  );

  scene.tweens.add({
    targets: cover,
    alpha: 0.78,
    duration: 150,
    onComplete: () => {
      onMidpoint();
      scene.tweens.add({ targets: text, alpha: 1, duration: 80 });
      scene.tweens.add({
        targets: [cover, text],
        alpha: 0,
        delay: 110,
        duration: 180,
        onComplete: () => {
          cover.destroy();
          text.destroy();
        }
      });
    }
  });
}

function applyRoomVisibility(scene: RuntimeGame, controller: DayTwoStoreController): void {
  const main = controller.room === "main";
  controller.mainRoom.setVisible(main);
  controller.stockRoom.setVisible(!main);
  controller.backArrow.container.setVisible(main && !controller.transitionLocked);
  controller.floorArrow.container.setVisible(!main && !controller.transitionLocked);
  if (controller.backArrow.hit.input) controller.backArrow.hit.input.enabled = main && !controller.transitionLocked;
  if (controller.floorArrow.hit.input) controller.floorArrow.hit.input.enabled = !main && !controller.transitionLocked;

  const shelfInteractive = main && scene.cartAtShelf && !controller.transitionLocked;
  for (const slot of scene.shelfSlots) {
    slot.hitArea.setVisible(main);
    if (slot.hitArea.input) slot.hitArea.input.enabled = shelfInteractive;
    slot.missingTag?.setVisible(false);
    slot.typeLabel?.setVisible(false);
    slot.product?.setVisible(false);
  }

  scene.boxes.forEach((box) => {
    const visible = !main && !box.loaded;
    box.image.setVisible(visible);
    box.shadow.setVisible(visible);
    if (box.image.input) box.image.input.enabled = visible && !scene.cartAtShelf && !controller.transitionLocked;
  });
}

function updateFixtureTextures(scene: RuntimeGame, controller: DayTwoStoreController): void {
  controller.mainFixtures.forEach((fixture) => {
    const state = fixtureState(scene, fixture.productId);
    fixture.image
      .setTexture(fixture[state])
      .setDisplaySize(fixture.width, fixture.height);
  });
}

function fixtureState(scene: RuntimeGame, productId: ProductId): FixtureState {
  const slots = scene.shelfSlots.filter((slot) => slot.productId === productId);
  const filled = slots.filter((slot) => Boolean(slot.product?.active)).length;
  if (filled === 0) return "empty";
  if (filled < slots.length) return "low";
  return "full";
}

function updateRoomActors(scene: RuntimeGame, room: DayTwoRoom): void {
  scene.cart.setVisible(true).setDepth(32);
  scene.worker.setVisible(true).setDepth(33);

  if (scene.movingCart || scene.restockBusy || scene.selectedBox) return;

  if (room === "stock") {
    scene.cart.setPosition(760, 995);
    scene.worker.setPosition(625, 995);
    layoutStockBoxes(scene);
    return;
  }

  scene.cart.setPosition(700, 1020);
  scene.worker.setPosition(565, 1020);
}

function layoutStockBoxes(scene: RuntimeGame): void {
  scene.boxes.forEach((box, index) => {
    const point = STOCK_BOX_POINTS[box.positionIndex % STOCK_BOX_POINTS.length] ?? STOCK_BOX_POINTS[index % STOCK_BOX_POINTS.length];
    box.homeX = point.x;
    box.homeY = point.y;
    const dragging = scene.selectedBox === box && scene.input.activePointer.isDown;
    if (box.loaded || dragging) return;

    box.image
      .setPosition(point.x, point.y)
      .setOrigin(0.5, 1)
      .setDisplaySize(96, 96)
      .setDepth(23 + point.y / 10_000);
    box.shadow
      .setPosition(point.x, point.y + 2)
      .setDisplaySize(68, 13)
      .setAlpha(0.15)
      .setDepth(22 + point.y / 10_000);
  });
}

function updateClickGuide(scene: RuntimeGame, controller: DayTwoStoreController): void {
  const active =
    controller.room === "main" &&
    scene.cartAtShelf &&
    !controller.transitionLocked &&
    !scene.shiftEnded &&
    scene.time.now <= controller.guideExpiresAt;

  if (!active) {
    controller.clickRing.setVisible(false);
    return;
  }

  const target = scene.shelfSlots.find((slot) => !slot.product?.active && scene.loadedProducts.includes(slot.productId));
  if (!target) {
    controller.clickRing.setVisible(false);
    return;
  }

  controller.clickRing
    .setPosition(target.hitArea.x, target.hitArea.y)
    .setVisible(true);
}

function detectRestock(scene: RuntimeGame, controller: DayTwoStoreController): void {
  const current = new Set(filledSlotIndexes(scene));
  const newlyFilled = scene.shelfSlots.find(
    (slot) => current.has(slot.index) && !controller.knownFilledSlots.has(slot.index)
  );
  if (newlyFilled) showRestockedTag(scene, newlyFilled.hitArea.x, newlyFilled.hitArea.y - 105);
  controller.knownFilledSlots = current;
}

function showRestockedTag(scene: Phaser.Scene, x: number, y: number): void {
  const tag = mark(
    scene.add.image(x, y, ProductionAssets.effects.restocked)
      .setDisplaySize(225, 76)
      .setDepth(8_940)
      .setScale(0.72)
      .setAlpha(0)
  );

  scene.tweens.add({
    targets: tag,
    y: y - 38,
    scale: 1,
    alpha: 1,
    duration: 190,
    ease: "Back.Out",
    onComplete: () => {
      scene.tweens.add({
        targets: tag,
        y: y - 68,
        alpha: 0,
        delay: 360,
        duration: 240,
        onComplete: () => tag.destroy()
      });
    }
  });
}

function filledSlotIndexes(scene: RuntimeGame): number[] {
  return scene.shelfSlots
    .filter((slot) => Boolean(slot.product?.active))
    .map((slot) => slot.index);
}

function createArrow(scene: RuntimeGame, x: number, label: string, action: () => void): ArrowControl {
  const background = mark(
    scene.add.rectangle(0, 0, 270, 70, 0x173f35, 0.97)
      .setStrokeStyle(4, 0xffd75a, 1)
  );
  const text = mark(
    scene.add.text(0, 0, label, {
      fontFamily: "Arial",
      fontSize: "19px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setOrigin(0.5)
  );
  const hit = mark(
    scene.add.rectangle(0, 0, 285, 82, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true })
  );
  const container = mark(scene.add.container(x, 1018, [background, text, hit]).setDepth(9_100));

  hit.on("pointerdown", action);
  hit.on("pointerover", () => container.setScale(1.025));
  hit.on("pointerout", () => container.setScale(1));
  return { container, hit };
}

function pulseArrowOnce(scene: Phaser.Scene, arrow: Phaser.GameObjects.Container): void {
  scene.tweens.add({
    targets: arrow,
    scale: 1.045,
    duration: 260,
    yoyo: true,
    repeat: 1,
    ease: "Sine.InOut"
  });
}

function createRoomLabel(scene: RuntimeGame, x: number, y: number, label: string): Phaser.GameObjects.Container {
  const background = mark(
    scene.add.rectangle(0, 0, 430, 52, 0x173f35, 0.91)
      .setStrokeStyle(3, 0xffd75a, 0.92)
  );
  const text = mark(
    scene.add.text(0, 0, label, {
      fontFamily: "Arial",
      fontSize: "19px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setOrigin(0.5)
  );
  return mark(scene.add.container(x, y, [background, text]));
}

function createDepartmentLabel(scene: RuntimeGame, x: number, y: number, label: string): Phaser.GameObjects.Container {
  const background = mark(
    scene.add.rectangle(0, 0, 145, 38, 0x112f29, 0.9)
      .setStrokeStyle(2, 0xe2c765, 0.75)
  );
  const text = mark(
    scene.add.text(0, 0, label, {
      fontFamily: "Arial",
      fontSize: "14px",
      color: "#fff6c7",
      fontStyle: "bold"
    }).setOrigin(0.5)
  );
  return mark(scene.add.container(x, y, [background, text]));
}

function hideLegacyGameplay(scene: RuntimeGame): void {
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

  scene.children.list.forEach((child) => {
    if (protectedObjects.has(child) || child.getData("dayTwoImmersive")) return;
    const display = child as DisplayObject;
    if (!display.active || display.depth >= 50) return;

    if (child instanceof Phaser.GameObjects.Container) {
      display.setVisible(false);
      return;
    }

    if (
      child instanceof Phaser.GameObjects.Text ||
      child instanceof Phaser.GameObjects.Image ||
      child instanceof Phaser.GameObjects.Rectangle ||
      child instanceof Phaser.GameObjects.Ellipse
    ) {
      if (display.y >= 150 && display.y <= 1085) display.setVisible(false);
    }
  });
}

function mark<T extends Phaser.GameObjects.GameObject>(object: T): T {
  object.setData("dayTwoImmersive", true);
  return object;
}
