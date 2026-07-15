import Phaser from "phaser";
import { GameScene } from "./scenes/GameScene";
import { gameSession } from "./systems/GameSession";
import { ProductionAssetPaths, ProductionAssets } from "./supermarketProductionAssets";

type SupportedDay = "day02" | "day03" | "day04" | "day05";
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
  product?: Phaser.GameObjects.Image;
};

type RuntimeController = {
  activeRoom: RoomId;
  navigation: Phaser.GameObjects.Container;
};

type FixtureVisual = {
  image: Phaser.GameObjects.Image;
  empty: string;
  low: string;
  full: string;
};

type RoomVisual = {
  base: Phaser.GameObjects.Container;
  foreground: Phaser.GameObjects.Container;
  fixtures: FixtureVisual[];
  status: Phaser.GameObjects.Image;
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
  __weekOneSpaceController?: RuntimeController;
  __productionVisuals?: ProductionVisuals;
};

type GamePrototype = {
  preload: () => void;
  create: (...args: unknown[]) => void;
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

    if (gameSession.day === "day02") {
      installDayTwoVisuals(scene);
      return;
    }

    installRoomVisuals(scene);
  };
}

function installDayTwoVisuals(scene: RuntimeGame): void {
  const rack = scene.add.image(260, 640, ProductionAssets.fixtures.rackBackroomFull)
    .setDisplaySize(430, 540)
    .setDepth(4);
  const mainShelf = scene.add.image(1080, 650, ProductionAssets.fixtures.produceLow)
    .setDisplaySize(285, 410)
    .setDepth(4);

  const backLabel = createRoomLabel(scene, 260, 252, "BACKROOM");
  const floorLabel = createRoomLabel(scene, 1055, 252, "MAIN FLOOR");

  layoutBoxesOnRack(scene);

  const monitor = (): void => {
    if (!scene.scene.isActive()) return;
    layoutBoxesOnRack(scene);
    const state = stockFixtureState(scene);
    rack.setTexture(rackTexture(state));
  };

  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, monitor);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, monitor);
    rack.destroy();
    mainShelf.destroy();
    backLabel.destroy(true);
    floorLabel.destroy(true);
  });

  document.body.dataset.productionSupermarket = "day02";
}

function installRoomVisuals(scene: RuntimeGame): void {
  const controller = scene.__weekOneSpaceController;
  if (!controller) return;

  scene.__productionVisuals?.monitor();

  const rooms: Record<RoomId, RoomVisual> = {
    stock: createStockRoom(scene),
    main: createMainRoom(scene),
    promotion: createPromotionRoom(scene),
    cold: createColdRoom(scene)
  };

  const clickRing = scene.add.image(0, 0, ProductionAssets.effects.clickRing)
    .setDisplaySize(150, 150)
    .setDepth(27)
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
    if (scene.time.now - visuals.lastRefreshAt < 90) return;
    visuals.lastRefreshAt = scene.time.now;

    const activeRoom = controller.activeRoom;
    controller.navigation.setAlpha(0.24);
    layoutBoxesOnRack(scene);

    (Object.keys(rooms) as RoomId[]).forEach((room) => {
      const visible = room === activeRoom;
      rooms[room].base.setVisible(visible);
      rooms[room].foreground.setVisible(visible);
      rooms[room].status.setVisible(visible);
    });

    updateFixtureStates(scene, visuals, activeRoom);
    updateMissingSlotGuide(scene, visuals, activeRoom);
    detectRestock(scene, visuals);

    if (visuals.lastRoom !== activeRoom) {
      const room = rooms[activeRoom];
      room.base.setAlpha(0.25);
      room.foreground.setAlpha(0.25);
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
  const base = scene.add.container(0, 0).setDepth(4);
  const foreground = scene.add.container(0, 0).setDepth(34);
  const rack = addFixture(
    scene,
    base,
    310,
    645,
    500,
    625,
    ProductionAssets.fixtures.rackBackroomFull,
    ProductionAssets.fixtures.rackBackroomLow,
    ProductionAssets.fixtures.rackBackroomEmpty
  );

  base.add(createRoomLabel(scene, 310, 270, ROOM_LABELS.stock));
  const status = createStatus(scene, 310, 330);

  return { base, foreground, fixtures: [rack], status };
}

function createMainRoom(scene: RuntimeGame): RoomVisual {
  const base = scene.add.container(0, 0).setDepth(4);
  const foreground = scene.add.container(0, 0).setDepth(34);

  const bakery = addFixture(
    scene,
    base,
    255,
    660,
    270,
    420,
    ProductionAssets.fixtures.bakeryFull,
    ProductionAssets.fixtures.bakeryLow,
    ProductionAssets.fixtures.bakeryEmpty
  );
  const health = addFixture(
    scene,
    base,
    505,
    660,
    270,
    420,
    ProductionAssets.fixtures.healthBeautyFull,
    ProductionAssets.fixtures.healthBeautyLow,
    ProductionAssets.fixtures.healthBeautyEmpty
  );

  const foregroundLeft = scene.add.image(665, 591, ProductionAssets.foreground.aisleLeft)
    .setDisplaySize(1330, 1182)
    .setAlpha(0.88);
  foreground.add(foregroundLeft);
  base.add(createRoomLabel(scene, 665, 270, ROOM_LABELS.main));
  const status = createStatus(scene, 665, 330);

  return { base, foreground, fixtures: [bakery, health], status };
}

function createPromotionRoom(scene: RuntimeGame): RoomVisual {
  const base = scene.add.container(0, 0).setDepth(4);
  const foreground = scene.add.container(0, 0).setDepth(34);

  const checkout = addFixture(
    scene,
    base,
    340,
    655,
    330,
    470,
    ProductionAssets.fixtures.checkoutFull,
    ProductionAssets.fixtures.checkoutLow,
    ProductionAssets.fixtures.checkoutEmpty
  );
  const foregroundPromo = scene.add.image(665, 591, ProductionAssets.foreground.promotionLeft)
    .setDisplaySize(1330, 1182)
    .setAlpha(0.86);
  foreground.add(foregroundPromo);
  base.add(createRoomLabel(scene, 665, 270, ROOM_LABELS.promotion));
  const status = createStatus(scene, 665, 330);

  return { base, foreground, fixtures: [checkout], status };
}

function createColdRoom(scene: RuntimeGame): RoomVisual {
  const base = scene.add.container(0, 0).setDepth(4);
  const foreground = scene.add.container(0, 0).setDepth(34);

  const frozen = addFixture(
    scene,
    base,
    350,
    650,
    390,
    530,
    ProductionAssets.fixtures.frozenFull,
    ProductionAssets.fixtures.frozenLow,
    ProductionAssets.fixtures.frozenEmpty
  );
  const produce = addFixture(
    scene,
    base,
    1030,
    690,
    310,
    390,
    ProductionAssets.fixtures.produceFull,
    ProductionAssets.fixtures.produceLow,
    ProductionAssets.fixtures.produceEmpty
  );
  const foregroundRight = scene.add.image(665, 591, ProductionAssets.foreground.coldRight)
    .setDisplaySize(1330, 1182)
    .setAlpha(0.86);
  foreground.add(foregroundRight);
  base.add(createRoomLabel(scene, 665, 270, ROOM_LABELS.cold));
  const status = createStatus(scene, 665, 330);

  return { base, foreground, fixtures: [frozen, produce], status };
}

function addFixture(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  x: number,
  y: number,
  width: number,
  height: number,
  full: string,
  low: string,
  empty: string
): FixtureVisual {
  const image = scene.add.image(x, y, full).setDisplaySize(width, height);
  container.add(image);
  return { image, full, low, empty };
}

function createRoomLabel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string
): Phaser.GameObjects.Container {
  const plate = scene.add.rectangle(0, 0, 300, 54, 0x173f35, 0.94)
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

function updateFixtureStates(scene: RuntimeGame, visuals: ProductionVisuals, room: RoomId): void {
  const state = room === "stock" ? stockFixtureState(scene) : activeFixtureState(scene);
  const roomVisual = visuals.rooms[room];
  roomVisual.fixtures.forEach((fixture) => fixture.image.setTexture(fixture[state]));

  if (state === "full") {
    roomVisual.status.setVisible(false);
    return;
  }

  roomVisual.status
    .setTexture(state === "empty" ? ProductionAssets.effects.outOfStock : ProductionAssets.effects.lowStock)
    .setVisible(true);
}

function stockFixtureState(scene: RuntimeGame): FixtureState {
  const available = (scene.boxes ?? []).filter((box) => box.image.active && !box.loaded).length;
  if (available === 0) return "empty";
  if (available < 5) return "low";
  return "full";
}

function activeFixtureState(scene: RuntimeGame): FixtureState {
  const visibleSlots = (scene.shelfSlots ?? []).filter((slot) => slot.hitArea.active && slot.hitArea.visible);
  if (visibleSlots.length === 0) return "full";
  const filled = visibleSlots.filter((slot) => Boolean(slot.product?.active)).length;
  if (filled === 0) return "empty";
  if (filled < visibleSlots.length) return "low";
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
      box.image.setPosition(point.x, point.y).setDisplaySize(96, 96).setOrigin(0.5, 1);
      box.shadow.setPosition(point.x, point.y + 2).setDisplaySize(68, 12).setAlpha(0.16);
    }
  });
}

function updateMissingSlotGuide(scene: RuntimeGame, visuals: ProductionVisuals, room: RoomId): void {
  if (room === "stock" || scene.shiftEnded) {
    visuals.clickRing.setVisible(false);
    return;
  }

  const target = (scene.shelfSlots ?? []).find(
    (slot) => slot.hitArea.active && slot.hitArea.visible && !slot.product?.active
  );
  if (!target) {
    visuals.clickRing.setVisible(false);
    return;
  }

  visuals.clickRing.setPosition(target.hitArea.x, target.hitArea.y).setVisible(true);
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

function rackTexture(state: FixtureState): string {
  if (state === "empty") return ProductionAssets.fixtures.rackBackroomEmpty;
  if (state === "low") return ProductionAssets.fixtures.rackBackroomLow;
  return ProductionAssets.fixtures.rackBackroomFull;
}

function isSupportedDay(value: unknown): value is SupportedDay {
  return value === "day02" || value === "day03" || value === "day04" || value === "day05";
}
