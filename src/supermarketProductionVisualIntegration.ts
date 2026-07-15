import Phaser from "phaser";
import { GameScene } from "./scenes/GameScene";
import { gameSession } from "./systems/GameSession";
import { ProductionAssetPaths, ProductionAssets } from "./supermarketProductionAssets";

type SupportedDay = "day02" | "day03" | "day04" | "day05";
type SpaceDay = "day03" | "day04" | "day05";
type RoomId = "stock" | "main" | "promotion" | "cold";
type FixtureState = "empty" | "low" | "full";

type RuntimeBox = {
  loaded: boolean;
  image: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
  positionIndex?: number;
  homeX?: number;
  homeY?: number;
};

type RuntimeSlot = {
  index: number;
  hitArea: Phaser.GameObjects.Rectangle;
  missingTag?: Phaser.GameObjects.Image;
  typeLabel?: Phaser.GameObjects.Text;
  product?: Phaser.GameObjects.Image;
};

type RuntimeAdapter = {
  slots: RuntimeSlot[];
};

type RoomDefinition = {
  id: RoomId;
  fixtureIds: string[];
};

type RuntimeController = {
  activeRoom: RoomId;
  definitions: RoomDefinition[];
  adapters: Map<string, RuntimeAdapter>;
  navigation: Phaser.GameObjects.Container;
};

type FixtureVisual = {
  image: Phaser.GameObjects.Image;
  empty: string;
  low: string;
  full: string;
  fixtureId?: string;
  fixedState?: FixtureState;
};

type RoomVisual = {
  base: Phaser.GameObjects.Container;
  foreground: Phaser.GameObjects.Container;
  fixtures: FixtureVisual[];
  status: Phaser.GameObjects.Image;
};

type DisplayObject = Phaser.GameObjects.GameObject & {
  active: boolean;
  visible: boolean;
  x: number;
  y: number;
  depth: number;
  setVisible: (visible: boolean) => DisplayObject;
};

type ProductionVisuals = {
  rooms: Record<RoomId, RoomVisual>;
  clickRing: Phaser.GameObjects.Image;
  knownFilledSlots: Set<number>;
  lastRoom?: RoomId;
  lastRefreshAt: number;
  monitor: () => void;
};

type RuntimeGame = Phaser.Scene & {
  boxes?: RuntimeBox[];
  shelfSlots?: RuntimeSlot[];
  selectedBox?: RuntimeBox;
  movingCart?: boolean;
  restockBusy?: boolean;
  shiftEnded?: boolean;
  cart?: Phaser.GameObjects.Container;
  worker?: Phaser.GameObjects.Image;
  __weekOneSpaceController?: RuntimeController;
  __productionVisuals?: ProductionVisuals;
};

type GamePrototype = {
  preload: () => void;
  create: (...args: unknown[]) => void;
};

type FixtureSpec = {
  fixtureId?: string;
  x: number;
  bottomY: number;
  width: number;
  height: number;
  full: string;
  low: string;
  empty: string;
  fixedState?: FixtureState;
};

const ROOM_LABELS: Record<RoomId, string> = {
  stock: "BACKROOM STOCK",
  main: "MAIN FLOOR",
  promotion: "PROMOTION WING",
  cold: "COLD CASE"
};

const BOX_SHELF_POINTS = [
  { x: 178, y: 487 },
  { x: 310, y: 487 },
  { x: 442, y: 487 },
  { x: 178, y: 585 },
  { x: 310, y: 585 },
  { x: 442, y: 585 }
] as const;

installProductionVisuals();

function installProductionVisuals(): void {
  const prototype = GameScene.prototype as unknown as GamePrototype;
  const originalPreload = prototype.preload;
  const originalCreate = prototype.create;

  prototype.preload = function preloadProductionVisuals(): void {
    originalPreload.call(this);
    const scene = this as unknown as Phaser.Scene;
    if (!isSupportedDay(gameSession.day)) return;

    Object.entries(ProductionAssetPaths).forEach(([key, path]) => {
      if (!scene.textures.exists(key)) scene.load.image(key, path);
    });
  };

  prototype.create = function createProductionVisuals(...args: unknown[]): void {
    originalCreate.apply(this, args);
    const scene = this as unknown as RuntimeGame;
    if (!isSupportedDay(gameSession.day)) return;

    hideLegacyRoomVisuals(scene);

    if (gameSession.day === "day02") {
      installDayTwoVisuals(scene);
      return;
    }

    installRoomVisuals(scene, gameSession.day);
  };
}

function installDayTwoVisuals(scene: RuntimeGame): void {
  const stockBackground = scene.add.image(339, 622, ProductionAssets.backgrounds.stockDock)
    .setDisplaySize(678, 924)
    .setDepth(3)
    .setAlpha(0.9);
  const rack = scene.add.image(260, 990, ProductionAssets.fixtures.rackBackroomEmpty)
    .setOrigin(0.5, 1)
    .setDisplaySize(470, 590)
    .setDepth(20);

  const shelfSpecs: FixtureSpec[] = [
    {
      x: 820,
      bottomY: 970,
      width: 190,
      height: 350,
      full: ProductionAssets.fixtures.bakeryFull,
      low: ProductionAssets.fixtures.bakeryLow,
      empty: ProductionAssets.fixtures.bakeryEmpty
    },
    {
      x: 1000,
      bottomY: 970,
      width: 190,
      height: 350,
      full: ProductionAssets.fixtures.healthBeautyFull,
      low: ProductionAssets.fixtures.healthBeautyLow,
      empty: ProductionAssets.fixtures.healthBeautyEmpty
    },
    {
      x: 1180,
      bottomY: 970,
      width: 190,
      height: 350,
      full: ProductionAssets.fixtures.frozenFull,
      low: ProductionAssets.fixtures.frozenLow,
      empty: ProductionAssets.fixtures.frozenEmpty
    }
  ];

  const shelves = shelfSpecs.map((spec) => {
    const visual = createFixture(scene, spec);
    visual.image.setDepth(20);
    return visual;
  });

  const backLabel = createRoomLabel(scene, 260, 250, "BACKROOM").setDepth(42);
  const floorLabel = createRoomLabel(scene, 1000, 250, "MAIN FLOOR").setDepth(42);

  const monitor = (): void => {
    if (!scene.scene.isActive()) return;
    layoutBoxesOnRack(scene);
    keepActorsAboveFixtures(scene);
    hideSlotChrome(scene);

    shelves.forEach((shelf, index) => {
      const targetX = shelfSpecs[index].x;
      const slotIndexes = slotIndexesNear(scene, targetX, 92);
      const state = fixtureStateForSlots(scene, slotIndexes);
      shelf.image.setTexture(shelf[state]);
    });
  };

  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, monitor);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, monitor);
    stockBackground.destroy();
    rack.destroy();
    shelves.forEach((shelf) => shelf.image.destroy());
    backLabel.destroy(true);
    floorLabel.destroy(true);
    delete document.body.dataset.productionSupermarket;
  });

  monitor();
  document.body.dataset.productionSupermarket = "day02";
}

function installRoomVisuals(scene: RuntimeGame, day: SpaceDay): void {
  const controller = scene.__weekOneSpaceController;
  if (!controller) return;

  const rooms: Record<RoomId, RoomVisual> = {
    stock: createStockRoom(scene),
    main: createMainRoom(scene, day),
    promotion: createPromotionRoom(scene, day),
    cold: createColdRoom(scene, day)
  };

  const clickRing = scene.add.image(0, 0, ProductionAssets.effects.clickRing)
    .setDisplaySize(150, 150)
    .setDepth(8_890)
    .setAlpha(0.58)
    .setVisible(false);

  scene.tweens.add({
    targets: clickRing,
    scale: { from: 0.92, to: 1.08 },
    alpha: { from: 0.38, to: 0.68 },
    duration: 760,
    yoyo: true,
    repeat: -1,
    ease: "Sine.InOut"
  });

  const visuals: ProductionVisuals = {
    rooms,
    clickRing,
    knownFilledSlots: new Set(filledSlotIndexes(scene)),
    lastRefreshAt: -Infinity,
    monitor: () => undefined
  };
  scene.__productionVisuals = visuals;

  const monitor = (): void => {
    if (!scene.scene.isActive()) return;
    if (scene.time.now - visuals.lastRefreshAt < 70) return;
    visuals.lastRefreshAt = scene.time.now;

    const activeRoom = controller.activeRoom;
    controller.navigation.setVisible(false);
    layoutBoxesOnRack(scene);
    keepActorsAboveFixtures(scene);
    hideSlotChrome(scene);

    (Object.keys(rooms) as RoomId[]).forEach((room) => {
      const visible = room === activeRoom;
      rooms[room].base.setVisible(visible);
      rooms[room].foreground.setVisible(visible);
      rooms[room].status.setVisible(visible);
    });

    updateFixtureStates(scene, controller, visuals, activeRoom);
    updateMissingSlotGuide(scene, controller, visuals, activeRoom);
    detectRestock(scene, visuals);

    if (visuals.lastRoom !== activeRoom) {
      const room = rooms[activeRoom];
      room.base.setAlpha(0.2);
      room.foreground.setAlpha(0.2);
      scene.tweens.add({
        targets: [room.base, room.foreground],
        alpha: 1,
        duration: 260,
        ease: "Sine.Out"
      });
      visuals.lastRoom = activeRoom;
    }

    document.body.dataset.productionSupermarket = `${gameSession.day}:${activeRoom}`;
  };

  visuals.monitor = monitor;
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, monitor);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, monitor);
    (Object.values(rooms) as RoomVisual[]).forEach((room) => {
      room.base.destroy(true);
      room.foreground.destroy(true);
      room.status.destroy();
    });
    clickRing.destroy();
    scene.__productionVisuals = undefined;
    delete document.body.dataset.productionSupermarket;
  });

  monitor();
}

function createStockRoom(scene: RuntimeGame): RoomVisual {
  const base = scene.add.container(0, 0).setDepth(18);
  const foreground = scene.add.container(0, 0).setDepth(34);

  const background = scene.add.image(665, 622, ProductionAssets.backgrounds.stockDock)
    .setDisplaySize(1330, 960)
    .setAlpha(0.94);
  const shade = scene.add.rectangle(665, 622, 1330, 960, 0x071311, 0.1);
  const rack = createFixture(scene, {
    x: 310,
    bottomY: 990,
    width: 500,
    height: 625,
    full: ProductionAssets.fixtures.rackBackroomEmpty,
    low: ProductionAssets.fixtures.rackBackroomEmpty,
    empty: ProductionAssets.fixtures.rackBackroomEmpty,
    fixedState: "full"
  });

  base.add([background, shade, rack.image, createRoomLabel(scene, 310, 275, ROOM_LABELS.stock)]);
  const status = createStatus(scene, 310, 335);
  return { base, foreground, fixtures: [rack], status };
}

function createMainRoom(scene: RuntimeGame, day: SpaceDay): RoomVisual {
  const base = createRoomBase(scene, ROOM_LABELS.main);
  const foreground = scene.add.container(0, 0).setDepth(34);
  const specs = mainFixtureSpecs(day);
  const fixtures = specs.map((spec) => createFixture(scene, spec));
  base.add(fixtures.map((fixture) => fixture.image));

  const left = scene.add.image(665, 591, ProductionAssets.foreground.aisleLeft)
    .setDisplaySize(1330, 1182)
    .setAlpha(0.58);
  const right = scene.add.image(665, 591, ProductionAssets.foreground.aisleRight)
    .setDisplaySize(1330, 1182)
    .setAlpha(0.48);
  foreground.add([left, right]);

  const status = createStatus(scene, 665, 335);
  return { base, foreground, fixtures, status };
}

function createPromotionRoom(scene: RuntimeGame, day: SpaceDay): RoomVisual {
  const base = createRoomBase(scene, ROOM_LABELS.promotion);
  const foreground = scene.add.container(0, 0).setDepth(34);
  const specs = promotionFixtureSpecs(day);
  const fixtures = specs.map((spec) => createFixture(scene, spec));
  base.add(fixtures.map((fixture) => fixture.image));

  const front = scene.add.image(665, 591, ProductionAssets.foreground.promotionLeft)
    .setDisplaySize(1330, 1182)
    .setAlpha(0.58);
  foreground.add(front);

  const status = createStatus(scene, 665, 335);
  return { base, foreground, fixtures, status };
}

function createColdRoom(scene: RuntimeGame, day: SpaceDay): RoomVisual {
  const base = createRoomBase(scene, ROOM_LABELS.cold);
  const foreground = scene.add.container(0, 0).setDepth(34);
  const specs = coldFixtureSpecs(day);
  const fixtures = specs.map((spec) => createFixture(scene, spec));
  base.add(fixtures.map((fixture) => fixture.image));

  const left = scene.add.image(665, 591, ProductionAssets.foreground.coldLeft)
    .setDisplaySize(1330, 1182)
    .setAlpha(0.42);
  const right = scene.add.image(665, 591, ProductionAssets.foreground.coldRight)
    .setDisplaySize(1330, 1182)
    .setAlpha(0.58);
  foreground.add([left, right]);

  const status = createStatus(scene, 665, 335);
  return { base, foreground, fixtures, status };
}

function createRoomBase(scene: RuntimeGame, label: string): Phaser.GameObjects.Container {
  const base = scene.add.container(0, 0).setDepth(18);
  const veil = scene.add.rectangle(665, 622, 1330, 960, 0x071311, 0.1);
  const floorGlow = scene.add.ellipse(665, 930, 980, 210, 0xf7d98a, 0.08);
  base.add([veil, floorGlow, createRoomLabel(scene, 665, 275, label)]);
  return base;
}

function mainFixtureSpecs(day: SpaceDay): FixtureSpec[] {
  if (day === "day03") {
    return [
      decorativeProduce(190, 995, 235, 310),
      interactiveBakery("drinks", 790, 995, 255, 430),
      interactiveHealth("grocery", 1010, 995, 255, 430),
      decorativeCheckout(1215, 995, 210, 315)
    ];
  }

  if (day === "day04") {
    return [
      decorativeProduce(230, 995, 250, 320),
      interactiveBakery("drinks", 675, 995, 275, 445),
      interactiveHealth("value", 900, 995, 275, 445),
      decorativeCheckout(1190, 995, 230, 335)
    ];
  }

  return [
    decorativeCheckout(205, 995, 210, 310),
    interactiveBakery("drinks", 445, 995, 230, 410),
    interactiveHealth("water", 660, 995, 230, 410),
    interactiveProduce("pantry", 875, 995, 245, 330),
    decorativeCheckout(1165, 995, 210, 310)
  ];
}

function promotionFixtureSpecs(day: SpaceDay): FixtureSpec[] {
  const x = day === "day04" ? 465 : day === "day05" ? 575 : 665;
  return [
    interactiveCheckout("promo", x, 995, 355, 500),
    decorativeBakery(930, 995, 260, 420),
    decorativeHealth(1160, 995, 245, 405)
  ];
}

function coldFixtureSpecs(day: SpaceDay): FixtureSpec[] {
  if (day === "day03") {
    return [
      decorativeProduce(300, 995, 310, 390),
      interactiveFrozen("cold", 1110, 995, 420, 560)
    ];
  }

  if (day === "day04") {
    return [
      decorativeProduce(330, 995, 330, 405),
      interactiveFrozen("dairy", 1080, 995, 430, 575)
    ];
  }

  return [
    interactiveProduce("front", 770, 995, 320, 395),
    interactiveFrozen("dairy", 1065, 995, 410, 555),
    decorativeProduce(260, 995, 270, 345)
  ];
}

function interactiveBakery(fixtureId: string, x: number, bottomY: number, width: number, height: number): FixtureSpec {
  return {
    fixtureId,
    x,
    bottomY,
    width,
    height,
    full: ProductionAssets.fixtures.bakeryFull,
    low: ProductionAssets.fixtures.bakeryLow,
    empty: ProductionAssets.fixtures.bakeryEmpty
  };
}

function interactiveHealth(fixtureId: string, x: number, bottomY: number, width: number, height: number): FixtureSpec {
  return {
    fixtureId,
    x,
    bottomY,
    width,
    height,
    full: ProductionAssets.fixtures.healthBeautyFull,
    low: ProductionAssets.fixtures.healthBeautyLow,
    empty: ProductionAssets.fixtures.healthBeautyEmpty
  };
}

function interactiveProduce(fixtureId: string, x: number, bottomY: number, width: number, height: number): FixtureSpec {
  return {
    fixtureId,
    x,
    bottomY,
    width,
    height,
    full: ProductionAssets.fixtures.produceFull,
    low: ProductionAssets.fixtures.produceLow,
    empty: ProductionAssets.fixtures.produceEmpty
  };
}

function interactiveFrozen(fixtureId: string, x: number, bottomY: number, width: number, height: number): FixtureSpec {
  return {
    fixtureId,
    x,
    bottomY,
    width,
    height,
    full: ProductionAssets.fixtures.frozenFull,
    low: ProductionAssets.fixtures.frozenLow,
    empty: ProductionAssets.fixtures.frozenEmpty
  };
}

function interactiveCheckout(fixtureId: string, x: number, bottomY: number, width: number, height: number): FixtureSpec {
  return {
    fixtureId,
    x,
    bottomY,
    width,
    height,
    full: ProductionAssets.fixtures.checkoutFull,
    low: ProductionAssets.fixtures.checkoutLow,
    empty: ProductionAssets.fixtures.checkoutEmpty
  };
}

function decorativeProduce(x: number, bottomY: number, width: number, height: number): FixtureSpec {
  return { ...interactiveProduce("", x, bottomY, width, height), fixtureId: undefined, fixedState: "full" };
}

function decorativeCheckout(x: number, bottomY: number, width: number, height: number): FixtureSpec {
  return { ...interactiveCheckout("", x, bottomY, width, height), fixtureId: undefined, fixedState: "low" };
}

function decorativeBakery(x: number, bottomY: number, width: number, height: number): FixtureSpec {
  return { ...interactiveBakery("", x, bottomY, width, height), fixtureId: undefined, fixedState: "full" };
}

function decorativeHealth(x: number, bottomY: number, width: number, height: number): FixtureSpec {
  return { ...interactiveHealth("", x, bottomY, width, height), fixtureId: undefined, fixedState: "full" };
}

function createFixture(scene: Phaser.Scene, spec: FixtureSpec): FixtureVisual {
  const image = scene.add.image(spec.x, spec.bottomY, spec.full)
    .setOrigin(0.5, 1)
    .setDisplaySize(spec.width, spec.height);
  return {
    image,
    full: spec.full,
    low: spec.low,
    empty: spec.empty,
    fixtureId: spec.fixtureId,
    fixedState: spec.fixedState
  };
}

function createRoomLabel(scene: Phaser.Scene, x: number, y: number, text: string): Phaser.GameObjects.Container {
  const plate = scene.add.rectangle(0, 0, 310, 54, 0x173f35, 0.94)
    .setStrokeStyle(3, 0xffd75a, 1);
  const label = scene.add.text(0, 0, text, {
    fontFamily: "Arial",
    fontSize: "20px",
    color: "#ffffff",
    fontStyle: "bold"
  }).setOrigin(0.5);
  return scene.add.container(x, y, [plate, label]);
}

function createStatus(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Image {
  return scene.add.image(x, y, ProductionAssets.effects.outOfStock)
    .setDisplaySize(220, 76)
    .setDepth(44)
    .setVisible(false);
}

function updateFixtureStates(
  scene: RuntimeGame,
  controller: RuntimeController,
  visuals: ProductionVisuals,
  room: RoomId
): void {
  const roomVisual = visuals.rooms[room];
  const states = roomVisual.fixtures.map((fixture) => {
    const state = fixtureState(scene, controller, fixture);
    fixture.image.setTexture(fixture[state]);
    return fixture.fixtureId ? state : undefined;
  }).filter((state): state is FixtureState => Boolean(state));

  const roomState = summarizeStates(room === "stock" ? [stockFixtureState(scene)] : states);
  if (roomState === "full") {
    roomVisual.status.setVisible(false);
    return;
  }

  roomVisual.status
    .setTexture(roomState === "empty" ? ProductionAssets.effects.outOfStock : ProductionAssets.effects.lowStock)
    .setVisible(true);
}

function fixtureState(
  scene: RuntimeGame,
  controller: RuntimeController,
  fixture: FixtureVisual
): FixtureState {
  if (fixture.fixedState) return fixture.fixedState;
  if (!fixture.fixtureId) return "full";
  const slots = controller.adapters.get(fixture.fixtureId)?.slots ?? [];
  return fixtureStateForSlots(scene, slots.map((slot) => slot.index));
}

function fixtureStateForSlots(scene: RuntimeGame, indexes: number[]): FixtureState {
  const slots = (scene.shelfSlots ?? []).filter((slot) => indexes.includes(slot.index));
  if (slots.length === 0) return "full";
  const filled = slots.filter((slot) => Boolean(slot.product?.active)).length;
  if (filled === 0) return "empty";
  if (filled < slots.length) return "low";
  return "full";
}

function summarizeStates(states: FixtureState[]): FixtureState {
  if (states.length === 0 || states.every((state) => state === "full")) return "full";
  if (states.every((state) => state === "empty")) return "empty";
  return "low";
}

function stockFixtureState(scene: RuntimeGame): FixtureState {
  const available = (scene.boxes ?? []).filter((box) => box.image.active && !box.loaded).length;
  if (available === 0) return "empty";
  if (available < 5) return "low";
  return "full";
}

function layoutBoxesOnRack(scene: RuntimeGame): void {
  const boxes = scene.boxes ?? [];
  boxes.forEach((box, index) => {
    const point = BOX_SHELF_POINTS[(box.positionIndex ?? index) % BOX_SHELF_POINTS.length];
    box.homeX = point.x;
    box.homeY = point.y;

    const dragging = scene.selectedBox === box && scene.input.activePointer.isDown;
    if (!box.loaded && !dragging && !scene.movingCart && !scene.restockBusy) {
      box.image
        .setPosition(point.x, point.y)
        .setDisplaySize(92, 92)
        .setOrigin(0.5, 1)
        .setDepth(22 + point.y / 10_000);
      box.shadow
        .setPosition(point.x, point.y + 2)
        .setDisplaySize(66, 12)
        .setAlpha(0.14)
        .setDepth(21 + point.y / 10_000);
    }
  });
}

function updateMissingSlotGuide(
  scene: RuntimeGame,
  controller: RuntimeController,
  visuals: ProductionVisuals,
  room: RoomId
): void {
  if (room === "stock" || scene.shiftEnded) {
    visuals.clickRing.setVisible(false);
    return;
  }

  const indexes = roomSlotIndexes(controller, room);
  const target = (scene.shelfSlots ?? []).find(
    (slot) => indexes.includes(slot.index) && slot.hitArea.active && !slot.product?.active
  );
  if (!target) {
    visuals.clickRing.setVisible(false);
    return;
  }

  visuals.clickRing.setPosition(target.hitArea.x, target.hitArea.y).setVisible(true);
}

function roomSlotIndexes(controller: RuntimeController, room: RoomId): number[] {
  const definition = controller.definitions.find((candidate) => candidate.id === room);
  if (!definition) return [];
  return definition.fixtureIds.flatMap((fixtureId) =>
    (controller.adapters.get(fixtureId)?.slots ?? []).map((slot) => slot.index)
  );
}

function slotIndexesNear(scene: RuntimeGame, x: number, tolerance: number): number[] {
  return (scene.shelfSlots ?? [])
    .filter((slot) => Math.abs(slot.hitArea.x - x) <= tolerance)
    .map((slot) => slot.index);
}

function detectRestock(scene: RuntimeGame, visuals: ProductionVisuals): void {
  const current = new Set(filledSlotIndexes(scene));
  const newlyFilled = (scene.shelfSlots ?? []).find(
    (slot) => current.has(slot.index) && !visuals.knownFilledSlots.has(slot.index)
  );

  if (newlyFilled) showRestockedTag(scene, newlyFilled.hitArea.x, newlyFilled.hitArea.y - 100);
  visuals.knownFilledSlots = current;
}

function showRestockedTag(scene: Phaser.Scene, x: number, y: number): void {
  const tag = scene.add.image(x, y, ProductionAssets.effects.restocked)
    .setDisplaySize(235, 80)
    .setDepth(8_920)
    .setScale(0.65)
    .setAlpha(0);

  scene.tweens.add({
    targets: tag,
    y: y - 48,
    scale: 1,
    alpha: 1,
    duration: 220,
    ease: "Back.Out",
    onComplete: () => {
      scene.tweens.add({
        targets: tag,
        y: y - 78,
        alpha: 0,
        delay: 420,
        duration: 260,
        onComplete: () => tag.destroy()
      });
    }
  });
}

function filledSlotIndexes(scene: RuntimeGame): number[] {
  return (scene.shelfSlots ?? [])
    .filter((slot) => Boolean(slot.product?.active))
    .map((slot) => slot.index);
}

function hideSlotChrome(scene: RuntimeGame): void {
  for (const slot of scene.shelfSlots ?? []) {
    slot.missingTag?.setVisible(false);
    slot.typeLabel?.setVisible(false);
    slot.product?.setVisible(false);
  }
}

function keepActorsAboveFixtures(scene: RuntimeGame): void {
  scene.cart?.setDepth(31);
  scene.worker?.setDepth(32);
}

function hideLegacyRoomVisuals(scene: RuntimeGame): void {
  const protectedObjects = new Set<Phaser.GameObjects.GameObject>();
  if (scene.cart) protectedObjects.add(scene.cart);
  if (scene.worker) protectedObjects.add(scene.worker);
  for (const box of scene.boxes ?? []) {
    protectedObjects.add(box.image);
    protectedObjects.add(box.shadow);
  }
  for (const slot of scene.shelfSlots ?? []) {
    protectedObjects.add(slot.hitArea);
    if (slot.missingTag) protectedObjects.add(slot.missingTag);
    if (slot.typeLabel) protectedObjects.add(slot.typeLabel);
    if (slot.product) protectedObjects.add(slot.product);
  }

  scene.children.list.forEach((child) => {
    if (protectedObjects.has(child)) return;
    const display = child as DisplayObject;
    if (!display.active || display.y < 225 || display.y > 1060 || display.depth < 2 || display.depth > 13) return;
    if (
      child instanceof Phaser.GameObjects.Image ||
      child instanceof Phaser.GameObjects.Rectangle ||
      child instanceof Phaser.GameObjects.Text
    ) {
      display.setVisible(false);
    }
  });
}

function isSupportedDay(value: unknown): value is SupportedDay {
  return value === "day02" || value === "day03" || value === "day04" || value === "day05";
}
