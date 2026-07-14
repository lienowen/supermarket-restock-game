import Phaser from "phaser";
import type { ProductId } from "./gameConfig";
import { GameScene } from "./scenes/GameScene";
import { gameSession } from "./systems/GameSession";

type SpaceDay = "day03" | "day04" | "day05";
type RoomId = "stock" | "main" | "promotion" | "cold";

type RuntimeBox = {
  productId: ProductId;
  loaded: boolean;
  image: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
};

type RuntimeSlot = {
  index: number;
  productId: ProductId;
  hitArea: Phaser.GameObjects.Rectangle;
  missingTag: Phaser.GameObjects.Image;
  typeLabel: Phaser.GameObjects.Text;
  product?: Phaser.GameObjects.Image;
};

type BatchFixture = {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  lowOverlay: Phaser.GameObjects.Rectangle;
  outline: Phaser.GameObjects.Rectangle;
  status: Phaser.GameObjects.Text;
};

type DisplayObject = Phaser.GameObjects.GameObject & {
  active: boolean;
  visible: boolean;
  x: number;
  y: number;
  depth: number;
  input?: Phaser.Types.Input.InteractiveObject | null;
  setVisible: (value: boolean) => DisplayObject;
  getBounds?: () => Phaser.Geom.Rectangle;
};

type FixtureAdapter = {
  id: string;
  slots: RuntimeSlot[];
  setVisible: (visible: boolean) => void;
};

type RoomDefinition = {
  id: RoomId;
  label: string;
  fixtureIds: string[];
};

type RoomTab = {
  definition: RoomDefinition;
  container: Phaser.GameObjects.Container;
  background: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
  hit: Phaser.GameObjects.Rectangle;
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
  __batchFixtures?: BatchFixture[];
  __campaignIncidentPanel?: Phaser.GameObjects.Container;
  __supervisorContractPanel?: Phaser.GameObjects.Container;
  __weekOneSpaceController?: SpaceController;
  departureRequirement: () => number;
  snapCart: (destination: "WAREHOUSE" | "SALES") => void;
  showTransientHint: (message: string) => void;
};

type SpaceController = {
  activeRoom: RoomId;
  definitions: RoomDefinition[];
  adapters: Map<string, FixtureAdapter>;
  tabs: RoomTab[];
  navigation: Phaser.GameObjects.Container;
  dockShade: Phaser.GameObjects.Rectangle;
  floorShade: Phaser.GameObjects.Rectangle;
  monitor: () => void;
  lastRefreshAt: number;
};

type GamePrototype = {
  create: (...args: unknown[]) => void;
};

const prototype = GameScene.prototype as unknown as GamePrototype;
const originalCreate = prototype.create;

prototype.create = function createWithProgressiveStoreRooms(...args: unknown[]): void {
  originalCreate.apply(this, args);
  const scene = this as unknown as RuntimeGame;
  if (!isSpaceDay(gameSession.day)) return;

  installSpaceController(scene, gameSession.day);
};

function installSpaceController(scene: RuntimeGame, day: SpaceDay): void {
  scene.__weekOneSpaceController?.navigation.destroy(true);

  const definitions = roomDefinitions(day);
  const adapters = day === "day03" ? buildDayThreeAdapters(scene) : buildBatchAdapters(scene);
  const navigation = scene.add.container(0, 0).setDepth(8_850);
  const tabs = createRoomTabs(scene, navigation, definitions);
  const splitX = day === "day03" ? 678 : 340;

  const dockShade = scene.add.rectangle(splitX / 2, 622, splitX, 900, 0x071012, 0.72)
    .setDepth(41)
    .setVisible(false);
  const floorShade = scene.add.rectangle(splitX + (1330 - splitX) / 2, 622, 1330 - splitX, 900, 0x071012, 0.78)
    .setDepth(41)
    .setVisible(false);

  const controller: SpaceController = {
    activeRoom: "stock",
    definitions,
    adapters,
    tabs,
    navigation,
    dockShade,
    floorShade,
    monitor: () => undefined,
    lastRefreshAt: -Infinity
  };
  scene.__weekOneSpaceController = controller;
  hideRedundantSpacePanels(scene, day);

  tabs.forEach((tab) => {
    tab.hit.on("pointerdown", () => navigateToRoom(scene, controller, tab.definition.id));
    tab.hit.on("pointerover", () => tab.container.setScale(1.02));
    tab.hit.on("pointerout", () => tab.container.setScale(1));
  });

  const monitor = (): void => {
    if (scene.time.now - controller.lastRefreshAt < 140) return;
    controller.lastRefreshAt = scene.time.now;

    hideRedundantSpacePanels(scene, day);
    const modalActive = Boolean(scene.__campaignIncidentPanel?.active) || gameSession.isPaused;
    controller.navigation.setVisible(!modalActive && !scene.shiftEnded);
    controller.tabs.forEach((tab) => {
      if (tab.hit.input) tab.hit.input.enabled = !modalActive && !scene.shiftEnded;
    });

    applyRoomVisibility(scene, controller);
    updateTabs(controller);
  };

  controller.monitor = monitor;
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, monitor);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, monitor);
    controller.navigation.destroy(true);
    controller.dockShade.destroy();
    controller.floorShade.destroy();
    scene.__weekOneSpaceController = undefined;
    delete document.body.dataset.storeRoom;
  });

  applyRoomVisibility(scene, controller);
  updateTabs(controller);
  scene.time.delayedCall(420, () => {
    if (!scene.scene.isActive()) return;
    scene.showTransientHint("The store now uses separate rooms. Load cases in STOCK, then choose the department above.");
  });
}

function roomDefinitions(day: SpaceDay): RoomDefinition[] {
  if (day === "day03") {
    return [
      { id: "stock", label: "STOCK", fixtureIds: [] },
      { id: "main", label: "MAIN FLOOR", fixtureIds: ["drinks", "grocery"] },
      { id: "cold", label: "COLD CASE", fixtureIds: ["cold"] }
    ];
  }

  if (day === "day04") {
    return [
      { id: "stock", label: "STOCK", fixtureIds: [] },
      { id: "main", label: "MAIN FLOOR", fixtureIds: ["drinks", "value"] },
      { id: "promotion", label: "PROMOTION", fixtureIds: ["promo"] },
      { id: "cold", label: "COLD", fixtureIds: ["dairy"] }
    ];
  }

  return [
    { id: "stock", label: "STOCK", fixtureIds: [] },
    { id: "main", label: "MAIN FLOOR", fixtureIds: ["drinks", "water", "pantry"] },
    { id: "promotion", label: "PROMOTION", fixtureIds: ["promo"] },
    { id: "cold", label: "COLD", fixtureIds: ["dairy", "front"] }
  ];
}

function createRoomTabs(
  scene: RuntimeGame,
  navigation: Phaser.GameObjects.Container,
  definitions: RoomDefinition[]
): RoomTab[] {
  const totalWidth = definitions.length === 3 ? 760 : 820;
  const gap = 8;
  const tabWidth = (totalWidth - gap * (definitions.length - 1)) / definitions.length;
  const startX = 665 - totalWidth / 2 + tabWidth / 2;
  const y = 184;

  const strip = scene.add.rectangle(665, y, totalWidth + 24, 66, 0x081416, 0.97)
    .setStrokeStyle(2, 0x5d7376, 0.95);
  navigation.add(strip);

  return definitions.map((definition, index) => {
    const x = startX + index * (tabWidth + gap);
    const background = scene.add.rectangle(0, 0, tabWidth, 48, 0x20373b, 1)
      .setStrokeStyle(2, 0x70898d, 1);
    const text = scene.add.text(0, 0, definition.label, {
      fontFamily: "Arial",
      fontSize: definitions.length === 3 ? "17px" : "15px",
      color: "#ffffff",
      fontStyle: "bold",
      align: "center"
    }).setOrigin(0.5);
    const hit = scene.add.rectangle(0, 0, tabWidth + 4, 54, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true });
    const container = scene.add.container(x, y, [background, text, hit]);
    navigation.add(container);
    return { definition, container, background, text, hit };
  });
}

function navigateToRoom(scene: RuntimeGame, controller: SpaceController, target: RoomId): void {
  if (target === controller.activeRoom || scene.shiftEnded || scene.movingCart || scene.restockBusy) return;
  if (scene.__campaignIncidentPanel?.active || gameSession.isPaused) return;

  if (target !== "stock") {
    if (scene.selectedBox) {
      scene.showTransientHint("Place the selected case in the cart before changing rooms.");
      return;
    }

    if (!scene.cartAtShelf) {
      const required = gameSession.day === "day03" ? Math.max(1, scene.departureRequirement()) : 1;
      if (scene.loadedProducts.length < required) {
        scene.showTransientHint(`Load ${required - scene.loadedProducts.length} more case(s) in STOCK first.`);
        return;
      }
      scene.snapCart("SALES");
    }
  } else if (scene.cartAtShelf) {
    scene.snapCart("WAREHOUSE");
  }

  controller.activeRoom = target;
  applyRoomVisibility(scene, controller);
  updateTabs(controller);
}

function applyRoomVisibility(scene: RuntimeGame, controller: SpaceController): void {
  const activeDefinition = controller.definitions.find((definition) => definition.id === controller.activeRoom);
  const visibleFixtures = new Set(activeDefinition?.fixtureIds ?? []);

  controller.adapters.forEach((adapter, id) => adapter.setVisible(visibleFixtures.has(id)));

  const stockMode = controller.activeRoom === "stock";
  setBoxesVisible(scene, stockMode);
  controller.floorShade.setVisible(stockMode);
  controller.dockShade.setVisible(!stockMode);

  document.body.dataset.storeRoom = `${gameSession.day}:${controller.activeRoom}`;
}

function updateTabs(controller: SpaceController): void {
  controller.tabs.forEach((tab, index) => {
    const selected = tab.definition.id === controller.activeRoom;
    const adapters = tab.definition.fixtureIds
      .map((id) => controller.adapters.get(id))
      .filter((adapter): adapter is FixtureAdapter => Boolean(adapter));
    const total = adapters.reduce((sum, adapter) => sum + adapter.slots.length, 0);
    const filled = adapters.reduce(
      (sum, adapter) => sum + adapter.slots.filter((slot) => Boolean(slot.product?.active)).length,
      0
    );
    const progress = total > 0 ? ` ${filled}/${total}` : "";

    tab.background
      .setFillStyle(selected ? 0x315f4b : 0x20373b, 1)
      .setStrokeStyle(2, selected ? 0xffd75a : 0x70898d, 1);
    tab.text
      .setText(`${index + 1}/${controller.tabs.length} ${tab.definition.label}${progress}`)
      .setColor(selected ? "#fff1aa" : "#ffffff");
  });
}

function setBoxesVisible(scene: RuntimeGame, visible: boolean): void {
  for (const box of scene.boxes ?? []) {
    if (box.image.active) {
      const show = visible && !box.loaded;
      box.image.setVisible(show);
      if (box.image.input) box.image.input.enabled = show;
    }
    if (box.shadow?.active) box.shadow.setVisible(visible && !box.loaded);
  }
}

function buildDayThreeAdapters(scene: RuntimeGame): Map<string, FixtureAdapter> {
  const definitions = [
    { id: "drinks", x: 790 },
    { id: "grocery", x: 1000 },
    { id: "cold", x: 1210 }
  ];
  const adapters = new Map<string, FixtureAdapter>();

  definitions.forEach(({ id, x }) => {
    const slots = scene.shelfSlots.filter((slot) => Math.abs(slot.hitArea.x - x) <= 12);
    const slotObjects = new Set<Phaser.GameObjects.GameObject>();
    slots.forEach((slot) => {
      slotObjects.add(slot.hitArea);
      slotObjects.add(slot.missingTag);
      slotObjects.add(slot.typeLabel);
    });

    const staticObjects = scene.children.list
      .map((child) => child as DisplayObject)
      .filter((child) => isFixtureDisplayObject(child, x))
      .filter((child) => !slotObjects.has(child));

    adapters.set(id, {
      id,
      slots,
      setVisible: (visible: boolean) => {
        staticObjects.forEach((object) => setObjectVisibility(object, visible));
        slots.forEach((slot) => {
          setObjectVisibility(slot.hitArea as unknown as DisplayObject, visible);
          setObjectVisibility(slot.missingTag as unknown as DisplayObject, visible && !slot.product?.active);
          setObjectVisibility(slot.typeLabel as unknown as DisplayObject, visible);
          if (slot.product?.active) setObjectVisibility(slot.product as unknown as DisplayObject, visible);
        });
      }
    });
  });

  return adapters;
}

function buildBatchAdapters(scene: RuntimeGame): Map<string, FixtureAdapter> {
  const adapters = new Map<string, FixtureAdapter>();

  (scene.__batchFixtures ?? []).forEach((fixture, index) => {
    const slot = scene.shelfSlots[index];
    if (!slot) return;
    const label = scene.children.list.find((child): child is Phaser.GameObjects.Text =>
      child instanceof Phaser.GameObjects.Text && child.active && child.text === fixture.label
    );

    adapters.set(fixture.id, {
      id: fixture.id,
      slots: [slot],
      setVisible: (visible: boolean) => {
        setObjectVisibility(fixture.lowOverlay as unknown as DisplayObject, visible);
        setObjectVisibility(fixture.outline as unknown as DisplayObject, visible);
        setObjectVisibility(fixture.status as unknown as DisplayObject, visible);
        if (label?.active) setObjectVisibility(label as unknown as DisplayObject, visible);
        setObjectVisibility(slot.hitArea as unknown as DisplayObject, visible);
        setObjectVisibility(slot.missingTag as unknown as DisplayObject, visible && !slot.product?.active);
        setObjectVisibility(slot.typeLabel as unknown as DisplayObject, false);
        if (slot.product?.active) setObjectVisibility(slot.product as unknown as DisplayObject, visible);
      }
    });
  });

  return adapters;
}

function hideRedundantSpacePanels(scene: RuntimeGame, day: SpaceDay): void {
  if (scene.__supervisorContractPanel?.active) {
    scene.__supervisorContractPanel.setVisible(false);
    scene.__supervisorContractPanel.getAll().forEach((child) => child.disableInteractive());
  }

  if (day === "day03") return;

  for (const child of scene.children.list) {
    if (child instanceof Phaser.GameObjects.Rectangle) {
      const isBatchPanel =
        Math.abs(child.x - 300) < 4 &&
        Math.abs(child.y - 240) < 4 &&
        child.width >= 500 &&
        child.height >= 120 &&
        child.depth >= 8_900;
      if (isBatchPanel) child.setVisible(false).disableInteractive();
      continue;
    }

    if (!(child instanceof Phaser.GameObjects.Text)) continue;
    const value = child.text.toUpperCase();
    const isBatchInstruction =
      value === "BATCH RESTOCK MODE" ||
      (value.includes("1 CASE") && value.includes("FULL DISPLAY")) ||
      (value.includes("LOAD A ROUTE") && value.includes("SIX DISPLAYS"));
    if (isBatchInstruction) child.setVisible(false).disableInteractive();
  }
}

function isFixtureDisplayObject(object: DisplayObject, centerX: number): boolean {
  if (!object?.active || typeof object.setVisible !== "function") return false;
  if (object.depth < 2 || object.depth > 32) return false;

  const bounds = object.getBounds?.();
  const x = bounds?.centerX ?? object.x;
  const y = bounds?.centerY ?? object.y;
  const width = bounds?.width ?? 0;
  const height = bounds?.height ?? 0;

  if (Math.abs(x - centerX) > 106 || y < 245 || y > 900) return false;
  if (width > 360 || height > 760) return false;
  return true;
}

function setObjectVisibility(object: DisplayObject, visible: boolean): void {
  if (!object?.active) return;
  object.setVisible(visible);
  if (object.input) object.input.enabled = visible;
}

function isSpaceDay(value: unknown): value is SpaceDay {
  return value === "day03" || value === "day04" || value === "day05";
}
