import Phaser from "phaser";
import { PRODUCTS, type ProductId } from "./gameConfig";
import { GameScene } from "./scenes/GameScene";
import { gameSession } from "./systems/GameSession";

type RuntimeBox = {
  positionIndex: number;
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
  productBottomY: number;
  product?: Phaser.GameObjects.Image;
};

type RuntimeGameScene = Phaser.Scene & {
  boxes: RuntimeBox[];
  shelfSlots: RuntimeSlot[];
  stocked: number;
  phase: "PREPARE" | "OPEN" | "RUSH" | "CLOSING" | "RESULT";
  fitImage: (image: Phaser.GameObjects.Image, maxWidth: number, maxHeight: number) => void;
  showTransientHint: (message: string) => void;
  updateHud: () => void;
  __dayOneHookActive?: boolean;
};

type GamePrototype = {
  create: () => void;
  departureRequirement: () => number;
  openStore: () => void;
};

const prototype = GameScene.prototype as unknown as GamePrototype;
const originalCreate = prototype.create;
const originalDepartureRequirement = prototype.departureRequirement;
const originalOpenStore = prototype.openStore;

prototype.create = function createWithDayOneHook(): void {
  originalCreate.call(this);
  const scene = this as unknown as RuntimeGameScene;
  if (gameSession.day !== "day01" || scene.phase !== "PREPARE") return;

  scene.__dayOneHookActive = true;
  seedFiveShelfProducts(scene);
  focusFirstColaCase(scene);
  scene.updateHud();

  scene.time.delayedCall(280, () => {
    if (!scene.scene.isActive() || scene.phase !== "PREPARE") return;
    scene.showTransientHint("FIRST TASK · Load the highlighted COLA case, move the cart, and fill one shelf gap.");
  });
};

prototype.departureRequirement = function dayOneFirstTripRequirement(): number {
  const scene = this as unknown as RuntimeGameScene;
  if (gameSession.day === "day01" && scene.__dayOneHookActive && scene.phase === "PREPARE") {
    return 1;
  }
  return originalDepartureRequirement.call(this);
};

prototype.openStore = function openAfterFirstFastWin(): void {
  const scene = this as unknown as RuntimeGameScene;
  const completingHook = gameSession.day === "day01" && Boolean(scene.__dayOneHookActive);

  if (completingHook) removeTutorialCases(scene);
  originalOpenStore.call(this);

  if (!completingHook) return;
  scene.__dayOneHookActive = false;
  scene.showTransientHint("Great start! The store is open. Keep shelves filled as customers create new gaps.");
};

function seedFiveShelfProducts(scene: RuntimeGameScene): void {
  if (scene.stocked > 0 || scene.shelfSlots.length < 6) return;

  const firstTarget = scene.shelfSlots[0];
  for (const slot of scene.shelfSlots) {
    if (slot === firstTarget || slot.product) continue;
    const definition = PRODUCTS[slot.productId];
    const product = scene.add.image(slot.hitArea.x, slot.productBottomY, definition.productKey)
      .setOrigin(0.5, 1)
      .setDepth(22);
    scene.fitImage(product, definition.shelfWidth, definition.shelfHeight);
    slot.product = product;
    slot.missingTag.setVisible(false);
    scene.stocked += 1;
  }

  firstTarget.missingTag
    .setVisible(true)
    .setTint(0xffd75a)
    .setDepth(45);
  const baseX = firstTarget.missingTag.scaleX;
  const baseY = firstTarget.missingTag.scaleY;
  scene.tweens.add({
    targets: firstTarget.missingTag,
    scaleX: baseX * 1.08,
    scaleY: baseY * 1.08,
    duration: 240,
    yoyo: true,
    repeat: 3,
    ease: "Sine.InOut",
    onComplete: () => firstTarget.missingTag.clearTint().setScale(baseX, baseY)
  });
}

function focusFirstColaCase(scene: RuntimeGameScene): void {
  const firstCase = scene.boxes.find((item) => item.positionIndex === 0 && item.productId === "cola");
  for (const item of scene.boxes) {
    const active = item === firstCase;
    item.image.setData("dayOneLocked", !active);
    if (active) {
      item.image.setVisible(true).setAlpha(1).setTint(0xfff1a8);
      item.shadow.setVisible(true);
      continue;
    }

    item.image.disableInteractive().setVisible(false);
    item.shadow.setVisible(false);
  }
}

function removeTutorialCases(scene: RuntimeGameScene): void {
  const retained: RuntimeBox[] = [];
  for (const item of scene.boxes) {
    if (!item.image.getData("dayOneLocked")) {
      retained.push(item);
      continue;
    }

    item.image.destroy();
    if (item.shadow.active) item.shadow.destroy();
  }
  scene.boxes = retained;
}
