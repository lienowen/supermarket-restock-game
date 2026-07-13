import Phaser from "phaser";
import { AssetPaths, Assets, type AssetKey } from "./assets";
import type { LevelId } from "./domain/gameTypes";
import { OpeningScene } from "./scenes/OpeningScene";
import { StorefrontScene } from "./scenes/StorefrontScene";

const ACTIVE_DAY_KEY = "supermarket.activeDay";

const CORE_GAME_ASSETS = [
  Assets.backgrounds.backroom,
  Assets.backgrounds.salesfloor,
  Assets.props.cart,
  Assets.props.cartEmpty,
  Assets.props.cartLoading,
  Assets.props.cartReady,
  Assets.props.cartFull,
  Assets.props.shelf,
  Assets.props.boxCola,
  Assets.props.boxWater,
  Assets.props.boxMilk,
  Assets.products.cola,
  Assets.products.water,
  Assets.products.milk,
  Assets.characters.workerIdle,
  Assets.characters.workerCarry,
  Assets.characters.workerRestock,
  Assets.characters.workerPush,
  Assets.characters.customer01Idle,
  Assets.characters.customer01Basket,
  Assets.characters.customer02Idle,
  Assets.characters.customer02Basket,
  Assets.ui.workerAvatar,
  Assets.ui.coin,
  Assets.ui.star,
  Assets.ui.timer,
  Assets.ui.menu,
  Assets.ui.taskPanel,
  Assets.ui.taskButton,
  Assets.ui.hintBubble,
  Assets.ui.stepCard,
  Assets.ui.missingTag
] as const satisfies readonly AssetKey[];

const LOBBY_DISPLAY_ASSETS = [
  Assets.props.shelf,
  Assets.products.cola,
  Assets.products.water,
  Assets.products.milk
] as const satisfies readonly AssetKey[];

type RuntimeOpening = Phaser.Scene & {
  __milkBadgeSync?: () => void;
  __day3TransitionPending?: boolean;
  __day3TransitionOverlay?: Phaser.GameObjects.Container;
};

type OpeningPrototype = {
  preload: () => void;
  create: (...args: unknown[]) => void;
  finishOpening: () => void;
};

type StorefrontPrototype = {
  preload: () => void;
  createLobbyView: () => void;
};

type MilkImage = Phaser.GameObjects.Image & {
  __milkCaseBadge?: Phaser.GameObjects.Container;
};

installStorefrontDisplay();
installOpeningReliability();

function installStorefrontDisplay(): void {
  const prototype = StorefrontScene.prototype as unknown as StorefrontPrototype;
  const originalPreload = prototype.preload;
  const originalLobby = prototype.createLobbyView;

  prototype.preload = function preloadStockedLobbyAndDay3Core(): void {
    originalPreload.call(this);
    const scene = this as unknown as Phaser.Scene;
    loadMissing(scene, LOBBY_DISPLAY_ASSETS);
    if (readActiveDay() === "day03") loadMissing(scene, CORE_GAME_ASSETS);
  };

  prototype.createLobbyView = function createStockedSupermarketLobby(): void {
    originalLobby.call(this);
    createStockedMarketBackdrop(this as unknown as Phaser.Scene);
  };
}

function installOpeningReliability(): void {
  const prototype = OpeningScene.prototype as unknown as OpeningPrototype;
  const originalPreload = prototype.preload;
  const originalCreate = prototype.create;
  const originalFinish = prototype.finishOpening;

  prototype.preload = function preloadDay3GameBeforeReceiving(): void {
    originalPreload.call(this);
    if (readActiveDay() === "day03") {
      loadMissing(this as unknown as Phaser.Scene, CORE_GAME_ASSETS);
    }
  };

  prototype.create = function createWithVisibleMilkCases(...args: unknown[]): void {
    originalCreate.apply(this, args);
    installMilkCaseFallback(this as unknown as RuntimeOpening);
  };

  prototype.finishOpening = function finishDay3WithoutBlackScreen(): void {
    const scene = this as unknown as RuntimeOpening;
    if (readActiveDay() !== "day03" || coreGameAssetsReady(scene)) {
      originalFinish.call(this);
      return;
    }
    if (scene.__day3TransitionPending) return;

    scene.__day3TransitionPending = true;
    showDay3TransitionOverlay(scene);
    const missing = CORE_GAME_ASSETS.filter((key) => !scene.textures.exists(key));
    loadMissing(scene, missing);

    const onProgress = (progress: number): void => updateDay3TransitionOverlay(scene, progress);
    const onComplete = (): void => {
      scene.load.off("progress", onProgress);
      scene.__day3TransitionPending = false;
      updateDay3TransitionOverlay(scene, 1);
      scene.time.delayedCall(100, () => {
        scene.__day3TransitionOverlay?.destroy(true);
        scene.__day3TransitionOverlay = undefined;
        originalFinish.call(this);
      });
    };

    scene.load.on("progress", onProgress);
    scene.load.once("complete", onComplete);
    scene.load.start();
  };
}

function createStockedMarketBackdrop(scene: Phaser.Scene): void {
  const depth = 4;
  scene.add.rectangle(965, 390, 670, 470, 0x102b2e, 0.94)
    .setStrokeStyle(5, 0x7fac7b, 0.95)
    .setDepth(depth);

  scene.add.text(965, 178, "FRESH DRINKS  ·  DAIRY  ·  COLD WATER", {
    fontFamily: "Arial",
    fontSize: "20px",
    color: "#fff0ac",
    fontStyle: "bold",
    letterSpacing: 2,
    backgroundColor: "#315f4b",
    padding: { x: 20, y: 10 }
  }).setOrigin(0.5).setDepth(depth + 3);

  const shelfXs = [740, 965, 1190];
  shelfXs.forEach((x, shelfIndex) => {
    scene.add.image(x, 415, Assets.props.shelf)
      .setDisplaySize(205, 355)
      .setDepth(depth + 1);

    const products = shelfIndex === 0
      ? [Assets.products.cola, Assets.products.water, Assets.products.milk]
      : shelfIndex === 1
        ? [Assets.products.milk, Assets.products.cola, Assets.products.water]
        : [Assets.products.water, Assets.products.milk, Assets.products.cola];

    [295, 405, 515].forEach((y, row) => {
      [-55, 0, 55].forEach((offset, column) => {
        const key = products[(row + column) % products.length];
        scene.add.image(x + offset, y, key)
          .setDisplaySize(key === Assets.products.milk ? 42 : 46, 72)
          .setDepth(depth + 2);
      });
    });
  });

  scene.add.text(965, 585, "FULLY STOCKED · READY FOR TODAY'S SHIFT", {
    fontFamily: "Arial",
    fontSize: "18px",
    color: "#dff0d8",
    fontStyle: "bold",
    backgroundColor: "#173238",
    padding: { x: 18, y: 9 }
  }).setOrigin(0.5).setDepth(depth + 3);
}

function installMilkCaseFallback(scene: RuntimeOpening): void {
  const sync = (): void => {
    scene.children.list.forEach((child) => {
      if (!(child instanceof Phaser.GameObjects.Image)) return;
      const image = child as MilkImage;
      if (image.texture.key !== Assets.delivery.boxMilk) return;

      if (!image.__milkCaseBadge) image.__milkCaseBadge = createMilkCaseBadge(scene);
      const badge = image.__milkCaseBadge;
      if (!image.active) {
        badge.destroy(true);
        image.__milkCaseBadge = undefined;
        return;
      }

      const scale = Phaser.Math.Clamp(
        Math.min(Math.max(1, image.displayWidth) / 88, Math.max(1, image.displayHeight) / 74),
        0.72,
        1.35
      );
      badge
        .setPosition(image.x, image.y - image.displayHeight * 0.5)
        .setScale(scale)
        .setDepth(image.depth + 0.25)
        .setAlpha(image.alpha)
        .setVisible(image.visible);
    });
  };

  scene.__milkBadgeSync = sync;
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, sync);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, sync);
    scene.children.list.forEach((child) => {
      if (child instanceof Phaser.GameObjects.Image) {
        (child as MilkImage).__milkCaseBadge?.destroy(true);
      }
    });
  });
}

function createMilkCaseBadge(scene: Phaser.Scene): Phaser.GameObjects.Container {
  const box = scene.add.rectangle(0, 0, 78, 52, 0xf8fbff, 1)
    .setStrokeStyle(4, 0x4d91c6, 1);
  const stripe = scene.add.rectangle(0, -17, 70, 10, 0x4d91c6, 1);
  const text = scene.add.text(0, 5, "MILK", {
    fontFamily: "Arial",
    fontSize: "16px",
    color: "#244d6c",
    fontStyle: "bold"
  }).setOrigin(0.5);
  return scene.add.container(0, 0, [box, stripe, text]);
}

function showDay3TransitionOverlay(scene: RuntimeOpening): void {
  const shade = scene.add.rectangle(665, 591, 1330, 1182, 0x071012, 0.74).setDepth(9000);
  const panel = scene.add.rectangle(665, 590, 760, 300, 0x10252a, 0.995)
    .setStrokeStyle(7, 0x78a465)
    .setDepth(9001);
  const title = scene.add.text(665, 520, "ENTERING THE BACKROOM", {
    fontFamily: "Arial",
    fontSize: "38px",
    color: "#ffffff",
    fontStyle: "bold"
  }).setOrigin(0.5).setDepth(9002);
  const detail = scene.add.text(665, 585, "Preparing shelves, staff and supervisor systems…", {
    fontFamily: "Arial",
    fontSize: "21px",
    color: "#cfe0da"
  }).setOrigin(0.5).setDepth(9002);
  const track = scene.add.rectangle(405, 670, 520, 24, 0x263a3d, 1)
    .setOrigin(0, 0.5)
    .setDepth(9002);
  const bar = scene.add.rectangle(405, 670, 8, 20, 0x8ecf7f, 1)
    .setOrigin(0, 0.5)
    .setName("day3-transition-bar")
    .setDepth(9003);
  const progress = scene.add.text(665, 715, "LOADING 0%", {
    fontFamily: "Arial",
    fontSize: "20px",
    color: "#ffffff",
    fontStyle: "bold"
  }).setName("day3-transition-progress").setOrigin(0.5).setDepth(9002);
  scene.__day3TransitionOverlay = scene.add.container(0, 0, [shade, panel, title, detail, track, bar, progress])
    .setDepth(9000);
}

function updateDay3TransitionOverlay(scene: RuntimeOpening, progress: number): void {
  const value = Phaser.Math.Clamp(progress, 0, 1);
  const bar = scene.__day3TransitionOverlay?.getByName("day3-transition-bar") as Phaser.GameObjects.Rectangle | null;
  const text = scene.__day3TransitionOverlay?.getByName("day3-transition-progress") as Phaser.GameObjects.Text | null;
  bar?.setDisplaySize(Math.max(8, 520 * value), 20);
  text?.setText(`LOADING ${Math.round(value * 100)}%`);
}

function loadMissing(scene: Phaser.Scene, keys: readonly AssetKey[]): void {
  keys.forEach((key) => {
    if (!scene.textures.exists(key)) scene.load.image(key, AssetPaths[key]);
  });
}

function coreGameAssetsReady(scene: Phaser.Scene): boolean {
  return CORE_GAME_ASSETS.every((key) => scene.textures.exists(key));
}

function readActiveDay(): Extract<LevelId, "day01" | "day02" | "day03"> {
  try {
    const stored = globalThis.localStorage?.getItem(ACTIVE_DAY_KEY);
    if (stored === "day03") return "day03";
    if (stored === "day02") return "day02";
  } catch {
    // Fall back to the first shift when storage is unavailable.
  }
  return "day01";
}
