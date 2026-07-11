import Phaser from "phaser";
import { Assets } from "./assets";
import { GameScene } from "./scenes/GameScene";
import { StorefrontScene } from "./scenes/StorefrontScene";
import { gameSession } from "./systems/GameSession";

type RuntimeGameScene = Phaser.Scene & {
  taskText: Phaser.GameObjects.Text;
  hintText: Phaser.GameObjects.Text;
  starText: Phaser.GameObjects.Text;
  moneyText: Phaser.GameObjects.Text;
  timerText: Phaser.GameObjects.Text;
  phaseBanner: Phaser.GameObjects.Text;
  togglePauseOverlay: () => void;
  showTransientHint: (message: string) => void;
  phaseHelpText: () => string;
  __compactHud?: Phaser.GameObjects.Container;
};

type GamePrototype = {
  create: () => void;
};

type StorefrontPrototype = {
  createImageButton: (
    texture: string,
    x: number,
    y: number,
    width: number,
    height: number,
    action: () => void
  ) => Phaser.GameObjects.Container;
};

const gamePrototype = GameScene.prototype as unknown as GamePrototype;
const originalGameCreate = gamePrototype.create;

gamePrototype.create = function createWithUnifiedHud(): void {
  originalGameCreate.call(this);
  const scene = this as unknown as RuntimeGameScene;
  scene.__compactHud?.destroy(true);

  const day = dayCopy();
  const blocker = scene.add.rectangle(665, 71, 1330, 142, 0x0d1719, 0.985)
    .setStrokeStyle(2, 0x324449, 0.9)
    .setInteractive();

  const dayBadgeBg = scene.add.rectangle(88, 42, 132, 54, day.color, 1)
    .setStrokeStyle(3, 0xffe49a, 0.95);
  const dayBadgeText = scene.add.text(88, 42, day.label, {
    fontFamily: "Arial",
    fontSize: "24px",
    color: "#ffffff",
    fontStyle: "bold",
    letterSpacing: 2
  }).setOrigin(0.5);

  const title = scene.add.text(172, 18, day.title, {
    fontFamily: "Arial",
    fontSize: "27px",
    color: "#ffffff",
    fontStyle: "bold"
  });

  const mode = scene.add.text(172, 49, day.subtitle, {
    fontFamily: "Arial",
    fontSize: "14px",
    color: "#ffd98a",
    fontStyle: "bold",
    letterSpacing: 1
  });

  const helpHit = scene.add.rectangle(0, 0, 610, 126, 0xffffff, 0.001)
    .setOrigin(0, 0)
    .setInteractive({ useHandCursor: true });
  helpHit.on("pointerdown", () => scene.showTransientHint(scene.phaseHelpText()));

  scene.taskText
    .setPosition(172, 76)
    .setFontSize(18)
    .setColor("#cfe1dc")
    .setWordWrapWidth(435)
    .setDepth(60);

  const starChip = createChip(scene, 740, "★", "BEST", 0xffcc3f);
  const coinChip = createChip(scene, 895, "●", "COINS", 0xffd35a);
  const timeChip = createChip(scene, 1055, "◷", "TIME", 0xbfe8f3);

  scene.starText
    .setPosition(766, 49)
    .setOrigin(0, 0.5)
    .setFontSize(27)
    .setDepth(61);
  scene.moneyText
    .setPosition(922, 49)
    .setOrigin(0, 0.5)
    .setFontSize(27)
    .setDepth(61);
  scene.timerText
    .setPosition(1082, 49)
    .setOrigin(0, 0.5)
    .setFontSize(27)
    .setDepth(61);

  const menuBg = scene.add.rectangle(0, 0, 92, 76, 0x26373a, 1)
    .setStrokeStyle(3, 0x70878c)
    .setInteractive({ useHandCursor: true });
  const menuText = scene.add.text(0, -2, "☰", {
    fontFamily: "Arial",
    fontSize: "33px",
    color: "#ffffff",
    fontStyle: "bold"
  }).setOrigin(0.5);
  const menu = scene.add.container(1258, 70, [menuBg, menuText]);
  menuBg.on("pointerover", () => menu.setScale(1.035));
  menuBg.on("pointerout", () => menu.setScale(1));
  menuBg.on("pointerdown", () => {
    menu.setScale(0.97);
    scene.togglePauseOverlay();
  });

  scene.hintText
    .setFontSize(23)
    .setWordWrapWidth(730)
    .setDepth(60);
  scene.phaseBanner.setDepth(76);

  scene.__compactHud = scene.add.container(0, 0, [
    blocker,
    dayBadgeBg,
    dayBadgeText,
    title,
    mode,
    helpHit,
    starChip,
    coinChip,
    timeChip,
    menu
  ]).setDepth(58);

  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.__compactHud?.destroy(true);
    scene.__compactHud = undefined;
  });
};

function dayCopy(): { label: string; title: string; subtitle: string; color: number } {
  if (gameSession.day === "day02") {
    return {
      label: "DAY 2",
      title: "HOT DEAL EXPANSION",
      subtitle: "TWO-ROOM INVENTORY CHALLENGE",
      color: 0x9a531e
    };
  }

  if (gameSession.day === "day03") {
    return {
      label: "DAY 3",
      title: "CUSTOMER SERVICE",
      subtitle: "REQUESTS · WAITING · SUBSTITUTES",
      color: 0x6b438f
    };
  }

  return {
    label: "DAY 1",
    title: "RESTOCK DRINKS",
    subtitle: "FIRST SHIFT · LEARN THE STORE",
    color: 0x3f7f4d
  };
}

function createChip(
  scene: Phaser.Scene,
  x: number,
  symbol: string,
  label: string,
  symbolColor: number
): Phaser.GameObjects.Container {
  const background = scene.add.rectangle(0, 0, 142, 78, 0x1c292c, 1)
    .setStrokeStyle(2, 0x465b60, 0.95);
  const icon = scene.add.text(-50, -3, symbol, {
    fontFamily: "Arial",
    fontSize: "31px",
    color: `#${symbolColor.toString(16).padStart(6, "0")}`,
    fontStyle: "bold"
  }).setOrigin(0.5);
  const labelText = scene.add.text(-2, -23, label, {
    fontFamily: "Arial",
    fontSize: "12px",
    color: "#91a8ad",
    fontStyle: "bold",
    letterSpacing: 1
  }).setOrigin(0, 0.5);
  return scene.add.container(x, 70, [background, icon, labelText]);
}

const storefrontPrototype = StorefrontScene.prototype as unknown as StorefrontPrototype;

storefrontPrototype.createImageButton = function createUnifiedStoreButton(
  texture: string,
  x: number,
  y: number,
  width: number,
  height: number,
  action: () => void
): Phaser.GameObjects.Container {
  const scene = this as unknown as Phaser.Scene;
  const isPrimary = texture === Assets.storefront.startShift;
  const copy = buttonCopy(texture);
  const buttonWidth = isPrimary ? width : Math.min(width, 270);
  const buttonHeight = isPrimary ? 122 : Math.min(height, 92);
  const background = scene.add.rectangle(
    0,
    0,
    buttonWidth,
    buttonHeight,
    isPrimary ? 0x4a9a55 : 0x1b3137,
    0.98
  ).setStrokeStyle(4, isPrimary ? 0xcde98e : 0x789299, 1);
  const icon = scene.add.text(isPrimary ? -175 : -88, 0, copy.icon, {
    fontFamily: "Arial",
    fontSize: isPrimary ? "34px" : "25px",
    color: isPrimary ? "#fff3a7" : "#c9e1e5",
    fontStyle: "bold"
  }).setOrigin(0.5);
  const label = scene.add.text(isPrimary ? 15 : 18, 0, copy.label, {
    fontFamily: "Arial",
    fontSize: isPrimary ? "31px" : "20px",
    color: "#ffffff",
    fontStyle: "bold",
    letterSpacing: isPrimary ? 2 : 1
  }).setOrigin(0.5);
  const hit = scene.add.rectangle(0, 0, buttonWidth + 32, buttonHeight + 24, 0xffffff, 0.001)
    .setInteractive({ useHandCursor: true });
  const container = scene.add.container(x, y, [background, icon, label, hit]).setDepth(15);

  hit.on("pointerover", () => container.setScale(1.025));
  hit.on("pointerout", () => container.setScale(1));
  hit.on("pointerdown", () => {
    container.setScale(0.975);
    action();
  });
  return container;
};

function buttonCopy(texture: string): { icon: string; label: string } {
  if (texture === Assets.storefront.startShift) return { icon: "▶", label: "START SHIFT" };
  if (texture === Assets.storefront.days) return { icon: "01", label: "DAYS" };
  if (texture === Assets.storefront.upgrades) return { icon: "↑", label: "UPGRADES" };
  if (texture === Assets.storefront.store) return { icon: "▦", label: "STORE" };
  if (texture === Assets.storefront.collection) return { icon: "◆", label: "COLLECTION" };
  return { icon: "⚙", label: "SETTINGS" };
}
