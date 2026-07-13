import Phaser from "phaser";
import { AssetPaths, Assets, type AssetKey } from "./assets";
import type { LevelId } from "./domain/gameTypes";
import { OpeningScene } from "./scenes/OpeningScene";

const ACTIVE_DAY_KEY = "supermarket.activeDay";
const DELIVERY_READY_KEY = "supermarket.deliveryReady";
const AUXILIARY_SCENES = ["polish-overlay", "progression-customer", "back-stock"] as const;

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

type RuntimeOpening = Phaser.Scene & {
  finished: boolean;
  __day3TransitionPending?: boolean;
  __day3TransitionOverlay?: Phaser.GameObjects.Container;
};

type OpeningPrototype = {
  preload: () => void;
  finishOpening: () => void;
};

installOpeningReliability();

function installOpeningReliability(): void {
  const prototype = OpeningScene.prototype as unknown as OpeningPrototype;
  const originalPreload = prototype.preload;
  const originalFinish = prototype.finishOpening;

  prototype.preload = function preloadDay3GameBeforeReceiving(): void {
    originalPreload.call(this);
    if (readActiveDay() === "day03") {
      loadMissing(this as unknown as Phaser.Scene, CORE_GAME_ASSETS);
    }
  };

  prototype.finishOpening = function finishDay3WithoutBlackScreen(): void {
    const scene = this as unknown as RuntimeOpening;

    if (readActiveDay() !== "day03") {
      originalFinish.call(this);
      return;
    }

    // Do not bypass the receiving gate. This method is also called by older
    // integrations before the player has actually moved the stock inside.
    if (!day3DeliveryReady(scene)) {
      originalFinish.call(this);
      return;
    }

    if (scene.__day3TransitionPending || scene.finished) return;
    scene.__day3TransitionPending = true;
    scene.input.enabled = false;
    showDay3TransitionOverlay(scene);

    if (coreGameAssetsReady(scene)) {
      enterDay3Game(scene);
      return;
    }

    const missing = CORE_GAME_ASSETS.filter((key) => !scene.textures.exists(key));
    loadMissing(scene, missing);

    const onProgress = (progress: number): void => updateDay3TransitionOverlay(scene, progress);
    const onComplete = (): void => {
      scene.load.off("progress", onProgress);
      enterDay3Game(scene);
    };

    scene.load.on("progress", onProgress);
    scene.load.once("complete", onComplete);
    scene.load.start();
  };
}

function enterDay3Game(scene: RuntimeOpening): void {
  if (!scene.scene.isActive()) return;
  scene.finished = true;
  updateDay3TransitionOverlay(scene, 1);

  try {
    globalThis.localStorage?.removeItem(DELIVERY_READY_KEY);
  } catch {
    // The active GameSession still contains the current day.
  }

  scene.time.delayedCall(140, () => {
    if (!scene.scene.isActive()) return;
    AUXILIARY_SCENES.forEach((key) => {
      if (!scene.scene.isActive(key)) scene.scene.launch(key);
    });
    scene.scene.start("game");
  });
}

function day3DeliveryReady(scene: Phaser.Scene): boolean {
  try {
    if (globalThis.localStorage?.getItem(DELIVERY_READY_KEY) === "day03") return true;
  } catch {
    // Fall back to the visible completion message.
  }

  return scene.children.list.some((child) =>
    child instanceof Phaser.GameObjects.Text &&
    child.text.includes("STOCK IS IN THE BACKROOM")
  );
}

function showDay3TransitionOverlay(scene: RuntimeOpening): void {
  scene.__day3TransitionOverlay?.destroy(true);

  const shade = scene.add.rectangle(665, 591, 1330, 1182, 0x071012, 0.88)
    .setDepth(9000)
    .setInteractive();
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
