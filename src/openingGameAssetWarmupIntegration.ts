import Phaser from "phaser";
import { AssetPaths, Assets } from "./assets";
import { OpeningScene } from "./scenes/OpeningScene";

const DELIVERY_READY_KEY = "supermarket.deliveryReady";
const ACTIVE_DAY_KEY = "supermarket.activeDay";
const WARMUP_TIMEOUT_MS = 12000;

const GAME_CORE_ASSETS = [
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
] as const;

type WarmOpeningScene = Phaser.Scene & {
  finishOpening: () => void;
  __gameWarmupReady?: boolean;
  __gameWarmupFinishPending?: boolean;
  __gameWarmupOverlay?: Phaser.GameObjects.Container;
};

type OpeningPrototype = {
  create: (...args: unknown[]) => void;
  finishOpening: () => void;
};

const prototype = OpeningScene.prototype as unknown as OpeningPrototype;
const originalCreate = prototype.create;
const originalFinishOpening = prototype.finishOpening;

prototype.create = function createWithGameAssetWarmup(...args: unknown[]): void {
  originalCreate.apply(this, args);
  const scene = this as unknown as WarmOpeningScene;
  warmGameAssets(scene);
};

prototype.finishOpening = function finishAfterWarmup(): void {
  const scene = this as unknown as WarmOpeningScene;

  // Preserve the existing delivery gate. Automatic opening timers call this
  // method before receiving is complete and must remain harmless.
  if (!receivingIsComplete(scene)) {
    originalFinishOpening.call(this);
    return;
  }

  if (scene.__gameWarmupReady) {
    originalFinishOpening.call(this);
    return;
  }

  if (scene.__gameWarmupFinishPending) return;
  scene.__gameWarmupFinishPending = true;
  showWarmupOverlay(scene);

  let completed = false;
  const continueToGame = (): void => {
    if (completed) return;
    completed = true;
    scene.__gameWarmupReady = true;
    scene.__gameWarmupFinishPending = false;
    scene.__gameWarmupOverlay?.destroy(true);
    scene.__gameWarmupOverlay = undefined;

    if (scene.scene.isActive()) originalFinishOpening.call(this);
  };

  scene.load.once(Phaser.Loader.Events.COMPLETE, continueToGame);
  window.setTimeout(continueToGame, WARMUP_TIMEOUT_MS);
};

function warmGameAssets(scene: WarmOpeningScene): void {
  let queued = 0;

  GAME_CORE_ASSETS.forEach((key) => {
    if (scene.textures.exists(key)) return;
    scene.load.image(key, AssetPaths[key]);
    queued += 1;
  });

  if (queued === 0) {
    scene.__gameWarmupReady = true;
    document.body.dataset.gameAssetWarmup = "ready";
    return;
  }

  scene.__gameWarmupReady = false;
  document.body.dataset.gameAssetWarmup = "loading";

  scene.load.once(Phaser.Loader.Events.COMPLETE, () => {
    scene.__gameWarmupReady = true;
    document.body.dataset.gameAssetWarmup = "ready";
  });

  scene.load.start();
}

function showWarmupOverlay(scene: WarmOpeningScene): void {
  if (scene.__gameWarmupOverlay?.active) return;

  const blocker = scene.add.rectangle(665, 591, 1330, 1182, 0x071315, 0.44)
    .setInteractive();
  const panel = scene.add.rectangle(665, 592, 690, 190, 0x10282a, 0.98)
    .setStrokeStyle(5, 0xffd75a);
  const title = scene.add.text(665, 555, "PREPARING BACKROOM", {
    fontFamily: "Arial",
    fontSize: "34px",
    color: "#ffffff",
    fontStyle: "bold"
  }).setOrigin(0.5);
  const message = scene.add.text(665, 625, "Loading the store while keeping this screen visible…", {
    fontFamily: "Arial",
    fontSize: "21px",
    color: "#dce9e4"
  }).setOrigin(0.5);

  scene.__gameWarmupOverlay = scene.add.container(0, 0, [blocker, panel, title, message])
    .setDepth(10000);
}

function receivingIsComplete(scene: Phaser.Scene): boolean {
  try {
    const day = globalThis.localStorage?.getItem(ACTIVE_DAY_KEY) ?? "day01";
    if (globalThis.localStorage?.getItem(DELIVERY_READY_KEY) === day) return true;
  } catch {
    // Fall through to the visible scene-state check.
  }

  return scene.children.list.some((child) =>
    child instanceof Phaser.GameObjects.Text && child.text.includes("STOCK IS IN THE BACKROOM")
  );
}
