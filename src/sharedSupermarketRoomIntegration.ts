import Phaser from "phaser";
import { GameScene } from "./scenes/GameScene";
import { PromotionWingScene } from "./scenes/PromotionWingScene";
import { SupermarketAssets, SupermarketBackgroundPaths } from "./supermarketAssets";
import { gameSession } from "./systems/GameSession";

type SupportedDay = "day02" | "day03" | "day04" | "day05";
type SpaceDay = "day03" | "day04" | "day05";
type RoomId = "stock" | "main" | "promotion" | "cold";

type RoomDefinition = {
  id: RoomId;
  label: string;
};

type RoomTab = {
  definition: RoomDefinition;
  hit: Phaser.GameObjects.Rectangle;
};

type SpaceController = {
  activeRoom: RoomId;
  definitions: RoomDefinition[];
  tabs: RoomTab[];
  navigation: Phaser.GameObjects.Container;
  dockShade: Phaser.GameObjects.Rectangle;
  floorShade: Phaser.GameObjects.Rectangle;
};

type ArrowControl = {
  container: Phaser.GameObjects.Container;
  background: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  target?: RoomId;
};

type SharedRoomVisuals = {
  backgrounds: Record<RoomId, Phaser.GameObjects.Image>;
  backArrow: ArrowControl;
  forwardArrow: ArrowControl;
  lastRoom?: RoomId;
  monitor: () => void;
};

type RuntimeGame = Phaser.Scene & {
  shiftEnded: boolean;
  __campaignIncidentPanel?: Phaser.GameObjects.Container;
  __weekOneSpaceController?: SpaceController;
  __sharedRoomVisuals?: SharedRoomVisuals;
};

type GamePrototype = {
  preload: () => void;
  create: (...args: unknown[]) => void;
};

type PromotionPrototype = {
  preload: () => void;
  create: (...args: unknown[]) => void;
};

installGameRoomVisuals();
installPromotionWingBackground();

function installGameRoomVisuals(): void {
  const prototype = GameScene.prototype as unknown as GamePrototype;
  const originalPreload = prototype.preload;
  const originalCreate = prototype.create;

  prototype.preload = function preloadSharedSupermarketRooms(): void {
    originalPreload.call(this);
    if (!isSupportedDay(gameSession.day)) return;
    loadBackgrounds(this as unknown as Phaser.Scene);
  };

  prototype.create = function createSharedSupermarketRooms(...args: unknown[]): void {
    originalCreate.apply(this, args);
    const scene = this as unknown as RuntimeGame;
    if (!isSupportedDay(gameSession.day)) return;

    if (gameSession.day === "day02") {
      installDayTwoSplitBackground(scene);
      return;
    }

    installSpaceDayBackgrounds(scene, gameSession.day);
  };
}

function installPromotionWingBackground(): void {
  const prototype = PromotionWingScene.prototype as unknown as PromotionPrototype;
  const originalPreload = prototype.preload;
  const originalCreate = prototype.create;

  prototype.preload = function preloadSharedPromotionBackground(): void {
    originalPreload.call(this);
    loadTexture(
      this as unknown as Phaser.Scene,
      SupermarketAssets.backgrounds.promotionWing,
      SupermarketBackgroundPaths[SupermarketAssets.backgrounds.promotionWing]
    );
  };

  prototype.create = function createSharedPromotionBackground(...args: unknown[]): void {
    originalCreate.apply(this, args);
    const scene = this as unknown as Phaser.Scene;
    if (gameSession.day !== "day02" || !scene.scene.isActive()) return;

    scene.add.image(665, 621, SupermarketAssets.backgrounds.promotionWing)
      .setDisplaySize(1330, 1040)
      .setDepth(0.5);

    document.body.dataset.sharedSupermarketPromotion = "ready";
  };
}

function loadBackgrounds(scene: Phaser.Scene): void {
  Object.entries(SupermarketBackgroundPaths).forEach(([key, path]) => loadTexture(scene, key, path));
}

function loadTexture(scene: Phaser.Scene, key: string, path: string): void {
  if (!scene.textures.exists(key)) scene.load.image(key, path);
}

function installDayTwoSplitBackground(scene: RuntimeGame): void {
  const gameplayY = 622;
  const gameplayHeight = 924;

  scene.add.image(339, gameplayY, SupermarketAssets.backgrounds.backroom)
    .setDisplaySize(678, gameplayHeight)
    .setDepth(1);
  scene.add.image(1004, gameplayY, SupermarketAssets.backgrounds.mainFloor)
    .setDisplaySize(652, gameplayHeight)
    .setDepth(1);

  document.body.dataset.sharedSupermarketRoom = "day02:split";
}

function installSpaceDayBackgrounds(scene: RuntimeGame, day: SpaceDay): void {
  const controller = scene.__weekOneSpaceController;
  if (!controller) return;

  scene.__sharedRoomVisuals?.backArrow.container.destroy(true);
  scene.__sharedRoomVisuals?.forwardArrow.container.destroy(true);

  const backgrounds: Record<RoomId, Phaser.GameObjects.Image> = {
    stock: createFullRoomBackground(scene, SupermarketAssets.backgrounds.backroom),
    main: createFullRoomBackground(scene, SupermarketAssets.backgrounds.mainFloor),
    promotion: createFullRoomBackground(scene, SupermarketAssets.backgrounds.promotionWing),
    cold: createFullRoomBackground(scene, SupermarketAssets.backgrounds.coldCase)
  };

  const backArrow = createArrow(scene, 165, "left");
  const forwardArrow = createArrow(scene, 1165, "right");
  const visuals: SharedRoomVisuals = {
    backgrounds,
    backArrow,
    forwardArrow,
    monitor: () => undefined
  };
  scene.__sharedRoomVisuals = visuals;

  backArrow.background.on("pointerdown", () => requestRoom(scene, backArrow.target));
  forwardArrow.background.on("pointerdown", () => requestRoom(scene, forwardArrow.target));

  const monitor = (): void => {
    if (!scene.scene.isActive()) return;
    controller.dockShade.setVisible(false);
    controller.floorShade.setVisible(false);
    hideLegacyRoomChrome(scene, day);
    updateRoomBackground(scene, visuals, controller.activeRoom);
    updateArrowNavigation(scene, visuals, controller);
  };

  visuals.monitor = monitor;
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, monitor);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, monitor);
    Object.values(backgrounds).forEach((background) => background.destroy());
    backArrow.container.destroy(true);
    forwardArrow.container.destroy(true);
    scene.__sharedRoomVisuals = undefined;
    delete document.body.dataset.sharedSupermarketRoom;
  });

  monitor();
}

function createFullRoomBackground(scene: Phaser.Scene, key: string): Phaser.GameObjects.Image {
  return scene.add.image(665, 622, key)
    .setDisplaySize(1330, 960)
    .setDepth(1)
    .setVisible(false);
}

function createArrow(scene: Phaser.Scene, x: number, direction: "left" | "right"): ArrowControl {
  const background = scene.add.rectangle(0, 0, 270, 72, 0x173f35, 0.97)
    .setStrokeStyle(4, 0xffd75a, 1)
    .setInteractive({ useHandCursor: true });
  const label = scene.add.text(0, 0, direction === "left" ? "← BACK" : "NEXT →", {
    fontFamily: "Arial",
    fontSize: "20px",
    color: "#ffffff",
    fontStyle: "bold",
    align: "center"
  }).setOrigin(0.5);
  const container = scene.add.container(x, 1015, [background, label]).setDepth(8_870);

  background.on("pointerover", () => container.setScale(1.035));
  background.on("pointerout", () => container.setScale(1));

  return { container, background, label };
}

function requestRoom(scene: RuntimeGame, target?: RoomId): void {
  if (!target) return;
  const controller = scene.__weekOneSpaceController;
  const tab = controller?.tabs.find((candidate) => candidate.definition.id === target);
  if (!tab?.hit.active || !tab.hit.input?.enabled) return;
  tab.hit.emit("pointerdown");
}

function updateRoomBackground(scene: RuntimeGame, visuals: SharedRoomVisuals, room: RoomId): void {
  Object.entries(visuals.backgrounds).forEach(([id, background]) => {
    background.setVisible(id === room);
  });

  if (visuals.lastRoom !== room) {
    const background = visuals.backgrounds[room];
    background.setAlpha(0.35);
    scene.tweens.killTweensOf(background);
    scene.tweens.add({
      targets: background,
      alpha: 1,
      duration: 260,
      ease: "Sine.Out"
    });
    visuals.lastRoom = room;
  }

  document.body.dataset.sharedSupermarketRoom = `${gameSession.day}:${room}`;
}

function updateArrowNavigation(
  scene: RuntimeGame,
  visuals: SharedRoomVisuals,
  controller: SpaceController
): void {
  const currentIndex = controller.definitions.findIndex((definition) => definition.id === controller.activeRoom);
  const previous = currentIndex > 0 ? controller.definitions[currentIndex - 1] : undefined;
  const next = currentIndex >= 0 && currentIndex < controller.definitions.length - 1
    ? controller.definitions[currentIndex + 1]
    : undefined;
  const blocked = scene.shiftEnded || Boolean(scene.__campaignIncidentPanel?.active) || gameSession.isPaused;

  configureArrow(visuals.backArrow, previous, blocked, "left");
  configureArrow(visuals.forwardArrow, next, blocked, "right");
}

function configureArrow(
  arrow: ArrowControl,
  definition: RoomDefinition | undefined,
  blocked: boolean,
  direction: "left" | "right"
): void {
  arrow.target = definition?.id;
  const visible = Boolean(definition) && !blocked;
  arrow.container.setVisible(visible);
  arrow.background.input!.enabled = visible;
  if (!definition) return;

  const label = roomDisplayLabel(definition.id, definition.label);
  arrow.label.setText(direction === "left" ? `← ${label}` : `${label} →`);
}

function roomDisplayLabel(room: RoomId, fallback: string): string {
  if (room === "stock") return "BACKROOM";
  if (room === "main") return "MAIN FLOOR";
  if (room === "promotion") return "PROMOTION";
  if (room === "cold") return "COLD CASE";
  return fallback;
}

function hideLegacyRoomChrome(scene: RuntimeGame, day: SpaceDay): void {
  for (const child of scene.children.list) {
    if (child instanceof Phaser.GameObjects.Text) {
      const value = child.text.toUpperCase();
      if (
        value === "BACKROOM" ||
        value === "SALES FLOOR" ||
        value === "STOCK DOCK" ||
        (value.includes("LOAD CASES") && value.includes("BUILD A ROUTE"))
      ) {
        child.setVisible(false).disableInteractive();
      }
      continue;
    }

    if (!(child instanceof Phaser.GameObjects.Rectangle)) continue;
    const isDayThreeDivider = day === "day03" && child.width <= 12 && child.height >= 800;
    const isDayThreeRoomTag = day === "day03" && child.y < 230 && child.height <= 60 && child.width >= 170 && child.width <= 210;
    const isBatchDockPanel = day !== "day03" && Math.abs(child.x - 170) < 6 && child.width >= 300 && child.height >= 800;
    if (isDayThreeDivider || isDayThreeRoomTag || isBatchDockPanel) {
      child.setVisible(false).disableInteractive();
    }
  }
}

function isSupportedDay(value: unknown): value is SupportedDay {
  return value === "day02" || value === "day03" || value === "day04" || value === "day05";
}
