import Phaser from "phaser";
import { GameScene } from "./scenes/GameScene";
import { gameSession } from "./systems/GameSession";
import { ProductionAssetPaths, ProductionAssets } from "./supermarketProductionAssets";

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

type RuntimeGame = Phaser.Scene & {
  boxes?: RuntimeBox[];
  shelfSlots?: RuntimeSlot[];
  selectedBox?: RuntimeBox;
  movingCart?: boolean;
  restockBusy?: boolean;
  cart?: Phaser.GameObjects.Container;
  worker?: Phaser.GameObjects.Image;
  __weekOneSpaceController?: RuntimeController;
  __productionVisuals?: ProductionVisuals;
};

type GamePrototype = {
  preload: () => void;
  create: (...args: unknown[]) => void;
};

type FixtureVisual = {
  image: Phaser.GameObjects.Image;
  fixtureId?: string;
  empty: string;
  low: string;
  full: string;
  fixedState?: FixtureState;
};

type FixtureSpec = {
  fixtureId?: string;
  x: number;
  bottomY: number;
  width: number;
  height: number;
  empty: string;
  low: string;
  full: string;
  fixedState?: FixtureState;
};

type RoomVisual = {
  container: Phaser.GameObjects.Container;
  fixtures: FixtureVisual[];
  status: Phaser.GameObjects.Image;
};

type ProductionVisuals = {
  rooms: Record<RoomId, RoomVisual>;
  lastRoom?: RoomId;
  lastRefreshAt: number;
  monitor: () => void;
};

const BOX_SHELF_POINTS = [
  { x: 180, y: 500 },
  { x: 310, y: 500 },
  { x: 440, y: 500 },
  { x: 180, y: 610 },
  { x: 310, y: 610 },
  { x: 440, y: 610 }
] as const;

installProductionVisuals();

function installProductionVisuals(): void {
  const prototype = GameScene.prototype as unknown as GamePrototype;
  const originalPreload = prototype.preload;
  const originalCreate = prototype.create;

  prototype.preload = function preloadProductionVisuals(): void {
    originalPreload.call(this);
    const scene = this as unknown as Phaser.Scene;
    Object.entries(ProductionAssetPaths).forEach(([key, path]) => {
      if (!scene.textures.exists(key)) scene.load.image(key, path);
    });
  };

  prototype.create = function createProductionVisuals(...args: unknown[]): void {
    originalCreate.apply(this, args);
    const scene = this as unknown as RuntimeGame;
    if (!isSpaceDay(gameSession.day)) return;

    installSpaceVisuals(scene, gameSession.day);
  };
}

function installSpaceVisuals(scene: RuntimeGame, day: SpaceDay): void {
  const controller = scene.__weekOneSpaceController;
  if (!controller) return;

  const rooms: Record<RoomId, RoomVisual> = {
    stock: createStockRoom(scene),
    main: createFixtureRoom(scene, "MAIN FLOOR", mainSpecs(day)),
    promotion: createFixtureRoom(scene, "PROMOTION", promotionSpecs(day)),
    cold: createFixtureRoom(scene, "COLD CASE", coldSpecs(day))
  };

  const visuals: ProductionVisuals = {
    rooms,
    lastRefreshAt: -Infinity,
    monitor: () => undefined
  };
  scene.__productionVisuals = visuals;

  const monitor = (): void => {
    if (!scene.scene.isActive()) return;
    if (scene.time.now - visuals.lastRefreshAt < 120) return;
    visuals.lastRefreshAt = scene.time.now;

    controller.navigation.setVisible(false);
    hideSlotChrome(scene);
    keepActorsAboveFixtures(scene);

    const activeRoom = controller.activeRoom;
    Object.entries(rooms).forEach(([id, room]) => {
      room.container.setVisible(id === activeRoom);
      room.status.setVisible(id === activeRoom && room.status.visible);
    });

    if (activeRoom === "stock") layoutBoxesOnRack(scene);
    updateRoomFixtures(scene, controller, rooms[activeRoom], activeRoom);

    if (visuals.lastRoom !== activeRoom) {
      const room = rooms[activeRoom].container;
      room.setAlpha(0.35);
      scene.tweens.killTweensOf(room);
      scene.tweens.add({ targets: room, alpha: 1, duration: 220, ease: "Sine.Out" });
      visuals.lastRoom = activeRoom;
    }

    document.body.dataset.productionSupermarket = `${gameSession.day}:${activeRoom}`;
  };

  visuals.monitor = monitor;
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, monitor);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, monitor);
    Object.values(rooms).forEach((room) => {
      room.container.destroy(true);
      room.status.destroy();
    });
    scene.__productionVisuals = undefined;
    delete document.body.dataset.productionSupermarket;
  });

  monitor();
}

function createStockRoom(scene: RuntimeGame): RoomVisual {
  const container = scene.add.container(0, 0).setDepth(18);
  const rack = createFixture(scene, {
    x: 310,
    bottomY: 995,
    width: 500,
    height: 625,
    empty: ProductionAssets.fixtures.rackBackroomEmpty,
    low: ProductionAssets.fixtures.rackBackroomEmpty,
    full: ProductionAssets.fixtures.rackBackroomEmpty,
    fixedState: "full"
  });
  const label = createRoomLabel(scene, 310, 270, "BACKROOM STOCK");
  container.add([rack.image, label]);

  const status = createStatus(scene, 310, 330);
  return { container, fixtures: [rack], status };
}

function createFixtureRoom(scene: RuntimeGame, labelText: string, specs: FixtureSpec[]): RoomVisual {
  const container = scene.add.container(0, 0).setDepth(18);
  const glow = scene.add.ellipse(665, 940, 980, 180, 0xffe3a0, 0.06);
  const fixtures = specs.map((spec) => createFixture(scene, spec));
  const label = createRoomLabel(scene, 665, 270, labelText);
  container.add([glow, ...fixtures.map((fixture) => fixture.image), label]);

  const status = createStatus(scene, 665, 330);
  return { container, fixtures, status };
}

function mainSpecs(day: SpaceDay): FixtureSpec[] {
  if (day === "day03") {
    return [
      decorativeProduce(185, 995, 230, 305),
      interactiveBakery("drinks", 790, 995, 250, 425),
      interactiveHealth("grocery", 1010, 995, 250, 425),
      decorativeCheckout(1210, 995, 205, 305)
    ];
  }

  if (day === "day04") {
    return [
      decorativeProduce(220, 995, 245, 315),
      interactiveBakery("drinks", 675, 995, 270, 440),
      interactiveHealth("value", 900, 995, 270, 440),
      decorativeCheckout(1190, 995, 225, 330)
    ];
  }

  return [
    decorativeCheckout(205, 995, 205, 305),
    interactiveBakery("drinks", 445, 995, 225, 405),
    interactiveHealth("water", 660, 995, 225, 405),
    interactiveProduce("pantry", 875, 995, 240, 325),
    decorativeCheckout(1165, 995, 205, 305)
  ];
}

function promotionSpecs(day: SpaceDay): FixtureSpec[] {
  const x = day === "day04" ? 465 : day === "day05" ? 575 : 665;
  return [
    interactiveCheckout("promo", x, 995, 350, 495),
    decorativeBakery(930, 995, 255, 415),
    decorativeHealth(1160, 995, 240, 400)
  ];
}

function coldSpecs(day: SpaceDay): FixtureSpec[] {
  if (day === "day03") {
    return [
      decorativeProduce(300, 995, 305, 385),
      interactiveFrozen("cold", 1110, 995, 415, 555)
    ];
  }

  if (day === "day04") {
    return [
      decorativeProduce(330, 995, 325, 400),
      interactiveFrozen("dairy", 1080, 995, 425, 570)
    ];
  }

  return [
    decorativeProduce(260, 995, 265, 340),
    interactiveProduce("front", 770, 995, 315, 390),
    interactiveFrozen("dairy", 1065, 995, 405, 550)
  ];
}

function interactiveBakery(fixtureId: string, x: number, bottomY: number, width: number, height: number): FixtureSpec {
  return fixtureSpec(fixtureId, x, bottomY, width, height,
    ProductionAssets.fixtures.bakeryEmpty,
    ProductionAssets.fixtures.bakeryLow,
    ProductionAssets.fixtures.bakeryFull);
}

function interactiveHealth(fixtureId: string, x: number, bottomY: number, width: number, height: number): FixtureSpec {
  return fixtureSpec(fixtureId, x, bottomY, width, height,
    ProductionAssets.fixtures.healthBeautyEmpty,
    ProductionAssets.fixtures.healthBeautyLow,
    ProductionAssets.fixtures.healthBeautyFull);
}

function interactiveProduce(fixtureId: string, x: number, bottomY: number, width: number, height: number): FixtureSpec {
  return fixtureSpec(fixtureId, x, bottomY, width, height,
    ProductionAssets.fixtures.produceEmpty,
    ProductionAssets.fixtures.produceLow,
    ProductionAssets.fixtures.produceFull);
}

function interactiveFrozen(fixtureId: string, x: number, bottomY: number, width: number, height: number): FixtureSpec {
  return fixtureSpec(fixtureId, x, bottomY, width, height,
    ProductionAssets.fixtures.frozenEmpty,
    ProductionAssets.fixtures.frozenLow,
    ProductionAssets.fixtures.frozenFull);
}

function interactiveCheckout(fixtureId: string, x: number, bottomY: number, width: number, height: number): FixtureSpec {
  return fixtureSpec(fixtureId, x, bottomY, width, height,
    ProductionAssets.fixtures.checkoutEmpty,
    ProductionAssets.fixtures.checkoutLow,
    ProductionAssets.fixtures.checkoutFull);
}

function fixtureSpec(
  fixtureId: string,
  x: number,
  bottomY: number,
  width: number,
  height: number,
  empty: string,
  low: string,
  full: string
): FixtureSpec {
  return { fixtureId, x, bottomY, width, height, empty, low, full };
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
  const image = scene.add.image(spec.x, spec.bottomY, spec.empty)
    .setOrigin(0.5, 1)
    .setDisplaySize(spec.width, spec.height);
  return {
    image,
    fixtureId: spec.fixtureId,
    empty: spec.empty,
    low: spec.low,
    full: spec.full,
    fixedState: spec.fixedState
  };
}

function updateRoomFixtures(
  scene: RuntimeGame,
  controller: RuntimeController,
  room: RoomVisual,
  roomId: RoomId
): void {
  const states: FixtureState[] = [];
  room.fixtures.forEach((fixture) => {
    const state = fixtureState(scene, controller, fixture);
    fixture.image.setTexture(fixture[state]);
    if (fixture.fixtureId) states.push(state);
  });

  const state = roomId === "stock" ? stockState(scene) : summarizeStates(states);
  if (state === "full") {
    room.status.setVisible(false);
    return;
  }

  room.status
    .setTexture(state === "empty" ? ProductionAssets.effects.outOfStock : ProductionAssets.effects.lowStock)
    .setVisible(true);
}

function fixtureState(scene: RuntimeGame, controller: RuntimeController, fixture: FixtureVisual): FixtureState {
  if (fixture.fixedState) return fixture.fixedState;
  if (!fixture.fixtureId) return "full";
  const indexes = (controller.adapters.get(fixture.fixtureId)?.slots ?? []).map((slot) => slot.index);
  const slots = (scene.shelfSlots ?? []).filter((slot) => indexes.includes(slot.index));
  if (slots.length === 0) return "full";
  const filled = slots.filter((slot) => Boolean(slot.product?.active)).length;
  if (filled === 0) return "empty";
  if (filled < slots.length) return "low";
  return "full";
}

function stockState(scene: RuntimeGame): FixtureState {
  const available = (scene.boxes ?? []).filter((box) => box.image.active && !box.loaded).length;
  if (available === 0) return "empty";
  if (available < 5) return "low";
  return "full";
}

function summarizeStates(states: FixtureState[]): FixtureState {
  if (states.length === 0 || states.every((state) => state === "full")) return "full";
  if (states.every((state) => state === "empty")) return "empty";
  return "low";
}

function layoutBoxesOnRack(scene: RuntimeGame): void {
  (scene.boxes ?? []).forEach((box, index) => {
    const point = BOX_SHELF_POINTS[(box.positionIndex ?? index) % BOX_SHELF_POINTS.length];
    box.homeX = point.x;
    box.homeY = point.y;
    const dragging = scene.selectedBox === box && scene.input.activePointer.isDown;
    if (box.loaded || dragging || scene.movingCart || scene.restockBusy) return;

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
  });
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

function isSpaceDay(value: unknown): value is SpaceDay {
  return value === "day03" || value === "day04" || value === "day05";
}
