import Phaser from "phaser";
import { GameScene } from "./scenes/GameScene";
import { gameSession } from "./systems/GameSession";

type ProductId = "cola" | "water" | "milk";
type ShelfState = "empty" | "low" | "full";
type DayTwoRoom = "main" | "stock";

type RuntimeSlot = {
  index: number;
  productId: ProductId;
  hitArea: Phaser.GameObjects.Rectangle;
  missingTag?: Phaser.GameObjects.Image;
  typeLabel?: Phaser.GameObjects.Text;
  productBottomY: number;
  product?: Phaser.GameObjects.Image;
};

type FloatingFixture = {
  productId: ProductId;
  image: Phaser.GameObjects.Image;
  shadow?: Phaser.GameObjects.Ellipse;
  label?: Phaser.GameObjects.Container;
};

type DayTwoController = {
  room: DayTwoRoom;
  mainRoom: Phaser.GameObjects.Container;
  stockRoom: Phaser.GameObjects.Container;
  mainFixtures: FloatingFixture[];
  clickRing: Phaser.GameObjects.Image;
};

type RuntimeGame = Phaser.Scene & {
  phase: string;
  shiftEnded: boolean;
  shelfSlots: RuntimeSlot[];
  loadedProducts: ProductId[];
  cart: Phaser.GameObjects.Container;
  worker: Phaser.GameObjects.Image;
  cartAtShelf: boolean;
  movingCart: boolean;
  restockBusy: boolean;
  selectedBox?: unknown;
  __dayTwoImmersiveStore?: DayTwoController;
  __dayTwoBackgroundShelves?: BackgroundShelfController;
};

type GamePrototype = {
  create: (...args: unknown[]) => void;
};

type ShelfZone = {
  productId: ProductId;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  slotPoints: Array<{ x: number; y: number; bottomY: number }>;
};

type ZoneVisual = {
  definition: ShelfZone;
  shade: Phaser.GameObjects.Rectangle;
  outline: Phaser.GameObjects.Rectangle;
  labelPlate: Phaser.GameObjects.Rectangle;
  labelText: Phaser.GameObjects.Text;
  container: Phaser.GameObjects.Container;
  state?: ShelfState;
};

type BackgroundShelfController = {
  zones: ZoneVisual[];
  timer: Phaser.Time.TimerEvent;
  lastSignature: string;
};

const SHELF_ZONES: ShelfZone[] = [
  {
    productId: "cola",
    title: "DRINKS",
    x: 205,
    y: 610,
    width: 260,
    height: 315,
    slotPoints: [
      { x: 205, y: 545, bottomY: 605 },
      { x: 205, y: 690, bottomY: 750 }
    ]
  },
  {
    productId: "water",
    title: "WATER",
    x: 458,
    y: 540,
    width: 180,
    height: 250,
    slotPoints: [
      { x: 458, y: 495, bottomY: 550 },
      { x: 458, y: 610, bottomY: 665 }
    ]
  },
  {
    productId: "milk",
    title: "DAIRY",
    x: 1080,
    y: 530,
    width: 255,
    height: 285,
    slotPoints: [
      { x: 1080, y: 480, bottomY: 540 },
      { x: 1080, y: 615, bottomY: 675 }
    ]
  }
];

const prototype = GameScene.prototype as unknown as GamePrototype;
const originalCreate = prototype.create;

prototype.create = function createBackgroundShelfDayTwo(...args: unknown[]): void {
  originalCreate.apply(this, args);
  const scene = this as unknown as RuntimeGame;
  if (gameSession.day !== "day02") return;

  const immersive = scene.__dayTwoImmersiveStore;
  if (!immersive) return;

  installBackgroundShelfInteraction(scene, immersive);
};

function installBackgroundShelfInteraction(scene: RuntimeGame, immersive: DayTwoController): void {
  scene.__dayTwoBackgroundShelves?.timer.remove(false);
  scene.__dayTwoBackgroundShelves?.zones.forEach((zone) => zone.container.destroy(true));

  stopLeakedOverlayScenes(scene);
  hideFloatingFixtures(scene, immersive);
  immersive.clickRing.setVisible(false);
  scene.tweens.killTweensOf(immersive.clickRing);

  configureBackgroundSlots(scene);
  const zones = SHELF_ZONES.map((definition) => createZoneVisual(scene, definition));

  const controller: BackgroundShelfController = {
    zones,
    timer: undefined as unknown as Phaser.Time.TimerEvent,
    lastSignature: ""
  };
  scene.__dayTwoBackgroundShelves = controller;

  const synchronize = (force = false): void => {
    if (!scene.scene.isActive() || gameSession.day !== "day02") return;

    stopLeakedOverlayScenes(scene);
    hideFloatingFixtures(scene, immersive);
    immersive.clickRing.setVisible(false);

    const signature = runtimeSignature(scene, immersive);
    if (!force && signature === controller.lastSignature) return;
    controller.lastSignature = signature;

    const mainVisible = immersive.room === "main";
    zones.forEach((zone) => {
      zone.container.setVisible(mainVisible);
      updateZoneState(scene, zone);
    });

    updateActorScaleAndPosition(scene, immersive.room);
    document.body.dataset.dayTwoShelfMode = `background:${immersive.room}`;
  };

  synchronize(true);
  controller.timer = scene.time.addEvent({
    delay: 180,
    loop: true,
    callback: synchronize
  });

  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    controller.timer.remove(false);
    zones.forEach((zone) => zone.container.destroy(true));
    scene.__dayTwoBackgroundShelves = undefined;
    delete document.body.dataset.dayTwoShelfMode;
  });
}

function configureBackgroundSlots(scene: RuntimeGame): void {
  const offsets: Record<ProductId, number> = { cola: 0, water: 0, milk: 0 };

  for (const slot of scene.shelfSlots) {
    const zone = SHELF_ZONES.find((candidate) => candidate.productId === slot.productId);
    if (!zone) continue;

    const index = offsets[slot.productId]++;
    const point = zone.slotPoints[index] ?? zone.slotPoints[0];
    slot.hitArea
      .setPosition(point.x, point.y)
      .setSize(zone.width * 0.86, zone.height * 0.42)
      .setDepth(36)
      .setAlpha(0.001);
    slot.productBottomY = point.bottomY;
    slot.missingTag?.setVisible(false);
    slot.typeLabel?.setVisible(false);
    slot.product?.setVisible(false);
  }
}

function createZoneVisual(scene: RuntimeGame, definition: ShelfZone): ZoneVisual {
  const shade = mark(
    scene.add.rectangle(0, 0, definition.width, definition.height, 0x07110f, 0.32)
  );
  const outline = mark(
    scene.add.rectangle(0, 0, definition.width, definition.height, 0xffffff, 0)
      .setStrokeStyle(3, 0xf0c95c, 0.88)
  );
  const labelPlate = mark(
    scene.add.rectangle(0, -definition.height / 2 - 18, 155, 34, 0x173f35, 0.94)
      .setStrokeStyle(2, 0xf0c95c, 0.8)
  );
  const labelText = mark(
    scene.add.text(0, -definition.height / 2 - 18, definition.title, {
      fontFamily: "Arial",
      fontSize: "14px",
      color: "#fff5c4",
      fontStyle: "bold"
    }).setOrigin(0.5)
  );

  const container = mark(
    scene.add.container(definition.x, definition.y, [shade, outline, labelPlate, labelText])
      .setDepth(27)
  );

  return { definition, shade, outline, labelPlate, labelText, container };
}

function updateZoneState(scene: RuntimeGame, visual: ZoneVisual): void {
  const slots = scene.shelfSlots.filter((slot) => slot.productId === visual.definition.productId);
  const filled = slots.filter((slot) => Boolean(slot.product?.active)).length;
  const state: ShelfState = filled === 0 ? "empty" : filled < slots.length ? "low" : "full";
  if (visual.state === state) return;
  visual.state = state;

  if (state === "full") {
    visual.shade.setVisible(false);
    visual.outline.setVisible(false);
    visual.labelPlate.setVisible(false);
    visual.labelText.setVisible(false);
    return;
  }

  const empty = state === "empty";
  visual.shade
    .setVisible(true)
    .setFillStyle(0x07110f, empty ? 0.38 : 0.2);
  visual.outline
    .setVisible(true)
    .setStrokeStyle(3, empty ? 0xf0c95c : 0xe3b957, empty ? 0.9 : 0.58);
  visual.labelPlate.setVisible(true);
  visual.labelText
    .setVisible(true)
    .setText(`${visual.definition.title} · ${empty ? "RESTOCK" : "LOW"}`);
}

function hideFloatingFixtures(scene: RuntimeGame, immersive: DayTwoController): void {
  for (const fixture of immersive.mainFixtures) {
    lockHidden(scene, fixture.image);
    if (fixture.shadow) lockHidden(scene, fixture.shadow);
    if (fixture.label) lockHidden(scene, fixture.label);
  }
}

function updateActorScaleAndPosition(scene: RuntimeGame, room: DayTwoRoom): void {
  if (scene.movingCart || scene.restockBusy || scene.selectedBox) return;

  if (room === "main") {
    scene.cart.setScale(0.76).setPosition(650, 985).setDepth(33);
    scene.worker.setDisplaySize(155, 310).setPosition(555, 970).setDepth(34);
    return;
  }

  scene.cart.setScale(0.82).setDepth(33);
  scene.worker.setDisplaySize(165, 330).setDepth(34);
}

function stopLeakedOverlayScenes(scene: RuntimeGame): void {
  for (const key of ["back-stock", "day2-room-nav"]) {
    if (scene.scene.isActive(key)) scene.scene.stop(key);
  }
}

function runtimeSignature(scene: RuntimeGame, immersive: DayTwoController): string {
  return [
    immersive.room,
    scene.phase,
    scene.shiftEnded ? "1" : "0",
    scene.cartAtShelf ? "1" : "0",
    scene.movingCart ? "1" : "0",
    scene.restockBusy ? "1" : "0",
    scene.loadedProducts.join(","),
    scene.shelfSlots.map((slot) => (slot.product?.active ? "1" : "0")).join("")
  ].join("|");
}

function lockHidden(scene: Phaser.Scene, object: Phaser.GameObjects.GameObject & { setVisible: (visible: boolean) => unknown }): void {
  scene.tweens.killTweensOf(object);
  object.setVisible(false);
  object.disableInteractive();
}

function mark<T extends Phaser.GameObjects.GameObject>(object: T): T {
  object.setData("dayTwoImmersive", true);
  object.setData("dayTwoBackgroundShelf", true);
  return object;
}
