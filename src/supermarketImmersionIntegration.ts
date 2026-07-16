import Phaser from "phaser";
import { AssetPaths, Assets } from "./assets";
import type { LevelId } from "./domain/gameTypes";
import { LEVELS } from "./levels/levelConfigs";
import { GameScene } from "./scenes/GameScene";
import { StorefrontScene } from "./scenes/StorefrontScene";
import { ProductionAssetPaths, ProductionAssets } from "./supermarketProductionAssets";
import { SupermarketAssets, SupermarketBackgroundPaths } from "./supermarketAssets";
import { gameSession } from "./systems/GameSession";

type RoomId = "stock" | "main" | "promotion" | "cold";

type StorefrontPrototype = {
  preload: (...args: unknown[]) => void;
  create: (...args: unknown[]) => void;
  startShift: (day: LevelId) => void;
};

type RuntimeStorefront = Phaser.Scene & {
  openDaySelector: () => void;
  __storeImmersion?: StorefrontImmersion;
};

type GamePrototype = {
  create: (...args: unknown[]) => void;
};

type RuntimeGame = Phaser.Scene & {
  worker?: Phaser.GameObjects.Image;
  shiftEnded?: boolean;
  phase?: string;
  __weekOneSpaceController?: {
    activeRoom: RoomId;
  };
  __supermarketImmersion?: GameImmersion;
};

type StorefrontImmersion = {
  container: Phaser.GameObjects.Container;
  dashboardCleanup: () => void;
};

type GameImmersion = {
  shoppers: Phaser.GameObjects.Image[];
  shopperShadows: Phaser.GameObjects.Ellipse[];
  workerShadow?: Phaser.GameObjects.Ellipse;
  monitor: () => void;
  lastRoom?: RoomId;
};

type AmbientHandle = {
  scene: Phaser.Scene;
  stop: () => void;
};

const ROLE_LABELS: Record<LevelId, string> = {
  day01: "STOCK ASSOCIATE",
  day02: "PROMOTION & CHECKOUT",
  day03: "SHIFT SUPERVISOR",
  day04: "FLOOR LEAD",
  day05: "WEEKEND MANAGER"
};

let audioContext: AudioContext | undefined;
let activeAmbient: AmbientHandle | undefined;

installStorefrontImmersion();
installGameImmersion();

function installStorefrontImmersion(): void {
  const prototype = StorefrontScene.prototype as unknown as StorefrontPrototype;
  const originalPreload = prototype.preload;
  const originalCreate = prototype.create;
  const originalStartShift = prototype.startShift;

  prototype.preload = function preloadEntranceActors(...args: unknown[]): void {
    originalPreload.apply(this, args);
    const scene = this as unknown as Phaser.Scene;
    const keys = [
      Assets.characters.workerIdle,
      Assets.characters.customer01Idle,
      Assets.characters.customer02Basket
    ] as const;

    keys.forEach((key) => {
      if (!scene.textures.exists(key)) scene.load.image(key, AssetPaths[key]);
    });
  };

  prototype.create = function createImmersiveStoreEntrance(...args: unknown[]): void {
    originalCreate.apply(this, args);
    const scene = this as unknown as RuntimeStorefront;

    scene.time.delayedCall(0, () => installStorefrontEntrance(scene));
    // Late UI wrappers also add their dashboard during create(). Re-apply once
    // after those objects exist so the entrance remains a scene, not a menu page.
    scene.time.delayedCall(420, () => scene.__storeImmersion?.dashboardCleanup());
  };

  prototype.startShift = function enterStoreWithDoorChime(day: LevelId): void {
    const scene = this as unknown as RuntimeStorefront;
    startSupermarketAmbience(scene, "entrance");
    playDoorChime();

    const background = findTextureImage(scene, Assets.storefront.day) ?? findTextureImage(scene, Assets.storefront.night);
    if (background?.active) {
      scene.tweens.killTweensOf(background);
      scene.tweens.add({
        targets: background,
        scaleX: background.scaleX * 1.018,
        scaleY: background.scaleY * 1.018,
        duration: 170,
        ease: "Sine.In"
      });
    }

    originalStartShift.call(this, day);
  };
}

function installStorefrontEntrance(scene: RuntimeStorefront): void {
  scene.__storeImmersion?.container.destroy(true);

  const hasStartAction = scene.children.list.some((child) =>
    child instanceof Phaser.GameObjects.Text && child.text.startsWith("START DAY")
  );
  if (!hasStartAction) return;

  const day = resolveActiveDay();
  const level = LEVELS[day];
  const container = scene.add.container(0, 0).setDepth(68).setName("immersion-entrance");
  const dashboardCleanup = (): void => cleanLobbyDashboard(scene);
  scene.__storeImmersion = { container, dashboardCleanup };

  dashboardCleanup();
  animateEntranceBackground(scene);

  const leftShade = scene.add.rectangle(0, 610, 150, 980, 0x061012, 0.34)
    .setOrigin(0, 0.5)
    .setName("immersion-left-frame");
  const rightShade = scene.add.rectangle(1330, 610, 115, 980, 0x061012, 0.2)
    .setOrigin(1, 0.5)
    .setName("immersion-right-frame");
  const floorShade = scene.add.rectangle(665, 1095, 1330, 175, 0x061012, 0.34)
    .setName("immersion-floor-frame");

  const matShadow = scene.add.ellipse(660, 1035, 420, 72, 0x000000, 0.2)
    .setName("immersion-entry-mat-shadow");
  const mat = scene.add.rectangle(660, 1024, 360, 86, 0x27433d, 0.5)
    .setStrokeStyle(2, 0x789d89, 0.45)
    .setName("immersion-entry-mat");

  const workerShadow = scene.add.ellipse(650, 1012, 92, 24, 0x000000, 0.24)
    .setName("immersion-worker-shadow");
  const worker = scene.add.image(650, 1015, Assets.characters.workerIdle)
    .setOrigin(0.5, 1)
    .setName("immersion-worker");
  fitImage(worker, 145, 300);
  scene.tweens.add({
    targets: worker,
    y: worker.y - 3,
    duration: 1450,
    yoyo: true,
    repeat: -1,
    ease: "Sine.InOut"
  });

  const shopperA = scene.add.image(-120, 995, Assets.characters.customer01Idle)
    .setOrigin(0.5, 1)
    .setAlpha(0.72)
    .setName("immersion-shopper-a");
  fitImage(shopperA, 120, 255);
  const shopperB = scene.add.image(1440, 975, Assets.characters.customer02Basket)
    .setOrigin(0.5, 1)
    .setAlpha(0.62)
    .setFlipX(true)
    .setName("immersion-shopper-b");
  fitImage(shopperB, 112, 240);
  animateStorefrontShopper(scene, shopperA, -120, 1460, 13_500, 1_500);
  animateStorefrontShopper(scene, shopperB, 1440, -140, 15_800, 4_000);

  const briefingPanel = scene.add.rectangle(235, 790, 395, 250, 0x0b1719, 0.82)
    .setStrokeStyle(3, 0x7b9a78, 0.84)
    .setName("immersion-briefing-panel");
  const role = scene.add.text(235, 700, `DAY ${Number(day.slice(-2))} · ${ROLE_LABELS[day]}`, {
    fontFamily: "Arial",
    fontSize: "17px",
    color: "#f7e8a9",
    fontStyle: "bold",
    letterSpacing: 1,
    align: "center"
  }).setOrigin(0.5).setName("immersion-role");
  const title = scene.add.text(235, 745, level.title.toUpperCase(), {
    fontFamily: "Arial",
    fontSize: "27px",
    color: "#ffffff",
    fontStyle: "bold",
    align: "center",
    wordWrap: { width: 350 }
  }).setOrigin(0.5).setName("immersion-title");
  const objective = scene.add.text(235, 815, level.objective, {
    fontFamily: "Arial",
    fontSize: "17px",
    color: "#d9e8e3",
    align: "center",
    lineSpacing: 5,
    wordWrap: { width: 345 }
  }).setOrigin(0.5).setName("immersion-objective");
  const direction = scene.add.text(235, 885, "Walk through the staff entrance to clock in.", {
    fontFamily: "Arial",
    fontSize: "15px",
    color: "#bfe88a",
    fontStyle: "bold",
    align: "center",
    wordWrap: { width: 345 }
  }).setOrigin(0.5).setName("immersion-direction");

  const shiftButtonBg = scene.add.rectangle(155, 1080, 230, 62, 0x173238, 0.9)
    .setStrokeStyle(2, 0x7b9a78, 0.82)
    .setInteractive({ useHandCursor: true })
    .setName("immersion-shifts-button");
  const shiftButtonText = scene.add.text(155, 1080, "SHIFT BOARD", {
    fontFamily: "Arial",
    fontSize: "17px",
    color: "#ffffff",
    fontStyle: "bold"
  }).setOrigin(0.5).setName("immersion-shifts-label");
  shiftButtonBg.on("pointerdown", () => scene.openDaySelector());

  const lightA = scene.add.rectangle(760, 178, 250, 18, 0xfff8d8, 0.08)
    .setRotation(-0.04)
    .setName("immersion-light-a");
  const lightB = scene.add.rectangle(1080, 212, 220, 16, 0xfff8d8, 0.06)
    .setRotation(0.03)
    .setName("immersion-light-b");
  scene.tweens.add({ targets: [lightA, lightB], alpha: 0.12, duration: 2300, yoyo: true, repeat: -1 });

  container.add([
    leftShade,
    rightShade,
    floorShade,
    matShadow,
    mat,
    workerShadow,
    worker,
    shopperA,
    shopperB,
    briefingPanel,
    role,
    title,
    objective,
    direction,
    shiftButtonBg,
    shiftButtonText,
    lightA,
    lightB
  ]);

  scene.children.list.forEach((child) => {
    if (!(child instanceof Phaser.GameObjects.Text)) return;
    if (!child.text.startsWith("START DAY")) return;
    child.setText("CLOCK IN · ENTER STORE").setFontSize(25);
  });

  scene.input.once("pointerdown", () => startSupermarketAmbience(scene, "entrance"));
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    if (scene.__storeImmersion?.container === container) scene.__storeImmersion = undefined;
  });
}

function cleanLobbyDashboard(scene: RuntimeStorefront): void {
  for (const child of scene.children.list) {
    if (child.name?.startsWith("immersion-")) continue;

    const display = child as Phaser.GameObjects.GameObject & {
      x?: number;
      y?: number;
      depth?: number;
      setVisible?: (visible: boolean) => unknown;
      disableInteractive?: () => unknown;
      list?: Phaser.GameObjects.GameObject[];
    };
    const x = Number(display.x ?? 0);
    const y = Number(display.y ?? 0);
    const depth = Number(display.depth ?? 0);
    const leftDashboard = x < 610 && y > 130 && y < 930 && depth >= 8;
    const bottomMenu = y > 1010 && depth >= 8;

    if (!leftDashboard && !bottomMenu) continue;
    display.setVisible?.(false);
    display.disableInteractive?.();
    display.list?.forEach((nested) => nested.disableInteractive());
  }
}

function animateEntranceBackground(scene: Phaser.Scene): void {
  const background = findTextureImage(scene, Assets.storefront.day) ?? findTextureImage(scene, Assets.storefront.night);
  if (!background) return;

  const targetScaleX = background.scaleX * 1.018;
  const targetScaleY = background.scaleY * 1.018;
  scene.tweens.add({
    targets: background,
    scaleX: targetScaleX,
    scaleY: targetScaleY,
    x: background.x - 5,
    duration: 12_000,
    yoyo: true,
    repeat: -1,
    ease: "Sine.InOut"
  });
}

function animateStorefrontShopper(
  scene: Phaser.Scene,
  shopper: Phaser.GameObjects.Image,
  startX: number,
  endX: number,
  duration: number,
  delay: number
): void {
  scene.tweens.add({
    targets: shopper,
    x: endX,
    duration,
    delay,
    repeat: -1,
    repeatDelay: 2_800,
    ease: "Linear",
    onRepeat: () => {
      shopper.setX(startX).setY(Phaser.Math.Between(950, 1005));
    }
  });
}

function installGameImmersion(): void {
  const prototype = GameScene.prototype as unknown as GamePrototype;
  const originalCreate = prototype.create;

  prototype.create = function createWithSupermarketPresence(...args: unknown[]): void {
    originalCreate.apply(this, args);
    const scene = this as unknown as RuntimeGame;
    scene.time.delayedCall(0, () => installActiveStorePresence(scene));
  };
}

function installActiveStorePresence(scene: RuntimeGame): void {
  scene.__supermarketImmersion?.shoppers.forEach((shopper) => shopper.destroy());
  scene.__supermarketImmersion?.shopperShadows.forEach((shadow) => shadow.destroy());
  scene.__supermarketImmersion?.workerShadow?.destroy();

  if (gameSession.day === "day01") createUnifiedDayOneFloor(scene);
  softenHud(scene);
  installCeilingLight(scene);

  const shopperA = createAmbientShopper(scene, Assets.characters.customer01Basket, -130, 980, false, 0.54);
  const shopperB = createAmbientShopper(scene, Assets.characters.customer02Idle, 1460, 955, true, 0.46);
  const shopperShadowA = createActorShadow(scene, shopperA);
  const shopperShadowB = createActorShadow(scene, shopperB);
  animateFloorShopper(scene, shopperA, -130, 1460, 14_500, 2_000);
  animateFloorShopper(scene, shopperB, 1460, -140, 17_000, 6_000);

  const workerShadow = scene.worker?.active ? createActorShadow(scene, scene.worker) : undefined;
  const immersion: GameImmersion = {
    shoppers: [shopperA, shopperB],
    shopperShadows: [shopperShadowA, shopperShadowB],
    workerShadow,
    monitor: () => undefined
  };
  scene.__supermarketImmersion = immersion;

  const roomSignBg = scene.add.rectangle(665, 194, 430, 42, 0x071416, 0.62)
    .setStrokeStyle(1, 0x7b9a78, 0.45)
    .setDepth(47)
    .setName("immersion-room-sign-bg");
  const roomSign = scene.add.text(665, 194, roomLabel(scene), {
    fontFamily: "Arial",
    fontSize: "17px",
    color: "#e8f1ed",
    fontStyle: "bold",
    letterSpacing: 2
  }).setOrigin(0.5).setDepth(48).setName("immersion-room-sign");

  const monitor = (): void => {
    if (!scene.scene.isActive()) return;
    syncActorShadow(workerShadow, scene.worker);
    syncActorShadow(shopperShadowA, shopperA);
    syncActorShadow(shopperShadowB, shopperB);

    const room = scene.__weekOneSpaceController?.activeRoom;
    const shoppersVisible = room !== "stock" && !scene.shiftEnded;
    shopperA.setVisible(shoppersVisible);
    shopperB.setVisible(shoppersVisible);
    shopperShadowA.setVisible(shoppersVisible);
    shopperShadowB.setVisible(shoppersVisible);

    if (room && immersion.lastRoom !== room) {
      immersion.lastRoom = room;
      roomSign.setText(roomLabel(scene));
      playRoomTransition(room);
      scene.tweens.add({
        targets: [roomSignBg, roomSign],
        alpha: { from: 0.15, to: 1 },
        duration: 220,
        ease: "Sine.Out"
      });
    }
  };

  immersion.monitor = monitor;
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, monitor);
  scene.input.once("pointerdown", () => startSupermarketAmbience(scene, roomTone(scene)));
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, monitor);
    if (scene.__supermarketImmersion === immersion) scene.__supermarketImmersion = undefined;
  });
  monitor();
}

function createUnifiedDayOneFloor(scene: RuntimeGame): void {
  if (!scene.textures.exists(SupermarketAssets.backgrounds.mainFloor)) return;

  for (const child of scene.children.list) {
    if (child instanceof Phaser.GameObjects.Image) {
      if (
        child.texture.key === Assets.backgrounds.backroom ||
        child.texture.key === Assets.backgrounds.salesfloor ||
        child.texture.key === Assets.props.shelf
      ) {
        child.setVisible(false).disableInteractive();
      }
      continue;
    }

    if (child instanceof Phaser.GameObjects.Text) {
      const value = child.text.toUpperCase();
      if (value === "BACKROOM" || value === "SALES FLOOR") child.setVisible(false).disableInteractive();
      continue;
    }

    if (child instanceof Phaser.GameObjects.Rectangle && child.width <= 12 && child.height >= 800) {
      child.setVisible(false).disableInteractive();
    }
  }

  const background = scene.add.image(665, 622, SupermarketAssets.backgrounds.mainFloor)
    .setDisplaySize(1330, 960)
    .setDepth(0.6)
    .setName("immersion-day1-floor");
  const tone = scene.add.rectangle(665, 622, 1330, 960, 0x061012, 0.045)
    .setDepth(1.1)
    .setName("immersion-day1-tone");

  const rack = addFixture(
    scene,
    ProductionAssets.fixtures.rackBackroomFull,
    275,
    1000,
    500,
    650,
    3
  );
  const coldCase = addFixture(
    scene,
    ProductionAssets.fixtures.frozenLow,
    1040,
    1000,
    510,
    705,
    3
  );
  const produce = addFixture(
    scene,
    ProductionAssets.fixtures.produceFull,
    665,
    1000,
    245,
    305,
    2.8
  );

  const leftForeground = addForeground(
    scene,
    ProductionAssets.foreground.aisleLeft,
    0,
    1040,
    250,
    620,
    7,
    0
  );
  const rightForeground = addForeground(
    scene,
    ProductionAssets.foreground.aisleRight,
    1330,
    1040,
    250,
    620,
    7,
    1
  );

  const stockSign = createZoneSign(scene, 275, 260, "STOCK CAGE");
  const aisleSign = createZoneSign(scene, 1040, 260, "AISLE 4 · DRINKS & DAIRY");

  background.setName("immersion-day1-background");
  [tone, rack, coldCase, produce, leftForeground, rightForeground, stockSign, aisleSign]
    .forEach((object) => object.setName(object.name || "immersion-day1-object"));

  document.body.dataset.immersiveDayOneFloor = "ready";
}

function addFixture(
  scene: Phaser.Scene,
  key: string,
  x: number,
  bottomY: number,
  width: number,
  height: number,
  depth: number
): Phaser.GameObjects.Image {
  if (!scene.textures.exists(key)) {
    return scene.add.image(-2000, -2000, Assets.ui.missingTag).setVisible(false);
  }
  return scene.add.image(x, bottomY, key)
    .setOrigin(0.5, 1)
    .setDisplaySize(width, height)
    .setDepth(depth);
}

function addForeground(
  scene: Phaser.Scene,
  key: string,
  x: number,
  bottomY: number,
  width: number,
  height: number,
  depth: number,
  originX: number
): Phaser.GameObjects.Image {
  if (!scene.textures.exists(key)) {
    return scene.add.image(-2000, -2000, Assets.ui.missingTag).setVisible(false);
  }
  return scene.add.image(x, bottomY, key)
    .setOrigin(originX, 1)
    .setDisplaySize(width, height)
    .setAlpha(0.9)
    .setDepth(depth);
}

function createZoneSign(scene: Phaser.Scene, x: number, y: number, label: string): Phaser.GameObjects.Container {
  const background = scene.add.rectangle(0, 0, 320, 48, 0x173238, 0.86)
    .setStrokeStyle(2, 0x789d89, 0.72);
  const text = scene.add.text(0, 0, label, {
    fontFamily: "Arial",
    fontSize: "17px",
    color: "#ffffff",
    fontStyle: "bold",
    letterSpacing: 1
  }).setOrigin(0.5);
  return scene.add.container(x, y, [background, text]).setDepth(8);
}

function softenHud(scene: Phaser.Scene): void {
  for (const child of scene.children.list) {
    if (child instanceof Phaser.GameObjects.Image) {
      if (child.texture.key === Assets.ui.taskPanel) child.setAlpha(0.78);
      if (child.texture.key === Assets.ui.stepCard) child.setAlpha(0.86);
      if (child.texture.key === Assets.ui.hintBubble) child.setAlpha(Math.min(child.alpha, 0.88));
      continue;
    }

    if (
      child instanceof Phaser.GameObjects.Rectangle &&
      child.y < 170 &&
      child.width >= 1200 &&
      child.height >= 100
    ) {
      child.setAlpha(Math.min(child.alpha, 0.82));
    }
  }
}

function installCeilingLight(scene: Phaser.Scene): void {
  const lights = [
    scene.add.ellipse(270, 290, 350, 110, 0xfff6d0, 0.045),
    scene.add.ellipse(665, 270, 390, 115, 0xfff6d0, 0.05),
    scene.add.ellipse(1080, 300, 340, 105, 0xdff4ff, 0.04)
  ];
  lights.forEach((light, index) => {
    light.setDepth(17).setBlendMode(Phaser.BlendModes.ADD).setName(`immersion-ceiling-light-${index}`);
  });
  scene.tweens.add({
    targets: lights,
    alpha: 0.075,
    duration: 2600,
    yoyo: true,
    repeat: -1,
    ease: "Sine.InOut"
  });
}

function createAmbientShopper(
  scene: Phaser.Scene,
  texture: string,
  x: number,
  bottomY: number,
  flipX: boolean,
  alpha: number
): Phaser.GameObjects.Image {
  const shopper = scene.add.image(x, bottomY, texture)
    .setOrigin(0.5, 1)
    .setFlipX(flipX)
    .setAlpha(alpha)
    .setDepth(34)
    .setName("immersion-floor-shopper");
  fitImage(shopper, 118, 250);
  return shopper;
}

function animateFloorShopper(
  scene: Phaser.Scene,
  shopper: Phaser.GameObjects.Image,
  startX: number,
  endX: number,
  duration: number,
  delay: number
): void {
  scene.tweens.add({
    targets: shopper,
    x: endX,
    duration,
    delay,
    repeat: -1,
    repeatDelay: 3_500,
    ease: "Linear",
    onRepeat: () => {
      shopper.setX(startX).setY(Phaser.Math.Between(940, 990));
    }
  });
}

function createActorShadow(scene: Phaser.Scene, actor: Phaser.GameObjects.Image): Phaser.GameObjects.Ellipse {
  return scene.add.ellipse(actor.x, actor.y + 2, 84, 20, 0x000000, 0.2)
    .setDepth(Math.max(2, actor.depth - 0.2))
    .setName("immersion-actor-shadow");
}

function syncActorShadow(
  shadow: Phaser.GameObjects.Ellipse | undefined,
  actor: Phaser.GameObjects.Image | undefined
): void {
  if (!shadow || !actor?.active) return;
  shadow
    .setVisible(actor.visible && actor.alpha > 0.05)
    .setPosition(actor.x, actor.y + 2)
    .setDisplaySize(Math.max(55, actor.displayWidth * 0.48), Math.max(14, actor.displayWidth * 0.11))
    .setDepth(Math.max(2, actor.depth - 0.2));
}

function roomLabel(scene: RuntimeGame): string {
  const room = scene.__weekOneSpaceController?.activeRoom;
  if (room === "stock") return "BACKROOM · RECEIVING & RESERVE STOCK";
  if (room === "promotion") return "PROMOTION WING · HIGH-TRAFFIC DISPLAY";
  if (room === "cold") return "COLD CASE · DAIRY & FROZEN";
  if (room === "main") return "MAIN FLOOR · ACTIVE CUSTOMER TRAFFIC";

  if (gameSession.day === "day01") return "AISLE 4 · DRINKS & DAIRY";
  if (gameSession.day === "day02") return "FRESH MART · PROMOTION SHIFT";
  return "FRESH MART · SALES FLOOR";
}

function roomTone(scene: RuntimeGame): RoomId | "entrance" {
  return scene.__weekOneSpaceController?.activeRoom ?? "main";
}

function playRoomTransition(room: RoomId): void {
  const context = getAudioContext();
  if (!context || context.state !== "running") return;
  if (room === "cold") {
    playTone(context, 460, 0.018, 0.08, "sine");
    playTone(context, 610, 0.012, 0.11, "sine", 0.07);
    return;
  }
  playTone(context, 330, 0.014, 0.07, "triangle");
}

function startSupermarketAmbience(scene: Phaser.Scene, zone: RoomId | "entrance"): void {
  if (!soundEnabled()) return;
  const context = getAudioContext();
  if (!context) return;

  void context.resume().then(() => {
    if (!scene.scene.isActive()) return;
    activeAmbient?.stop();

    const master = context.createGain();
    master.gain.setValueAtTime(0.0001, context.currentTime);
    master.gain.exponentialRampToValueAtTime(0.75, context.currentTime + 0.25);
    master.connect(context.destination);

    const hum = context.createOscillator();
    const humGain = context.createGain();
    hum.type = "sine";
    hum.frequency.value = zone === "cold" ? 72 : 60;
    humGain.gain.value = zone === "cold" ? 0.0055 : 0.0035;
    hum.connect(humGain);
    humGain.connect(master);
    hum.start();

    const upperHum = context.createOscillator();
    const upperGain = context.createGain();
    upperHum.type = "sine";
    upperHum.frequency.value = zone === "cold" ? 144 : 120;
    upperGain.gain.value = 0.0018;
    upperHum.connect(upperGain);
    upperGain.connect(master);
    upperHum.start();

    const noise = context.createBufferSource();
    const noiseFilter = context.createBiquadFilter();
    const noiseGain = context.createGain();
    noise.buffer = createNoiseBuffer(context);
    noise.loop = true;
    noiseFilter.type = "lowpass";
    noiseFilter.frequency.value = zone === "stock" ? 620 : 980;
    noiseGain.gain.value = zone === "entrance" ? 0.006 : 0.008;
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(master);
    noise.start();

    let beepCycle = 0;
    const beepTimer = scene.time.addEvent({
      delay: zone === "stock" ? 15_000 : 9_500,
      loop: true,
      callback: () => {
        if (context.state !== "running") return;
        beepCycle += 1;
        playTone(context, 880, 0.018, 0.055, "sine");
        playTone(context, 1175, 0.012, 0.06, "sine", 0.07);
        if (beepCycle % 3 === 0) playPaChime(context);
      }
    });

    let stopped = false;
    const stop = (): void => {
      if (stopped) return;
      stopped = true;
      beepTimer.remove(false);
      const now = context.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), now);
      master.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
      globalThis.setTimeout(() => {
        try {
          hum.stop();
          upperHum.stop();
          noise.stop();
          master.disconnect();
        } catch {
          // Nodes may already be stopped when scenes are replaced quickly.
        }
      }, 220);
    };

    activeAmbient = { scene, stop };
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (activeAmbient?.scene === scene) {
        activeAmbient.stop();
        activeAmbient = undefined;
      }
    });
  }).catch(() => undefined);
}

function playDoorChime(): void {
  const context = getAudioContext();
  if (!context || context.state !== "running") return;
  playTone(context, 660, 0.025, 0.12, "sine");
  playTone(context, 880, 0.02, 0.16, "sine", 0.12);
}

function playPaChime(context: AudioContext): void {
  playTone(context, 523, 0.012, 0.12, "triangle");
  playTone(context, 659, 0.012, 0.13, "triangle", 0.11);
  playTone(context, 784, 0.01, 0.16, "triangle", 0.22);
}

function playTone(
  context: AudioContext,
  frequency: number,
  volume: number,
  duration: number,
  type: OscillatorType,
  delay = 0
): void {
  try {
    const start = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume), start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.03);
  } catch {
    // Audio feedback is optional on restricted browsers.
  }
}

function createNoiseBuffer(context: AudioContext): AudioBuffer {
  const length = Math.max(1, Math.floor(context.sampleRate * 2));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < length; index += 1) {
    data[index] = Math.random() * 2 - 1;
  }
  return buffer;
}

function getAudioContext(): AudioContext | undefined {
  if (audioContext) return audioContext;
  try {
    const Constructor = globalThis.AudioContext ??
      (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Constructor) return undefined;
    audioContext = new Constructor();
    return audioContext;
  } catch {
    return undefined;
  }
}

function soundEnabled(): boolean {
  try {
    return globalThis.localStorage?.getItem("supermarket.settings.sound") !== "off";
  } catch {
    return true;
  }
}

function resolveActiveDay(): LevelId {
  try {
    const stored = globalThis.localStorage?.getItem("supermarket.activeDay");
    if (stored && stored in LEVELS) return stored as LevelId;
  } catch {
    // Fall back to the active session.
  }
  return gameSession.day;
}

function findTextureImage(scene: Phaser.Scene, key: string): Phaser.GameObjects.Image | undefined {
  return scene.children.list.find((child): child is Phaser.GameObjects.Image =>
    child instanceof Phaser.GameObjects.Image && child.texture.key === key
  );
}

function fitImage(image: Phaser.GameObjects.Image, maxWidth: number, maxHeight: number): void {
  const width = Math.max(1, image.width);
  const height = Math.max(1, image.height);
  image.setScale(Math.min(maxWidth / width, maxHeight / height));
}

// Keep these path maps referenced so bundlers preserve the asset registration
// contract used by the earlier room/production preload integrations.
void SupermarketBackgroundPaths;
void ProductionAssetPaths;
