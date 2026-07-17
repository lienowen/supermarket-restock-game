import Phaser from "phaser";
import { AssetPaths, Assets } from "./assets";
import type { LevelId } from "./domain/gameTypes";
import { GameScene } from "./scenes/GameScene";
import { ProductionAssetPaths, ProductionAssets } from "./supermarketProductionAssets";
import { gameSession } from "./systems/GameSession";

type SpaceDay = Extract<LevelId, "day03" | "day04" | "day05">;
type RoomId = "stock" | "main" | "promotion" | "cold";

type SpaceController = {
  activeRoom: RoomId;
  definitions: Array<{ id: RoomId; label: string }>;
};

type RuntimeGame = Phaser.Scene & {
  __weekOneSpaceController?: SpaceController;
  __weekOneImmersionUpgrade?: WeekOneImmersionState;
};

type GamePrototype = {
  preload: (...args: unknown[]) => void;
  create: (...args: unknown[]) => void;
};

type RoomVisual = {
  container: Phaser.GameObjects.Container;
};

type Shopper = {
  room: RoomId;
  image: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
};

type WeekOneImmersionState = {
  rooms: Record<RoomId, RoomVisual>;
  shoppers: Shopper[];
  transition: Phaser.GameObjects.Container;
  announcement: Phaser.GameObjects.Text;
  monitor: () => void;
  announcementTimer?: Phaser.Time.TimerEvent;
  lastRoom?: RoomId;
  lastAnnouncementIndex: number;
};

type ShopperRoute = {
  room: RoomId;
  texture: string;
  fromX: number;
  toX: number;
  y: number;
  width: number;
  height: number;
  duration: number;
  delay: number;
  alpha: number;
};

const prototype = GameScene.prototype as unknown as GamePrototype;
const originalPreload = prototype.preload;
const originalCreate = prototype.create;

prototype.preload = function preloadWeekOneImmersion(...args: unknown[]): void {
  originalPreload.apply(this, args);
  if (!isSpaceDay(gameSession.day)) return;

  const scene = this as unknown as Phaser.Scene;
  const textures: Array<[string, string]> = [
    [Assets.characters.customer01Idle, AssetPaths[Assets.characters.customer01Idle]],
    [Assets.characters.customer01Basket, AssetPaths[Assets.characters.customer01Basket]],
    [Assets.characters.customer02Idle, AssetPaths[Assets.characters.customer02Idle]],
    [Assets.characters.customer02Basket, AssetPaths[Assets.characters.customer02Basket]],
    [ProductionAssets.foreground.aisleLeft, ProductionAssetPaths[ProductionAssets.foreground.aisleLeft]],
    [ProductionAssets.foreground.aisleRight, ProductionAssetPaths[ProductionAssets.foreground.aisleRight]],
    [ProductionAssets.foreground.coldLeft, ProductionAssetPaths[ProductionAssets.foreground.coldLeft]],
    [ProductionAssets.foreground.coldRight, ProductionAssetPaths[ProductionAssets.foreground.coldRight]],
    [ProductionAssets.foreground.promotionLeft, ProductionAssetPaths[ProductionAssets.foreground.promotionLeft]]
  ];

  textures.forEach(([key, path]) => {
    if (!scene.textures.exists(key)) scene.load.image(key, path);
  });
};

prototype.create = function createWeekOneImmersion(...args: unknown[]): void {
  originalCreate.apply(this, args);
  const scene = this as unknown as RuntimeGame;
  if (!isSpaceDay(gameSession.day) || !scene.__weekOneSpaceController) return;
  installWeekOneImmersion(scene, gameSession.day);
};

function installWeekOneImmersion(scene: RuntimeGame, day: SpaceDay): void {
  destroyState(scene.__weekOneImmersionUpgrade);

  const rooms: Record<RoomId, RoomVisual> = {
    stock: createRoomVisual(scene, day, "stock"),
    main: createRoomVisual(scene, day, "main"),
    promotion: createRoomVisual(scene, day, "promotion"),
    cold: createRoomVisual(scene, day, "cold")
  };
  const shoppers = createShopperTraffic(scene, day, rooms);
  const transition = createTransition(scene);
  const announcement = createAnnouncement(scene, day);

  const state: WeekOneImmersionState = {
    rooms,
    shoppers,
    transition,
    announcement,
    monitor: () => undefined,
    lastAnnouncementIndex: 0
  };
  scene.__weekOneImmersionUpgrade = state;

  const monitor = (): void => {
    if (!scene.scene.isActive()) return;
    const controller = scene.__weekOneSpaceController;
    if (!controller) return;

    const activeRoom = controller.activeRoom;
    Object.entries(rooms).forEach(([room, visual]) => {
      visual.container.setVisible(room === activeRoom);
    });
    shoppers.forEach((shopper) => {
      const visible = shopper.room === activeRoom;
      shopper.image.setVisible(visible);
      shopper.shadow.setVisible(visible);
    });

    if (state.lastRoom !== activeRoom) {
      const previousRoom = state.lastRoom;
      state.lastRoom = activeRoom;
      showRoomTransition(scene, state, day, activeRoom, previousRoom);
      updateAnnouncement(state, day, activeRoom);
      hideLegacyRoomLabels(scene);
    }

    document.body.dataset.weekOneImmersion = `${day}:${activeRoom}:ready`;
  };

  state.monitor = monitor;
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, monitor);
  state.announcementTimer = scene.time.addEvent({
    delay: day === "day05" ? 5200 : 7200,
    loop: true,
    callback: () => {
      const room = scene.__weekOneSpaceController?.activeRoom;
      if (room) rotateAnnouncement(scene, state, day, room);
    }
  });

  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, monitor);
    state.announcementTimer?.remove(false);
    destroyState(state);
    scene.__weekOneImmersionUpgrade = undefined;
    delete document.body.dataset.weekOneImmersion;
  });

  scene.time.delayedCall(0, monitor);
  scene.time.delayedCall(420, () => hideLegacyRoomLabels(scene));
}

function createRoomVisual(scene: Phaser.Scene, day: SpaceDay, room: RoomId): RoomVisual {
  const container = scene.add.container(0, 0).setDepth(34).setVisible(false);
  const ceilingGlow = scene.add.rectangle(665, 330, 1120, 150, roomTint(room), 0.035)
    .setName(`week-one-${room}-ceiling-glow`);
  container.add(ceilingGlow);
  scene.tweens.add({
    targets: ceilingGlow,
    alpha: { from: 0.025, to: room === "cold" ? 0.1 : 0.065 },
    duration: room === "promotion" ? 850 : 1800,
    yoyo: true,
    repeat: -1,
    ease: "Sine.InOut"
  });

  addFloorDepthLines(scene, container, room);
  addRoomForeground(scene, container, room);
  addDayRoomDetails(scene, container, day, room);
  createHangingDepartmentSign(scene, container, day, room);
  return { container };
}

function addFloorDepthLines(scene: Phaser.Scene, container: Phaser.GameObjects.Container, room: RoomId): void {
  const graphics = scene.add.graphics();
  const color = room === "cold" ? 0xaedfff : room === "promotion" ? 0xffd45f : 0xe8efe7;
  graphics.lineStyle(2, color, 0.12);
  graphics.lineBetween(260, 1060, 535, 410);
  graphics.lineBetween(1070, 1060, 795, 410);
  graphics.lineBetween(430, 1060, 600, 410);
  graphics.lineBetween(900, 1060, 730, 410);
  container.add(graphics);
}

function addRoomForeground(scene: Phaser.Scene, container: Phaser.GameObjects.Container, room: RoomId): void {
  const specs: Array<{ key: string; x: number; y: number; width: number; height: number; originX: number }> = [];
  if (room === "main") {
    specs.push(
      { key: ProductionAssets.foreground.aisleLeft, x: 0, y: 1068, width: 330, height: 690, originX: 0 },
      { key: ProductionAssets.foreground.aisleRight, x: 1330, y: 1068, width: 330, height: 690, originX: 1 }
    );
  } else if (room === "cold") {
    specs.push(
      { key: ProductionAssets.foreground.coldLeft, x: 0, y: 1068, width: 315, height: 720, originX: 0 },
      { key: ProductionAssets.foreground.coldRight, x: 1330, y: 1068, width: 315, height: 720, originX: 1 }
    );
  } else if (room === "promotion") {
    specs.push({ key: ProductionAssets.foreground.promotionLeft, x: 0, y: 1068, width: 360, height: 710, originX: 0 });
  }

  specs.forEach((spec) => {
    const image = scene.add.image(spec.x, spec.y, spec.key)
      .setOrigin(spec.originX, 1)
      .setDisplaySize(spec.width, spec.height)
      .setAlpha(0.92);
    container.add(image);
  });
}

function addDayRoomDetails(scene: Phaser.Scene, container: Phaser.GameObjects.Container, day: SpaceDay, room: RoomId): void {
  if (room === "stock") {
    const safetyLine = scene.add.rectangle(665, 1015, 600, 7, 0xffcf4b, 0.44);
    const dockLabel = scene.add.text(665, 980, day === "day03" ? "SUPERVISOR RECEIVING ROUTE" : "ACTIVE REPLENISHMENT ZONE", {
      fontFamily: "Arial",
      fontSize: "15px",
      color: "#fff0a3",
      fontStyle: "bold",
      letterSpacing: 2
    }).setOrigin(0.5).setAlpha(0.75);
    container.add([safetyLine, dockLabel]);
    return;
  }

  if (room === "promotion") {
    const banner = scene.add.rectangle(665, 345, day === "day05" ? 560 : 470, 72, 0x8d2421, 0.88)
      .setStrokeStyle(4, 0xffd75a, 0.95);
    const copy = scene.add.text(665, 345, day === "day05" ? "WEEKEND DEALS · QUEUE ACTIVE" : "FLASH SALE · DISPLAY LIVE", {
      fontFamily: "Arial",
      fontSize: "24px",
      color: "#ffffff",
      fontStyle: "bold",
      letterSpacing: 1
    }).setOrigin(0.5);
    container.add([banner, copy]);
    scene.tweens.add({
      targets: [banner, copy],
      scaleX: { from: 1, to: 1.025 },
      scaleY: { from: 1, to: 1.025 },
      duration: 720,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut"
    });
    addQueueStanchions(scene, container, day === "day05" ? 4 : 3);
    return;
  }

  if (room === "cold") {
    const mist = scene.add.rectangle(665, 650, 1330, 690, 0x7fcaff, 0.025);
    container.add(mist);
    scene.tweens.add({
      targets: mist,
      alpha: { from: 0.015, to: 0.065 },
      duration: 2300,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut"
    });
    return;
  }

  const signCopies = day === "day03"
    ? ["AISLE 1 · DRINKS", "AISLE 2 · GROCERY"]
    : day === "day04"
      ? ["VALUE AISLE", "PROMO ROUTE"]
      : ["DRINKS", "PANTRY", "CHECKOUT"];
  const startX = 665 - ((signCopies.length - 1) * 210) / 2;
  signCopies.forEach((copy, index) => {
    const x = startX + index * 210;
    const plate = scene.add.rectangle(x, 390, 184, 44, 0x214e40, 0.82)
      .setStrokeStyle(2, 0xf5d36a, 0.65);
    const label = scene.add.text(x, 390, copy, {
      fontFamily: "Arial",
      fontSize: "13px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setOrigin(0.5);
    container.add([plate, label]);
  });
}

function addQueueStanchions(scene: Phaser.Scene, container: Phaser.GameObjects.Container, count: number): void {
  const graphics = scene.add.graphics();
  graphics.lineStyle(5, 0xb99b58, 0.55);
  for (let index = 0; index < count; index += 1) {
    const x = 760 + index * 115;
    graphics.strokeCircle(x, 935, 10);
    graphics.lineBetween(x, 935, x, 1010);
    if (index < count - 1) graphics.lineBetween(x, 955, x + 115, 955);
  }
  container.add(graphics);
}

function createHangingDepartmentSign(scene: Phaser.Scene, container: Phaser.GameObjects.Container, day: SpaceDay, room: RoomId): void {
  const label = departmentLabel(day, room);
  const width = Math.max(300, Math.min(640, label.length * 18));
  const leftCable = scene.add.rectangle(-width / 2 + 34, -54, 3, 62, 0x26383b, 0.72);
  const rightCable = scene.add.rectangle(width / 2 - 34, -54, 3, 62, 0x26383b, 0.72);
  const background = scene.add.rectangle(0, 0, width, 62, roomTint(room), 0.9)
    .setStrokeStyle(3, 0xf0d06e, 0.78);
  const text = scene.add.text(0, 0, label, {
    fontFamily: "Arial",
    fontSize: "20px",
    color: "#ffffff",
    fontStyle: "bold",
    letterSpacing: 1,
    align: "center"
  }).setOrigin(0.5);
  const sign = scene.add.container(665, 275, [leftCable, rightCable, background, text]);
  container.add(sign);
  scene.tweens.add({
    targets: sign,
    angle: { from: -0.3, to: 0.3 },
    duration: 2400,
    yoyo: true,
    repeat: -1,
    ease: "Sine.InOut"
  });
}

function createShopperTraffic(scene: Phaser.Scene, day: SpaceDay, rooms: Record<RoomId, RoomVisual>): Shopper[] {
  return shopperRoutes(day).map((route) => {
    const shadow = scene.add.ellipse(route.fromX, route.y + 4, route.width * 0.5, 22, 0x000000, 0.2)
      .setVisible(false);
    const image = scene.add.image(route.fromX, route.y, route.texture)
      .setOrigin(0.5, 1)
      .setAlpha(route.alpha)
      .setFlipX(route.toX < route.fromX)
      .setVisible(false);
    fitImage(image, route.width, route.height);
    rooms[route.room].container.add([shadow, image]);

    scene.tweens.add({
      targets: [shadow, image],
      x: route.toX,
      duration: route.duration,
      delay: route.delay,
      repeat: -1,
      repeatDelay: 1200,
      ease: "Linear"
    });
    scene.tweens.add({
      targets: image,
      y: route.y - 3,
      duration: 520,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut"
    });

    return { room: route.room, image, shadow };
  });
}

function shopperRoutes(day: SpaceDay): ShopperRoute[] {
  const common: ShopperRoute[] = [
    {
      room: "main",
      texture: Assets.characters.customer01Basket,
      fromX: -120,
      toX: 1450,
      y: 1005,
      width: 116,
      height: 245,
      duration: day === "day05" ? 9000 : 13_500,
      delay: 600,
      alpha: 0.8
    },
    {
      room: "cold",
      texture: Assets.characters.customer02Basket,
      fromX: 1450,
      toX: -120,
      y: 1010,
      width: 112,
      height: 238,
      duration: day === "day05" ? 10_500 : 15_500,
      delay: 2100,
      alpha: 0.76
    }
  ];

  if (day === "day03") return common;

  common.push({
    room: "promotion",
    texture: Assets.characters.customer01Idle,
    fromX: 380,
    toX: 990,
    y: 1015,
    width: 110,
    height: 232,
    duration: 8200,
    delay: 900,
    alpha: 0.84
  });

  if (day === "day05") {
    common.push(
      {
        room: "main",
        texture: Assets.characters.customer02Idle,
        fromX: 1450,
        toX: -120,
        y: 965,
        width: 105,
        height: 222,
        duration: 8200,
        delay: 2800,
        alpha: 0.72
      },
      {
        room: "promotion",
        texture: Assets.characters.customer02Basket,
        fromX: 1080,
        toX: 580,
        y: 985,
        width: 105,
        height: 224,
        duration: 7600,
        delay: 3200,
        alpha: 0.76
      }
    );
  }
  return common;
}

function createTransition(scene: Phaser.Scene): Phaser.GameObjects.Container {
  const shade = scene.add.rectangle(0, 0, 1330, 900, 0x061012, 0.52).setOrigin(0.5);
  const route = scene.add.text(0, -20, "", {
    fontFamily: "Arial",
    fontSize: "31px",
    color: "#ffffff",
    fontStyle: "bold",
    letterSpacing: 2,
    align: "center"
  }).setOrigin(0.5);
  const sub = scene.add.text(0, 34, "PUSHING THE CART THROUGH THE STORE", {
    fontFamily: "Arial",
    fontSize: "15px",
    color: "#d7e6df",
    fontStyle: "bold",
    letterSpacing: 2
  }).setOrigin(0.5);
  return scene.add.container(665, 635, [shade, route, sub])
    .setDepth(49)
    .setAlpha(0)
    .setVisible(false)
    .setName("week-one-room-transition");
}

function showRoomTransition(scene: Phaser.Scene, state: WeekOneImmersionState, day: SpaceDay, room: RoomId, previous?: RoomId): void {
  if (!previous) return;
  const direction = roomIndex(day, room) >= roomIndex(day, previous) ? 1 : -1;
  const title = state.transition.getAt(1) as Phaser.GameObjects.Text;
  title.setText(`WALKING TO ${roomDisplayName(room)}`);
  state.transition.setVisible(true).setAlpha(0).setX(665 + direction * 95);
  scene.tweens.killTweensOf(state.transition);
  scene.tweens.add({
    targets: state.transition,
    x: 665,
    alpha: 1,
    duration: 135,
    ease: "Cubic.Out",
    yoyo: true,
    hold: 120,
    onComplete: () => state.transition.setVisible(false)
  });
}

function createAnnouncement(scene: Phaser.Scene, day: SpaceDay): Phaser.GameObjects.Text {
  return scene.add.text(665, 1032, announcementMessages(day, "stock")[0], {
    fontFamily: "Arial",
    fontSize: day === "day05" ? "15px" : "16px",
    color: "#e5eee9",
    fontStyle: "bold",
    backgroundColor: "rgba(6, 20, 22, 0.76)",
    padding: { x: 18, y: 9 },
    align: "center",
    wordWrap: { width: 860 }
  }).setOrigin(0.5).setDepth(47).setAlpha(0.86).setName("week-one-store-announcement");
}

function updateAnnouncement(state: WeekOneImmersionState, day: SpaceDay, room: RoomId): void {
  state.lastAnnouncementIndex = 0;
  state.announcement.setText(announcementMessages(day, room)[0]);
}

function rotateAnnouncement(scene: Phaser.Scene, state: WeekOneImmersionState, day: SpaceDay, room: RoomId): void {
  const messages = announcementMessages(day, room);
  state.lastAnnouncementIndex = (state.lastAnnouncementIndex + 1) % messages.length;
  scene.tweens.add({
    targets: state.announcement,
    alpha: 0,
    duration: 120,
    yoyo: true,
    onYoyo: () => state.announcement.setText(messages[state.lastAnnouncementIndex])
  });
}

function announcementMessages(day: SpaceDay, room: RoomId): string[] {
  if (day === "day03") {
    if (room === "stock") return ["RADIO: Verify the delivery, then start the supervisor floor walk.", "Receiving door clear. Keep the cart route open."];
    if (room === "main") return ["SUPERVISOR WALK: Check drinks and grocery before the next customer wave.", "Customer traffic building in the centre aisle."];
    return ["COLD CASE CHECK: Milk temperature stable. Fill gaps before service requests arrive.", "Cold aisle traffic is moving toward checkout."];
  }
  if (day === "day04") {
    if (room === "stock") return ["FLASH SALE STOCK: Build one mixed cart before leaving receiving.", "Promotion reserve is moving quickly—avoid empty trips."];
    if (room === "promotion") return ["PROMOTION LIVE: Queue forming beside the display.", "PA: Flash-sale customers are entering the promotion aisle."];
    if (room === "cold") return ["DAIRY ALERT: Promotion traffic is pulling stock from the cold case.", "Keep the dairy door area clear for customers."];
    return ["MAIN FLOOR: Value aisle demand is rising.", "PA: Additional customers entering through the front doors."];
  }
  if (room === "stock") return ["WEEKEND RUSH: Load fast, but keep the receiving lane safe.", "All departments are calling for reserve stock."];
  if (room === "promotion") return ["QUEUE ACTIVE: Promotion customers are waiting for space.", "Checkout is calling for support from the promotion aisle."];
  if (room === "cold") return ["COLD AISLE BUSY: Families are shopping dairy and front produce.", "Restock around customers, not through them."];
  return ["WEEKEND FLOOR: Two customer streams are crossing the main aisle.", "PA: Checkout queue growing—keep the route to the front clear."];
}

function hideLegacyRoomLabels(scene: Phaser.Scene): void {
  const hiddenLabels = new Set([
    "BACKROOM STOCK",
    "MAIN FLOOR",
    "PROMOTION",
    "COLD CASE",
    "BACKROOM · RECEIVING & RESERVE STOCK"
  ]);
  scene.children.list.forEach((child) => {
    if (!(child instanceof Phaser.GameObjects.Text)) return;
    if (child.name.startsWith("week-one-")) return;
    if (hiddenLabels.has(child.text.trim().toUpperCase())) child.setVisible(false);
  });
}

function destroyState(state?: WeekOneImmersionState): void {
  if (!state) return;
  Object.values(state.rooms).forEach((room) => room.container.destroy(true));
  state.transition.destroy(true);
  state.announcement.destroy();
  state.announcementTimer?.remove(false);
}

function departmentLabel(day: SpaceDay, room: RoomId): string {
  if (room === "stock") return day === "day03" ? "RECEIVING · SUPERVISOR START" : "BACKROOM · RESERVE STOCK";
  if (room === "main") return day === "day05" ? "MAIN FLOOR · WEEKEND TRAFFIC" : "MAIN FLOOR · ACTIVE AISLES";
  if (room === "promotion") return day === "day05" ? "PROMOTION · CHECKOUT QUEUE" : "PROMOTION · FLASH SALE";
  return day === "day03" ? "COLD CASE · SERVICE CHECK" : "COLD CASE · DAIRY & PRODUCE";
}

function roomDisplayName(room: RoomId): string {
  if (room === "stock") return "BACKROOM";
  if (room === "main") return "MAIN FLOOR";
  if (room === "promotion") return "PROMOTION AISLE";
  return "COLD CASE";
}

function roomIndex(day: SpaceDay, room: RoomId): number {
  const order: RoomId[] = day === "day03"
    ? ["stock", "main", "cold"]
    : ["stock", "main", "promotion", "cold"];
  return Math.max(0, order.indexOf(room));
}

function roomTint(room: RoomId): number {
  if (room === "promotion") return 0x7e3028;
  if (room === "cold") return 0x244c69;
  if (room === "stock") return 0x31543d;
  return 0x245144;
}

function fitImage(image: Phaser.GameObjects.Image, maxWidth: number, maxHeight: number): void {
  const width = Math.max(1, image.width);
  const height = Math.max(1, image.height);
  image.setScale(Math.min(maxWidth / width, maxHeight / height));
}

function isSpaceDay(day: LevelId): day is SpaceDay {
  return day === "day03" || day === "day04" || day === "day05";
}
