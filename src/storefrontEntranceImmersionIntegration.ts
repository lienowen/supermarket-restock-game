import Phaser from "phaser";
import { Assets } from "./assets";
import type { LevelId } from "./domain/gameTypes";
import { LEVELS } from "./levels/levelConfigs";
import { StorefrontScene } from "./scenes/StorefrontScene";
import { gameSession } from "./systems/GameSession";

type RuntimeStorefront = Phaser.Scene & {
  openDaySelector: () => void;
  __immersiveEntranceV2?: Phaser.GameObjects.Container;
};

type StorefrontPrototype = {
  create: (...args: unknown[]) => void;
};

type DisplayNode = Phaser.GameObjects.GameObject & {
  x?: number;
  y?: number;
  depth?: number;
  name?: string;
  visible?: boolean;
  setVisible?: (visible: boolean) => unknown;
  disableInteractive?: () => unknown;
  list?: Phaser.GameObjects.GameObject[];
};

const ROLE_LABELS: Record<LevelId, string> = {
  day01: "STOCK ASSOCIATE",
  day02: "PROMOTION & CHECKOUT",
  day03: "SHIFT SUPERVISOR",
  day04: "FLOOR LEAD",
  day05: "WEEKEND MANAGER"
};

installEntranceOverride();

function installEntranceOverride(): void {
  const prototype = StorefrontScene.prototype as unknown as StorefrontPrototype;
  const originalCreate = prototype.create;

  prototype.create = function createWithRecursiveEntranceCleanup(...args: unknown[]): void {
    originalCreate.apply(this, args);
    const scene = this as unknown as RuntimeStorefront;

    scene.time.delayedCall(0, () => installEntrance(scene));
    scene.time.delayedCall(450, () => {
      if (!scene.__immersiveEntranceV2?.active) return;
      cleanDashboard(scene);
      replaceStartCopy(scene);
    });
  };
}

function installEntrance(scene: RuntimeStorefront): void {
  if (!scene.scene.isActive()) return;
  if (containsText(scene, "SHIFT COMPLETE")) return;

  const lobbyDetected =
    document.body.dataset.stockedLobbyVisual === "ready" ||
    containsText(scene, "STAFF ENTRANCE") ||
    containsText(scene, "START DAY");
  if (!lobbyDetected) return;

  scene.__immersiveEntranceV2?.destroy(true);
  const prior = scene.children.getByName("immersion-entrance");
  prior?.destroy();

  cleanDashboard(scene);
  replaceStartCopy(scene);

  const day = resolveDay();
  const level = LEVELS[day];
  const container = scene.add.container(0, 0)
    .setDepth(68)
    .setName("immersion-entrance-v2");
  scene.__immersiveEntranceV2 = container;

  const edgeLeft = scene.add.rectangle(0, 620, 135, 1000, 0x061012, 0.32)
    .setOrigin(0, 0.5)
    .setName("immersion-v2-edge-left");
  const edgeRight = scene.add.rectangle(1330, 620, 100, 1000, 0x061012, 0.18)
    .setOrigin(1, 0.5)
    .setName("immersion-v2-edge-right");
  const floorShade = scene.add.rectangle(665, 1095, 1330, 175, 0x061012, 0.3)
    .setName("immersion-v2-floor-shade");

  const entranceMatShadow = scene.add.ellipse(655, 1036, 430, 72, 0x000000, 0.22)
    .setName("immersion-v2-mat-shadow");
  const entranceMat = scene.add.rectangle(655, 1025, 370, 82, 0x29453e, 0.48)
    .setStrokeStyle(2, 0x789d89, 0.42)
    .setName("immersion-v2-mat");

  const workerShadow = scene.add.ellipse(650, 1015, 92, 23, 0x000000, 0.24)
    .setName("immersion-v2-worker-shadow");
  const worker = scene.add.image(650, 1018, Assets.characters.workerIdle)
    .setOrigin(0.5, 1)
    .setName("immersion-v2-worker");
  fitImage(worker, 145, 300);
  scene.tweens.add({
    targets: worker,
    y: worker.y - 3,
    duration: 1450,
    yoyo: true,
    repeat: -1,
    ease: "Sine.InOut"
  });

  const shopperA = scene.add.image(-130, 994, Assets.characters.customer01Idle)
    .setOrigin(0.5, 1)
    .setAlpha(0.68)
    .setName("immersion-v2-shopper-a");
  fitImage(shopperA, 116, 245);
  const shopperB = scene.add.image(1460, 975, Assets.characters.customer02Basket)
    .setOrigin(0.5, 1)
    .setFlipX(true)
    .setAlpha(0.58)
    .setName("immersion-v2-shopper-b");
  fitImage(shopperB, 108, 232);
  animateShopper(scene, shopperA, -130, 1460, 13_800, 1_100);
  animateShopper(scene, shopperB, 1460, -140, 16_500, 4_200);

  const panel = scene.add.rectangle(230, 790, 390, 250, 0x0b1719, 0.8)
    .setStrokeStyle(3, 0x7b9a78, 0.82)
    .setName("immersion-v2-panel");
  const eyebrow = scene.add.text(230, 700, `DAY ${Number(day.slice(-2))} · ${ROLE_LABELS[day]}`, {
    fontFamily: "Arial",
    fontSize: "17px",
    color: "#f7e8a9",
    fontStyle: "bold",
    align: "center",
    letterSpacing: 1
  }).setOrigin(0.5).setName("immersion-v2-eyebrow");
  const title = scene.add.text(230, 745, level.title.toUpperCase(), {
    fontFamily: "Arial",
    fontSize: "27px",
    color: "#ffffff",
    fontStyle: "bold",
    align: "center",
    wordWrap: { width: 350 }
  }).setOrigin(0.5).setName("immersion-v2-title");
  const objective = scene.add.text(230, 815, level.objective, {
    fontFamily: "Arial",
    fontSize: "17px",
    color: "#d9e8e3",
    align: "center",
    lineSpacing: 5,
    wordWrap: { width: 345 }
  }).setOrigin(0.5).setName("immersion-v2-objective");
  const instruction = scene.add.text(230, 886, "Walk through the staff entrance to clock in.", {
    fontFamily: "Arial",
    fontSize: "15px",
    color: "#bfe88a",
    fontStyle: "bold",
    align: "center",
    wordWrap: { width: 345 }
  }).setOrigin(0.5).setName("immersion-v2-instruction");

  const boardBg = scene.add.rectangle(155, 1080, 230, 62, 0x173238, 0.9)
    .setStrokeStyle(2, 0x7b9a78, 0.8)
    .setInteractive({ useHandCursor: true })
    .setName("immersion-v2-shift-board");
  const boardText = scene.add.text(155, 1080, "SHIFT BOARD", {
    fontFamily: "Arial",
    fontSize: "17px",
    color: "#ffffff",
    fontStyle: "bold"
  }).setOrigin(0.5).setName("immersion-v2-shift-board-label");
  boardBg.on("pointerdown", () => scene.openDaySelector());

  const lightA = scene.add.rectangle(760, 178, 250, 18, 0xfff8d8, 0.07)
    .setRotation(-0.04)
    .setName("immersion-v2-light-a");
  const lightB = scene.add.rectangle(1080, 212, 220, 16, 0xfff8d8, 0.055)
    .setRotation(0.03)
    .setName("immersion-v2-light-b");
  scene.tweens.add({
    targets: [lightA, lightB],
    alpha: 0.115,
    duration: 2400,
    yoyo: true,
    repeat: -1,
    ease: "Sine.InOut"
  });

  container.add([
    edgeLeft,
    edgeRight,
    floorShade,
    entranceMatShadow,
    entranceMat,
    workerShadow,
    worker,
    shopperA,
    shopperB,
    panel,
    eyebrow,
    title,
    objective,
    instruction,
    boardBg,
    boardText,
    lightA,
    lightB
  ]);

  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    if (scene.__immersiveEntranceV2 === container) scene.__immersiveEntranceV2 = undefined;
  });
}

function cleanDashboard(scene: RuntimeStorefront): void {
  walkScene(scene, (node, parent) => {
    if (node.name?.startsWith("immersion-")) return;

    const parentX = Number(parent?.x ?? 0);
    const parentY = Number(parent?.y ?? 0);
    const x = parentX + Number(node.x ?? 0);
    const y = parentY + Number(node.y ?? 0);
    const depth = Number(node.depth ?? parent?.depth ?? 0);

    const leftDashboard = x < 610 && y > 130 && y < 935 && depth >= 8;
    const bottomMenu = y > 1010 && depth >= 8;
    if (!leftDashboard && !bottomMenu) return;

    node.setVisible?.(false);
    disableNode(node);
  });
}

function replaceStartCopy(scene: Phaser.Scene): void {
  walkScene(scene, (node) => {
    if (!(node instanceof Phaser.GameObjects.Text)) return;
    if (!node.text.startsWith("START DAY")) return;
    node.setText("CLOCK IN · ENTER STORE").setFontSize(25);
  });
}

function containsText(scene: Phaser.Scene, text: string): boolean {
  let found = false;
  walkScene(scene, (node) => {
    if (found || !(node instanceof Phaser.GameObjects.Text)) return;
    if (node.text.toUpperCase().includes(text.toUpperCase())) found = true;
  });
  return found;
}

function walkScene(
  scene: Phaser.Scene,
  visit: (node: DisplayNode, parent?: DisplayNode) => void
): void {
  const walk = (node: DisplayNode, parent?: DisplayNode): void => {
    visit(node, parent);
    node.list?.forEach((child) => walk(child as DisplayNode, node));
  };
  scene.children.list.forEach((child) => walk(child as DisplayNode));
}

function disableNode(node: DisplayNode): void {
  node.disableInteractive?.();
  node.list?.forEach((child) => disableNode(child as DisplayNode));
}

function animateShopper(
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
    repeatDelay: 2800,
    ease: "Linear",
    onRepeat: () => {
      shopper.setX(startX).setY(Phaser.Math.Between(950, 1005));
    }
  });
}

function resolveDay(): LevelId {
  try {
    const stored = globalThis.localStorage?.getItem("supermarket.activeDay");
    if (stored && stored in LEVELS) return stored as LevelId;
  } catch {
    // Use the active game session.
  }
  return gameSession.day;
}

function fitImage(image: Phaser.GameObjects.Image, maxWidth: number, maxHeight: number): void {
  const width = Math.max(1, image.width);
  const height = Math.max(1, image.height);
  image.setScale(Math.min(maxWidth / width, maxHeight / height));
}
