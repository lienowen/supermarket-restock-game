import Phaser from "phaser";
import { Assets } from "./assets";
import { GameScene } from "./scenes/GameScene";
import { ProductionAssets } from "./supermarketProductionAssets";
import { gameSession } from "./systems/GameSession";

type GamePrototype = {
  create: (...args: unknown[]) => void;
};

type VisibleGameObject = Phaser.GameObjects.GameObject & {
  setVisible: (visible: boolean) => unknown;
};

type RuntimeBox = {
  positionIndex: number;
  image: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
  homeX: number;
  homeY: number;
  loaded: boolean;
};

type RuntimeSlot = {
  index: number;
  hitArea: Phaser.GameObjects.Rectangle;
  missingTag: Phaser.GameObjects.Image;
  typeLabel: Phaser.GameObjects.Text;
  productBottomY: number;
  product?: Phaser.GameObjects.Image;
  reservedForCustomer: boolean;
};

type RuntimeGame = Phaser.Scene & {
  boxes?: RuntimeBox[];
  shelfSlots?: RuntimeSlot[];
  guideGraphics?: Phaser.GameObjects.Graphics;
  guideLabelBg?: Phaser.GameObjects.Rectangle;
  guideLabel?: Phaser.GameObjects.Text;
  hintText?: Phaser.GameObjects.Text;
  cart?: Phaser.GameObjects.Container;
  phase?: string;
  shiftEnded?: boolean;
  __dayOneVisualReset?: DayOneVisualReset;
};

type DayOneVisualReset = {
  layer: Phaser.GameObjects.Container;
  monitor: () => void;
  destroyed: boolean;
  destroy: () => void;
};

const BOX_LAYOUT = [
  { x: 175, y: 620 },
  { x: 325, y: 620 },
  { x: 175, y: 785 },
  { x: 325, y: 785 },
  { x: 175, y: 950 },
  { x: 325, y: 950 }
] as const;

const SLOT_LAYOUT = [
  { x: 955, y: 515, bottomY: 590 },
  { x: 1080, y: 515, bottomY: 590 },
  { x: 1205, y: 515, bottomY: 590 },
  { x: 955, y: 690, bottomY: 770 },
  { x: 1080, y: 690, bottomY: 770 },
  { x: 1205, y: 690, bottomY: 770 }
] as const;

installDayOneVisualReset();

function installDayOneVisualReset(): void {
  const prototype = GameScene.prototype as unknown as GamePrototype;
  const originalCreate = prototype.create;

  prototype.create = function createWithDayOneVisualReset(...args: unknown[]): void {
    originalCreate.apply(this, args);
    const scene = this as unknown as RuntimeGame;
    scene.time.delayedCall(340, () => installVisualReset(scene));
  };
}

function installVisualReset(scene: RuntimeGame): void {
  scene.__dayOneVisualReset?.destroy();
  if (gameSession.day !== "day01" || !scene.scene.isActive()) return;

  hideCompetingLayers(scene);
  reframeStoreFixtures(scene);
  arrangeStockBoxes(scene);
  arrangeRestockSlots(scene);
  disableLegacyGuides(scene);

  const layer = scene.add.container(0, 0)
    .setDepth(9)
    .setName("day1-clean-composition");
  layer.add([
    createSectionSign(scene, 250, 245, "STOCK"),
    createSectionSign(scene, 1080, 245, "RESTOCK AISLE")
  ]);

  const reset: DayOneVisualReset = {
    layer,
    monitor: () => undefined,
    destroyed: false,
    destroy: () => undefined
  };

  let lastMonitorAt = -1000;
  const monitor = (): void => {
    if (reset.destroyed || !scene.scene.isActive()) return;
    if (scene.time.now - lastMonitorAt < 90) return;
    lastMonitorAt = scene.time.now;

    hideCompetingLayers(scene);
    disableLegacyGuides(scene);
    arrangeStockBoxes(scene);
    arrangeRestockSlots(scene);
    simplifyEmptyShelfState(scene);
    keepPreparationFloorQuiet(scene);
    tuneRestockGuide(scene);
  };

  const destroy = (): void => {
    if (reset.destroyed) return;
    reset.destroyed = true;
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, monitor);
    if (layer.active) layer.destroy(true);
    if (scene.__dayOneVisualReset === reset) scene.__dayOneVisualReset = undefined;
  };

  reset.monitor = monitor;
  reset.destroy = destroy;
  scene.__dayOneVisualReset = reset;
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, monitor);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, destroy);
  monitor();

  document.body.dataset.dayOneVisualReset = "ready";
}

function hideCompetingLayers(scene: Phaser.Scene): void {
  [
    "day1-department-polish-world",
    "day1-zone-world",
    "immersion-room-sign-bg",
    "immersion-room-sign"
  ].forEach((name) => findNamedObject<VisibleGameObject>(scene, name)?.setVisible(false));

  hideContainerContainingText(scene, "STOCK CAGE");
  hideContainerContainingText(scene, "AISLE 4 · DRINKS & DAIRY");

  for (const child of scene.children.list) {
    if (child instanceof Phaser.GameObjects.Image && child.texture.key === Assets.ui.stepCard) {
      child.setVisible(false).disableInteractive();
    }
  }
}

function reframeStoreFixtures(scene: Phaser.Scene): void {
  const rack = findTextureImage(scene, ProductionAssets.fixtures.rackBackroomFull);
  rack?.setPosition(250, 1010).setOrigin(0.5, 1).setDisplaySize(360, 550).setDepth(3.4);

  const coldCase = findTextureImage(scene, ProductionAssets.fixtures.frozenLow);
  coldCase?.setPosition(1080, 1010).setOrigin(0.5, 1).setDisplaySize(430, 585).setDepth(3.4);

  const produce = findTextureImage(scene, ProductionAssets.fixtures.produceFull);
  produce?.setPosition(665, 1015).setOrigin(0.5, 1).setDisplaySize(300, 210).setDepth(3.2).setVisible(true);

  const leftForeground = findTextureImage(scene, ProductionAssets.foreground.aisleLeft);
  leftForeground?.setPosition(0, 1015).setOrigin(0, 1).setDisplaySize(150, 500).setAlpha(0.68).setDepth(6);

  const rightForeground = findTextureImage(scene, ProductionAssets.foreground.aisleRight);
  rightForeground?.setPosition(1330, 1015).setOrigin(1, 1).setDisplaySize(150, 500).setAlpha(0.68).setDepth(6);
}

function arrangeStockBoxes(scene: RuntimeGame): void {
  for (const box of scene.boxes ?? []) {
    if (box.loaded || box.image.getData("day1CleanPositioned")) continue;
    const position = BOX_LAYOUT[box.positionIndex] ?? BOX_LAYOUT[0];
    box.homeX = position.x;
    box.homeY = position.y;
    box.image.setPosition(position.x, position.y);
    fitImage(box.image, 100, 96);
    box.shadow.setPosition(position.x, position.y + 4).setDisplaySize(70, 14).setAlpha(0.2);
    box.image.setData("day1CleanPositioned", true);
  }
}

function arrangeRestockSlots(scene: RuntimeGame): void {
  for (const slot of scene.shelfSlots ?? []) {
    const position = SLOT_LAYOUT[slot.index];
    if (!position) continue;

    slot.hitArea.setPosition(position.x, position.y).setDisplaySize(96, 122);
    slot.missingTag.setPosition(position.x, position.y + 24).setDisplaySize(78, 32);
    slot.typeLabel.setPosition(position.x, position.y - 46).setVisible(false);
    slot.productBottomY = position.bottomY;

    if (slot.product?.active && !slot.product.getData("day1CleanProduct")) {
      slot.product.setPosition(position.x, position.bottomY);
      slot.product.setData("day1CleanProduct", true);
    }
  }
}

function simplifyEmptyShelfState(scene: RuntimeGame): void {
  const missing = (scene.shelfSlots ?? []).filter((slot) => !slot.product && !slot.reservedForCustomer);
  const target = missing[0];

  for (const slot of scene.shelfSlots ?? []) {
    const isTarget = slot === target;
    slot.missingTag.setVisible(Boolean(!slot.product && isTarget)).setAlpha(isTarget ? 0.9 : 0);
    slot.typeLabel.setVisible(false);
  }
}

function disableLegacyGuides(scene: RuntimeGame): void {
  scene.guideGraphics?.setVisible(false);
  scene.guideLabelBg?.setVisible(false);
  scene.guideLabel?.setVisible(false);
  scene.hintText?.setVisible(false);
}

function keepPreparationFloorQuiet(scene: RuntimeGame): void {
  const showShoppers = scene.phase !== "PREPARE" && !scene.shiftEnded;
  for (const child of scene.children.list) {
    if (child.name !== "immersion-floor-shopper" && child.name !== "immersion-actor-shadow") continue;
    const display = child as Phaser.GameObjects.GameObject & {
      setVisible?: (visible: boolean) => unknown;
    };
    display.setVisible?.(showShoppers);
  }
}

function tuneRestockGuide(scene: Phaser.Scene): void {
  const guideBg = findNamedObject<Phaser.GameObjects.Rectangle>(scene, "day1-guide-bg");
  const guideBadge = findNamedObject<Phaser.GameObjects.Text>(scene, "day1-guide-badge");
  const guideText = findNamedObject<Phaser.GameObjects.Text>(scene, "day1-guide-text");
  guideBg?.setPosition(665, 1070).setDisplaySize(650, 62).setFillStyle(0x071416, 0.88);
  guideBadge?.setPosition(390, 1070).setFontSize(13);
  guideText?.setPosition(700, 1070).setFontSize(16).setWordWrapWidth(520);

  const targetGlow = findNamedObject<Phaser.GameObjects.Rectangle>(scene, "day1-target-glow");
  const targetArrow = findNamedObject<Phaser.GameObjects.Text>(scene, "day1-target-arrow");
  const targetLabelBg = findNamedObject<Phaser.GameObjects.Rectangle>(scene, "day1-target-label-bg");
  const targetLabel = findNamedObject<Phaser.GameObjects.Text>(scene, "day1-target-label");
  if (!targetGlow?.visible) return;

  targetGlow.setDisplaySize(96, 122).setFillStyle(0xffdf67, 0.025).setStrokeStyle(3, 0xffdf67, 0.88);
  targetArrow?.setPosition(targetGlow.x, targetGlow.y - 82).setFontSize(24);
  targetLabelBg?.setPosition(targetGlow.x, targetGlow.y - 58).setDisplaySize(146, 28);
  targetLabel?.setPosition(targetGlow.x, targetGlow.y - 58).setFontSize(11);
}

function createSectionSign(scene: Phaser.Scene, x: number, y: number, label: string): Phaser.GameObjects.Container {
  const background = scene.add.rectangle(0, 0, 176, 34, 0x102426, 0.86)
    .setStrokeStyle(1, 0x8bad91, 0.65);
  const text = scene.add.text(0, 0, label, {
    fontFamily: "Arial",
    fontSize: "13px",
    color: "#ffffff",
    fontStyle: "bold",
    letterSpacing: 1
  }).setOrigin(0.5);
  return scene.add.container(x, y, [background, text]);
}

function hideContainerContainingText(scene: Phaser.Scene, text: string): void {
  for (const child of scene.children.list) {
    if (!(child instanceof Phaser.GameObjects.Container)) continue;
    if (!containerContainsText(child, text)) continue;
    child.setVisible(false).disableInteractive();
  }
}

function containerContainsText(container: Phaser.GameObjects.Container, text: string): boolean {
  for (const child of container.list) {
    if (child instanceof Phaser.GameObjects.Text && child.text === text) return true;
    if (child instanceof Phaser.GameObjects.Container && containerContainsText(child, text)) return true;
  }
  return false;
}

function findTextureImage(scene: Phaser.Scene, texture: string): Phaser.GameObjects.Image | undefined {
  return scene.children.list.find(
    (child): child is Phaser.GameObjects.Image =>
      child instanceof Phaser.GameObjects.Image && child.texture.key === texture
  );
}

function findNamedObject<T extends Phaser.GameObjects.GameObject>(scene: Phaser.Scene, name: string): T | undefined {
  for (const child of scene.children.list) {
    const found = findInObjectTree<T>(child, name);
    if (found) return found;
  }
  return undefined;
}

function findInObjectTree<T extends Phaser.GameObjects.GameObject>(
  object: Phaser.GameObjects.GameObject,
  name: string
): T | undefined {
  if (object.name === name) return object as T;
  if (!(object instanceof Phaser.GameObjects.Container)) return undefined;
  for (const child of object.list) {
    const found = findInObjectTree<T>(child, name);
    if (found) return found;
  }
  return undefined;
}

function fitImage(image: Phaser.GameObjects.Image, maxWidth: number, maxHeight: number): void {
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
  image.setScale(scale);
}
