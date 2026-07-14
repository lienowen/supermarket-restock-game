import Phaser from "phaser";
import { AssetPaths, Assets } from "./assets";
import { GameScene } from "./scenes/GameScene";
import { gameSession } from "./systems/GameSession";

type BatchDay = "day04" | "day05";

type Destroyable = Phaser.GameObjects.GameObject & {
  destroy: (fromScene?: boolean) => void;
};

type RuntimeGame = Phaser.Scene & {
  taskText?: Phaser.GameObjects.Text;
  hintText?: Phaser.GameObjects.Text;
  starText?: Phaser.GameObjects.Text;
  moneyText?: Phaser.GameObjects.Text;
  timerText?: Phaser.GameObjects.Text;
  comboText?: Phaser.GameObjects.Text;
  guideGraphics?: Phaser.GameObjects.Graphics;
  guideLabelBg?: Phaser.GameObjects.Rectangle;
  guideLabel?: Phaser.GameObjects.Text;
  guideTween?: Phaser.Tweens.Tween;
  guideMode?: string;
  __compactHud?: Phaser.GameObjects.Container;
  __contractPanel?: Phaser.GameObjects.Container;
  __supervisorContractPanel?: Phaser.GameObjects.Container;
  __campaignDutyStrip?: Phaser.GameObjects.Container;
  __campaignInspectionPanel?: Phaser.GameObjects.Container;
  __campaignIncidentPanel?: Phaser.GameObjects.Container;
  __dutyHighlight?: Phaser.GameObjects.Rectangle;
  __dutyHighlightLabel?: Phaser.GameObjects.Text;
  __atmosphereShade?: Phaser.GameObjects.Rectangle;
  __storeStatus?: Phaser.GameObjects.Text;
};

type GamePrototype = {
  preload: (...args: unknown[]) => void;
  create: (...args: unknown[]) => void;
};

type DisplayObjectSnapshot = {
  index: number;
  type: string;
  name: string;
  depth: number;
  visible: boolean;
  alpha: number;
  x: number;
  y: number;
  width: number;
  height: number;
  displayWidth: number;
  displayHeight: number;
  scaleX: number;
  scaleY: number;
  angle: number;
  blendMode: number | string;
  parentType?: string;
  parentDepth?: number;
  texture?: string;
  frameWidth?: number;
  frameHeight?: number;
  fillColor?: number;
  fillAlpha?: number;
  strokeColor?: number;
  strokeAlpha?: number;
  lineWidth?: number;
  commandCount?: number;
  text?: string;
};

const AUXILIARY_SCENES = ["polish-overlay", "progression-customer"] as const;
const DUPLICATE_FLOOR_KEY = "week-one-full-sales-floor";
const VERIFIED_FLOOR_KEY = Assets.storefront.day;
const VERIFIED_FLOOR_PATH = AssetPaths[VERIFIED_FLOOR_KEY as keyof typeof AssetPaths];
const LEGACY_IMAGE_KEYS = new Set<string>([
  Assets.ui.taskPanel,
  Assets.ui.taskButton,
  Assets.ui.workerAvatar,
  Assets.ui.star,
  Assets.ui.coin,
  Assets.ui.timer,
  Assets.ui.menu,
  Assets.ui.stepCard
]);

const prototype = GameScene.prototype as unknown as GamePrototype;
const originalPreload = prototype.preload;
const originalCreate = prototype.create;

prototype.preload = function preloadVerifiedBatchFloor(...args: unknown[]): void {
  originalPreload.apply(this, args);
  const scene = this as unknown as Phaser.Scene;
  if (!scene.textures.exists(VERIFIED_FLOOR_KEY)) {
    scene.load.image(VERIFIED_FLOOR_KEY, VERIFIED_FLOOR_PATH);
  }
};

prototype.create = function createWithBatchReleaseCleanup(...args: unknown[]): void {
  originalCreate.apply(this, args);
  const scene = this as unknown as RuntimeGame;
  const day = resolveBatchDay();

  setAuxiliaryScenesEnabled(scene, !day);
  if (!day) return;

  preserveBatchDay(day);
  cleanLegacyBatchLayers(scene);

  // Some old integrations build their visual helpers on the next frame or from
  // short timers. Repeat cleanup after those callbacks have had a chance to run.
  [0, 180, 650].forEach((delay) => {
    scene.time.delayedCall(delay, () => {
      if (!scene.scene.isActive()) return;
      preserveBatchDay(day);
      setAuxiliaryScenesEnabled(scene, false);
      cleanLegacyBatchLayers(scene);
      if (delay === 650) publishDisplayAudit(scene, day);
    });
  });
};

function resolveBatchDay(): BatchDay | undefined {
  try {
    const pending = globalThis.localStorage?.getItem("supermarket.pendingDay");
    if (isBatchDay(pending)) return pending;
    const active = globalThis.localStorage?.getItem("supermarket.activeDay");
    if (isBatchDay(active)) return active;
  } catch {
    // Fall through to the canonical in-memory session.
  }
  return isBatchDay(gameSession.day) ? gameSession.day : undefined;
}

function preserveBatchDay(day: BatchDay): void {
  try {
    globalThis.localStorage?.setItem("supermarket.activeDay", day);
    globalThis.localStorage?.setItem("supermarket.weekOneSelectedDay", day);
  } catch {
    // The current runtime still keeps the selected day below.
  }
  if (gameSession.day !== day) gameSession.setActiveDay(day);
}

function setAuxiliaryScenesEnabled(scene: Phaser.Scene, enabled: boolean): void {
  AUXILIARY_SCENES.forEach((key) => {
    const auxiliary = scene.scene.get(key);
    if (!auxiliary) return;

    if (enabled) {
      if (auxiliary.scene.isSleeping()) auxiliary.scene.wake();
      auxiliary.scene.setVisible(true);
      auxiliary.input.enabled = true;
      auxiliary.time.paused = false;
      auxiliary.tweens.resumeAll();
      return;
    }

    auxiliary.scene.setVisible(false);
    auxiliary.input.enabled = false;
    auxiliary.time.paused = true;
    auxiliary.tweens.pauseAll();
    if (!auxiliary.scene.isSleeping()) auxiliary.scene.sleep();
  });
}

function cleanLegacyBatchLayers(scene: RuntimeGame): void {
  replaceBatchFloorTexture(scene);

  destroyRuntimeObject(scene, "__compactHud");
  destroyRuntimeObject(scene, "__contractPanel");
  destroyRuntimeObject(scene, "__supervisorContractPanel");
  destroyRuntimeObject(scene, "__campaignDutyStrip");
  destroyRuntimeObject(scene, "__campaignInspectionPanel");
  destroyRuntimeObject(scene, "__campaignIncidentPanel");
  destroyRuntimeObject(scene, "__dutyHighlight");
  destroyRuntimeObject(scene, "__dutyHighlightLabel");
  destroyRuntimeObject(scene, "__atmosphereShade");
  destroyRuntimeObject(scene, "__storeStatus");

  scene.taskText?.setVisible(false);
  scene.hintText?.setVisible(false);
  scene.starText?.setVisible(false);
  scene.moneyText?.setVisible(false);
  scene.timerText?.setVisible(false);
  scene.comboText?.setVisible(false);

  scene.guideTween?.stop();
  scene.guideTween = undefined;
  scene.guideGraphics?.clear().setVisible(false).setAlpha(1);
  scene.guideLabelBg?.setVisible(false);
  scene.guideLabel?.setVisible(false);
  scene.guideMode = "NONE";

  for (const child of [...scene.children.list]) {
    const displayChild = child as Phaser.GameObjects.GameObject & { depth: number };
    if (!child.active || displayChild.depth >= 8000) continue;

    if (child instanceof Phaser.GameObjects.Image && LEGACY_IMAGE_KEYS.has(child.texture.key)) {
      child.setVisible(false).disableInteractive();
      continue;
    }

    if (child instanceof Phaser.GameObjects.Text && isLegacyBatchText(child.text)) {
      const parent = child.parentContainer as Phaser.GameObjects.Container | null;
      if (parent?.active && parent.depth < 8000) {
        parent.destroy(true);
      } else {
        child.destroy();
      }
    }
  }
}

function replaceBatchFloorTexture(scene: RuntimeGame): void {
  if (!scene.textures.exists(VERIFIED_FLOOR_KEY)) return;
  const background = scene.children.list.find((child): child is Phaser.GameObjects.Image =>
    child instanceof Phaser.GameObjects.Image &&
    (child.texture.key === DUPLICATE_FLOOR_KEY || child.texture.key === VERIFIED_FLOOR_KEY || child.texture.key === "__MISSING") &&
    Math.abs(child.x - 665) < 4 &&
    Math.abs(child.y - 591) < 4
  );
  if (!background) return;

  background
    .setTexture(VERIFIED_FLOOR_KEY)
    .setPosition(665, 591)
    .setAlpha(1)
    .setDepth(0)
    .clearTint();
  coverImage(background, 1330, 1182);
}

function publishDisplayAudit(scene: RuntimeGame, day: BatchDay): void {
  if (new URLSearchParams(globalThis.location?.search ?? "").get("test") !== "1") return;

  const objects = scene.children.list
    .map((child, index) => snapshotDisplayObject(child, index))
    .filter((entry) => entry.visible || entry.type === "Graphics")
    .sort((left, right) => left.depth - right.depth || left.index - right.index);

  document.body.dataset.batchDisplayAudit = JSON.stringify({
    day,
    scene: scene.scene.key,
    objectCount: objects.length,
    objects
  });
}

function snapshotDisplayObject(child: Phaser.GameObjects.GameObject, index: number): DisplayObjectSnapshot {
  const display = child as Phaser.GameObjects.GameObject & {
    name?: string;
    type?: string;
    depth?: number;
    visible?: boolean;
    alpha?: number;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    displayWidth?: number;
    displayHeight?: number;
    scaleX?: number;
    scaleY?: number;
    angle?: number;
    blendMode?: number | string;
    parentContainer?: Phaser.GameObjects.Container | null;
  };

  const entry: DisplayObjectSnapshot = {
    index,
    type: display.type ?? child.constructor.name,
    name: display.name ?? "",
    depth: finite(display.depth),
    visible: display.visible !== false,
    alpha: finite(display.alpha, 1),
    x: finite(display.x),
    y: finite(display.y),
    width: finite(display.width),
    height: finite(display.height),
    displayWidth: finite(display.displayWidth),
    displayHeight: finite(display.displayHeight),
    scaleX: finite(display.scaleX, 1),
    scaleY: finite(display.scaleY, 1),
    angle: finite(display.angle),
    blendMode: display.blendMode ?? 0
  };

  if (display.parentContainer) {
    entry.parentType = display.parentContainer.type;
    entry.parentDepth = display.parentContainer.depth;
  }

  if (child instanceof Phaser.GameObjects.Image) {
    entry.texture = child.texture.key;
    entry.frameWidth = child.frame.realWidth;
    entry.frameHeight = child.frame.realHeight;
  } else if (child instanceof Phaser.GameObjects.Rectangle) {
    entry.fillColor = child.fillColor;
    entry.fillAlpha = child.fillAlpha;
    entry.strokeColor = child.strokeColor;
    entry.strokeAlpha = child.strokeAlpha;
    entry.lineWidth = child.lineWidth;
  } else if (child instanceof Phaser.GameObjects.Graphics) {
    const graphics = child as Phaser.GameObjects.Graphics & { commandBuffer?: unknown[] };
    entry.commandCount = graphics.commandBuffer?.length ?? 0;
  } else if (child instanceof Phaser.GameObjects.Text) {
    entry.text = child.text.slice(0, 180);
  }

  return entry;
}

function finite(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function coverImage(image: Phaser.GameObjects.Image, width: number, height: number): void {
  const sourceWidth = Math.max(1, image.frame.realWidth || image.width);
  const sourceHeight = Math.max(1, image.frame.realHeight || image.height);
  image.setScale(Math.max(width / sourceWidth, height / sourceHeight));
}

function destroyRuntimeObject(scene: RuntimeGame, key: keyof RuntimeGame): void {
  const runtime = scene as unknown as Record<string, unknown>;
  const value = runtime[key as string] as Destroyable | undefined;
  if (value?.active) value.destroy(true);
  runtime[key as string] = undefined;
}

function isLegacyBatchText(text: string): boolean {
  const normalized = text.toUpperCase();
  return normalized.includes("MORNING RESTOCK")
    || normalized.includes("LEARN THE FAST RESTOCK LOOP")
    || normalized.includes("RESTOCK PROFESSIONAL")
    || normalized.includes("PERFECT AVAILABILITY")
    || normalized.includes("EFFICIENT SHIFT")
    || normalized.includes("PROMOTION CONTROL")
    || normalized.includes("SERVICE STAR")
    || normalized.includes("PROMOTION RESCUE")
    || normalized.includes("SERVICE LEAD")
    || normalized.includes("EQUIPMENT RECOVERY")
    || normalized.includes("CONTROLLED FLOOR")
    || normalized.includes("CONTRACT BONUS");
}

function isBatchDay(value: unknown): value is BatchDay {
  return value === "day04" || value === "day05";
}
