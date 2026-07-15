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
  mainForeground: Phaser.GameObjects.Container;
  stockRoom: Phaser.GameObjects.Container;
  mainFixtures: FixtureVisual[];
  clickRing: Phaser.GameObjects.Image;
  backArrow: ArrowControl;
  floorArrow: ArrowControl;
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
    { x: 360, y: 630, bottomY: 760 },
    { x: 360, y: 800, bottomY: 930 }
  ],
  water: [
    { x: 700, y: 630, bottomY: 760 },
    { x: 700, y: 800, bottomY: 930 }
  ],
  milk: [
    { x: 1040, y: 630, bottomY: 760 },
    { x: 1040, y: 800, bottomY: 930 }
  ]
};

const STOCK_BOX_POINTS = [
  { x: 190, y: 505 },
  { x: 320, y: 505 },
  { x: 450, y: 505 },
  { x: 190, y: 610 },
  { x: 320, y: 610 },
  { x: 450, y: 610 }
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
  scene.__dayTwoImmersiveStore?.mainRoom.destroy(true);
  scene.__dayTwoImmersiveStore?.mainForeground.destroy(true);
  scene.__dayTwoImmersiveStore?.stockRoom.destroy(true);

  hideLegacyGameplay(scene);
  configureMainSlots(scene);
  scene.input.setDraggable(scene.cart, false);

  const mainRoom = createMainRoom(scene);
  const mainForeground = createMainForeground(scene);
  const stockRoom = createStockRoom(scene);
  const mainFixtures = createMainFixtures(scene, mainRoom);

  const clickRing = mark(
    scene.add.image(0, 0, ProductionAssets.effects.clickRing)
      .setDisplaySize(145, 145)
      .setDepth(8_930)
      .setAlpha(0.55)
      .setVisible(false)
  );
  scene.tweens.add({
    targets: clickRing,
    scale: { from: 0.92, to: 1.09 },
    alpha: { from: 0.32, to: 0.68 },
    duration: 720,
    yoyo: true,
    repeat: -1,
    ease: "Sine.InOut"
  });

  const backArrow = createArrow(scene, 180, "← BACKROOM", () => requestRoom(scene, "stock"));
  const floorArrow = createArrow(scene, 1145, "MAIN FLOOR →", () => requestRoom(scene, "main"));

  const controller: DayTwoStoreController = {
    room: "main",
    mainRoom,
    mainForeground,
    stockRoom,
    mainFixtures,
    clickRing,
    backArrow,
    floorArrow,
    lastSweepAt: -Infinity,
    transitionLocked: false,
    monitor: () => undefined
  };
  scene.__dayTwoImmersiveStore = controller;

  const monitor = (): void => {
    if (!scene.scene.isActive()) return;
    if (scene.time.now - controller.lastSweepAt < 65) return;
    controller.lastSweepAt = scene.time.now;

    hideLegacyGameplay(scene);
    applyRoomVisibility(scene, controller);
    updateFixtureTextures(scene, controller);
    updateRoomActors(scene, controller.room);
    updateClickGuide(scene, controller);

    document.body.dataset.dayTwoImmersiveRoom = controller.room;
  };

  controller.monitor = monitor;
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, monitor);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, monitor);
    mainRoom.destroy(true);
    mainForeground.destroy(true);
    stockRoom.destroy(true);
    clickRing.destroy();
    backArrow.container.destroy(true);
    floorArrow.container.destroy(true);
    scene.__dayTwoImmersiveStore = undefined;
    delete document.body.dataset.dayTwoImmersiveRoom;
  });

  monitor();
  scene.time.delayedCall(420, () => {
    if (!scene.scene.isActive() || gameSession.day !== "day02") return;
    scene.showTransientHint("Inspect the main floor, then use BACKROOM to load matching cases onto the cart.");
  });
}

function createMainRoom(scene: RuntimeGame): Phaser.GameObjects.Container {
  const room = mark(scene.add.container(0, 0).setDepth(2));
  const background = mark(
    scene.add.image(665, 622, SupermarketAssets.backgrounds.mainFloor)
      .setDisplaySize(1330, 960)
  );
  const atmosphere = mark(scene.add.rectangle(665, 622, 1330, 960, 0x08120f, 0.06));
  const floorLight = mark(scene.add.ellipse(665, 965, 1000, 180, 0xffe5a1, 0.08));
  const label = createRoomLabel(scene, 665, 245, "MAIN FLOOR · RESTOCK AISLES");
  room.add([background, atmosphere, floorLight, label]);
  return room;
}

function createMainForeground(scene: RuntimeGame): Phaser.GameObjects.Container {
  const foreground = mark(scene.add.container(0, 0).setDepth(35));
  const left = mark(
    scene.add.image(665, 591, ProductionAssets.foreground.aisleLeft)
      .setDisplaySize(1330, 1182)
      .setAlpha(0.38)
  );
  const right = mark(
    scene.add.image(665, 591, ProductionAssets.foreground.aisleRight)
      .setDisplaySize(1330, 1182)
      .setAlpha(0.34)
  );
  foreground.add([left, right]);
  return foreground;
}

function createStockRoom(scene: RuntimeGame): Phaser.GameObjects.Container {
  const room = mark(scene.add.container(0, 0).setDepth(2));
  const background = mark(
    scene.add.image(665, 622, ProductionAssets.backgrounds.stockDock)
      .setDisplaySize(1330, 960)
      .setAlpha(0.97)
  );
  const shade = mark(scene.add.rectangle(665, 622, 1330, 960, 0x07100d, 0.08));
  const rack = mark(
    scene.add.image(315, 1000, ProductionAssets.fixtures.rackBackroomEmpty)
      .setOrigin(0.5, 1)
      .setDisplaySize(530, 660)
  );
  const label = createRoomLabel(scene, 315, 245, "BACKROOM · LOAD THE CART");
  const loadingZone = mark(
    scene.add.rectangle(610, 930, 320, 170, 0x173f35, 0.18)
      .setStrokeStyle(4, 0xffd75a, 0.78)
  );
  room.add([background, shade, rack, label, loadingZone]);
  return room;
}

function createMainFixtures(scene: RuntimeGame, room: Phaser.GameObjects.Container): FixtureVisual[] {
  const specs: Array<{
    productId: ProductId;
    x: number;
    width: number;
    height: number;
    full: string;
    low: string;
    empty: string;
  }> = [
    {
      productId: "cola",
      x: 360,
      width: 285,
      height: 455,
      full: ProductionAssets.fixtures.bakeryFull,
      low: ProductionAssets.fixtures.bakeryLow,
      empty: ProductionAssets.fixtures.bakeryEmpty
    },
    {
      productId: "water",
      x: 700,
      width: 285,
      height: 455,
      full: ProductionAssets.fixtures.healthBeautyFull,
      low: ProductionAssets.fixtures.healthBeautyLow,
      empty: ProductionAssets.fixtures.healthBeautyEmpty
    },
    {
      productId: "milk",
      x: 1040,
      width: 330,
      height: 510,
      full: ProductionAssets.fixtures.frozenFull,
      low: ProductionAssets.fixtures.frozenLow,
      empty: ProductionAssets.fixtures.frozenEmpty
    }
  ];

  return specs.map((spec) => {
    const image = mark(
      scene.add.image(spec.x, 995, spec.empty)
        .setOrigin(0.5, 1)
        .setDisplaySize(spec.width, spec.height)
    );
    room.add(image);
    return { ...spec, image };
  });
}

function configureMainSlots(scene: RuntimeGame): void {
  const productOffsets: Record<ProductId, number> = { cola: 0, water: 0, milk: 0 };
  for (const slot of scene.shelfSlots) {
    const layout = MAIN_SLOT_LAYOUT[slot.productId][productOffsets[slot.productId]++] ?? MAIN_SLOT_LAYOUT[slot.productId][0];
    slot.hitArea
      .setPosition(layout.x, layout.y)
      .setSize(220, 160)
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
      controller.transitionLocked = false;
      controller.monitor();
    });
    return;
  }

  if (scene.selectedBox) {
    scene.showTransientHint("Return the selected case to the rack before leaving the main floor.");
    return;
  }

  controller.transitionLocked = true;
  if (scene.cartAtShelf) {
    scene.movingCart = true;
    scene.snapCart("WAREHOUSE");
  }
  runRoomTransition(scene, "BACKROOM", () => {
    controller.room = "stock";
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
    alpha: 0.82,
    duration: 150,
    onComplete: () => {
      onMidpoint();
      scene.tweens.add({ targets: text, alpha: 1, duration: 90 });
      scene.tweens.add({
        targets: [cover, text],
        alpha: 0,
        delay: 120,
        duration: 190,
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
  controller.mainForeground.setVisible(main);
  controller.stockRoom.setVisible(!main);
  controller.backArrow.container.setVisible(main && !controller.transitionLocked);
  controller.floorArrow.container.setVisible(!main && !controller.transitionLocked);
  controller.backArrow.hit.input!.enabled = main && !controller.transitionLocked;
  controller.floorArrow.hit.input!.enabled = !main && !controller.transitionLocked;

  for (const slot of scene.shelfSlots) {
    slot.hitArea.setVisible(main);
    if (slot.hitArea.input) slot.hitArea.input.enabled = main && !controller.transitionLocked;
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
    scene.cart.setPosition(610, 970);
    scene.worker.setPosition(505, 970);
    layoutStockBoxes(scene);
    return;
  }

  scene.cart.setPosition(675, 1020);
  scene.worker.setPosition(545, 1020);
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
  if (controller.room !== "main" || controller.transitionLocked || scene.shiftEnded) {
    controller.clickRing.setVisible(false);
    return;
  }

  const target = scene.shelfSlots.find((slot) => !slot.product?.active);
  if (!target) {
    controller.clickRing.setVisible(false);
    return;
  }

  controller.clickRing.setPosition(target.hitArea.x, target.hitArea.y).setVisible(true);
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
  const container = mark(scene.add.container(x, 1015, [background, text, hit]).setDepth(9_100));

  hit.on("pointerdown", action);
  hit.on("pointerover", () => container.setScale(1.035));
  hit.on("pointerout", () => container.setScale(1));
  return { container, hit };
}

function createRoomLabel(scene: RuntimeGame, x: number, y: number, label: string): Phaser.GameObjects.Container {
  const background = mark(
    scene.add.rectangle(0, 0, 420, 56, 0x173f35, 0.95)
      .setStrokeStyle(3, 0xffd75a, 1)
  );
  const text = mark(
    scene.add.text(0, 0, label, {
      fontFamily: "Arial",
      fontSize: "20px",
      color: "#ffffff",
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
    if (!display.active) return;

    if (child instanceof Phaser.GameObjects.Text) {
      if (display.y >= 160 && display.y <= 1070 && display.depth <= 90) display.setVisible(false);
      return;
    }

    if (
      child instanceof Phaser.GameObjects.Image ||
      child instanceof Phaser.GameObjects.Rectangle ||
      child instanceof Phaser.GameObjects.Ellipse ||
      child instanceof Phaser.GameObjects.Container
    ) {
      if (display.y >= 160 && display.y <= 1070 && display.depth <= 50) display.setVisible(false);
    }
  });
}

function mark<T extends Phaser.GameObjects.GameObject>(object: T): T {
  object.setData("dayTwoImmersive", true);
  return object;
}
