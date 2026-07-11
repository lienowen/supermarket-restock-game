import Phaser from "phaser";
import { AssetPaths, Assets } from "./assets";
import { PRODUCTS } from "./gameConfig";
import { StorefrontScene } from "./scenes/StorefrontScene";
import { gameSession } from "./systems/GameSession";
import { bestStarsFor, totalBestStars } from "./systems/StorefrontProgress";

const HANDLING_UPGRADE_KEY = "supermarket.upgrade.handling";
const SOUND_SETTING_KEY = "supermarket.settings.sound";
const GUIDANCE_SETTING_KEY = "supermarket.settings.guidance";
const ACTIVE_DAY_KEY = "supermarket.activeDay";

type RuntimeStorefront = Phaser.Scene & {
  modal?: Phaser.GameObjects.Container;
  showToast: (message: string) => void;
};

type StorefrontPrototype = {
  preload: () => void;
  showToast: (message: string) => void;
};

const prototype = StorefrontScene.prototype as unknown as StorefrontPrototype;
const originalPreload = prototype.preload;
const originalShowToast = prototype.showToast;

prototype.preload = function preloadStorefrontMenus(): void {
  originalPreload.call(this);
  const scene = this as unknown as Phaser.Scene;
  const keys = [Assets.products.cola, Assets.products.water, Assets.products.milk] as const;
  keys.forEach((key) => {
    const assetKey = key as keyof typeof AssetPaths;
    if (!scene.textures.exists(assetKey)) scene.load.image(assetKey, AssetPaths[assetKey]);
  });
};

prototype.showToast = function openFunctionalStorefrontPanel(message: string): void {
  const scene = this as unknown as RuntimeStorefront;
  if (message.startsWith("UPGRADES")) {
    openUpgrades(scene);
    return;
  }
  if (message.startsWith("STORE")) {
    openStoreStatus(scene);
    return;
  }
  if (message.startsWith("COLLECTION")) {
    openCollection(scene);
    return;
  }
  if (message.startsWith("SETTINGS")) {
    openSettings(scene);
    return;
  }
  originalShowToast.call(this, message);
};

function openUpgrades(scene: RuntimeStorefront): void {
  if (scene.modal?.active) return;
  const level = readNumber(HANDLING_UPGRADE_KEY, 0);
  const maxLevel = 3;
  const costs = [50, 90, 140];
  const nextCost = costs[level] ?? 0;
  const objects = createPanelBase(scene, "EMPLOYEE UPGRADES", "Training upgrades affect the next shift immediately.");

  const card = scene.add.rectangle(665, 590, 720, 280, 0x173238, 1)
    .setStrokeStyle(4, 0x6f9166)
    .setDepth(112);
  const title = scene.add.text(390, 505, "DELIVERY HANDLING", {
    fontFamily: "Arial",
    fontSize: "29px",
    color: "#ffffff",
    fontStyle: "bold"
  }).setDepth(113);
  const levelText = scene.add.text(390, 555, `LEVEL ${level}/${maxLevel}`, {
    fontFamily: "Arial",
    fontSize: "22px",
    color: "#ffd75a",
    fontStyle: "bold"
  }).setDepth(113);
  const effect = scene.add.text(390, 610, [
    `Unload animation speed  +${level * 20}%`,
    "Faster training shortens every delivery-case movement."
  ].join("\n"), {
    fontFamily: "Arial",
    fontSize: "21px",
    color: "#dbe9e4",
    lineSpacing: 10,
    wordWrap: { width: 440 }
  }).setDepth(113);
  const feedback = scene.add.text(665, 770, "", {
    fontFamily: "Arial",
    fontSize: "21px",
    color: "#ffd3a0",
    fontStyle: "bold"
  }).setOrigin(0.5).setDepth(114);

  objects.push(card, title, levelText, effect, feedback);

  if (level >= maxLevel) {
    objects.push(scene.add.text(950, 590, "MAX LEVEL", {
      fontFamily: "Arial",
      fontSize: "25px",
      color: "#d8efaf",
      fontStyle: "bold",
      backgroundColor: "#315f4b",
      padding: { x: 25, y: 16 }
    }).setOrigin(0.5).setDepth(113));
  } else {
    const buyBg = scene.add.rectangle(950, 590, 240, 96, 0x4f8b4c, 1)
      .setStrokeStyle(4, 0xbfe5a6)
      .setDepth(113)
      .setInteractive({ useHandCursor: true });
    const buyText = scene.add.text(950, 590, `TRAIN\n${nextCost} COINS`, {
      fontFamily: "Arial",
      fontSize: "22px",
      color: "#ffffff",
      fontStyle: "bold",
      align: "center"
    }).setOrigin(0.5).setDepth(114);
    const buy = (): void => {
      if (gameSession.coins < nextCost) {
        feedback.setText(`Need ${nextCost - gameSession.coins} more coins.`);
        return;
      }
      gameSession.setCoins(gameSession.coins - nextCost);
      writeValue(HANDLING_UPGRADE_KEY, String(level + 1));
      scene.modal?.destroy(true);
      scene.modal = undefined;
      scene.scene.restart({ showResult: false });
    };
    buyBg.on("pointerdown", buy);
    buyText.setInteractive({ useHandCursor: true }).on("pointerdown", buy);
    objects.push(buyBg, buyText);
  }

  scene.modal = scene.add.container(0, 0, objects).setDepth(100);
}

function openStoreStatus(scene: RuntimeStorefront): void {
  if (scene.modal?.active) return;
  const activeDay = readValue(ACTIVE_DAY_KEY, "day01");
  const stars = totalBestStars();
  const objects = createPanelBase(scene, "STORE MANAGEMENT", "Departments unlock as employees complete full shifts.");

  const rows = [
    { name: "BACKROOM", status: "OPEN", color: "#8fd09a" },
    { name: "DRINKS AISLE", status: "OPEN", color: "#8fd09a" },
    {
      name: "PROMOTION WING",
      status: activeDay === "day02" || bestStarsFor("day01") > 0 ? "OPEN" : "COMPLETE DAY 1",
      color: activeDay === "day02" || bestStarsFor("day01") > 0 ? "#8fd09a" : "#f0ca78"
    },
    { name: "CUSTOMER SERVICE", status: "DAY 3", color: "#9fb2b7" },
    { name: "FRESH FOOD", status: "LOCKED", color: "#9fb2b7" }
  ];

  rows.forEach((row, index) => {
    const y = 430 + index * 92;
    const background = scene.add.rectangle(665, y, 760, 72, 0x173238, 1)
      .setStrokeStyle(2, 0x4c686e)
      .setDepth(112);
    const name = scene.add.text(330, y, row.name, {
      fontFamily: "Arial",
      fontSize: "24px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setOrigin(0, 0.5).setDepth(113);
    const status = scene.add.text(1000, y, row.status, {
      fontFamily: "Arial",
      fontSize: "21px",
      color: row.color,
      fontStyle: "bold"
    }).setOrigin(1, 0.5).setDepth(113);
    objects.push(background, name, status);
  });

  objects.push(scene.add.text(665, 895, `STORE PROGRESS · ${stars} BEST STARS`, {
    fontFamily: "Arial",
    fontSize: "23px",
    color: "#f7e8a9",
    fontStyle: "bold"
  }).setOrigin(0.5).setDepth(113));

  scene.modal = scene.add.container(0, 0, objects).setDepth(100);
}

function openCollection(scene: RuntimeStorefront): void {
  if (scene.modal?.active) return;
  const objects = createPanelBase(scene, "PRODUCT COLLECTION", "Products already handled during completed and available shifts.");
  const products = [
    { id: "cola" as const, key: Assets.products.cola, x: 430 },
    { id: "water" as const, key: Assets.products.water, x: 665 },
    { id: "milk" as const, key: Assets.products.milk, x: 900 }
  ];

  products.forEach(({ id, key, x }) => {
    const card = scene.add.rectangle(x, 590, 205, 360, 0x173238, 1)
      .setStrokeStyle(4, 0x66848a)
      .setDepth(112);
    const image = scene.add.image(x, 570, key).setOrigin(0.5, 1).setDepth(113);
    fitImage(image, 95, 190);
    const name = scene.add.text(x, 660, PRODUCTS[id].label, {
      fontFamily: "Arial",
      fontSize: "25px",
      color: "#ffffff",
      fontStyle: "bold"
    }).setOrigin(0.5).setDepth(113);
    const price = scene.add.text(x, 710, `SELL ${PRODUCTS[id].price} COINS`, {
      fontFamily: "Arial",
      fontSize: "17px",
      color: "#ffd75a",
      fontStyle: "bold"
    }).setOrigin(0.5).setDepth(113);
    objects.push(card, image, name, price);
  });

  objects.push(scene.add.text(665, 845, "3/3 CORE PRODUCTS DISCOVERED", {
    fontFamily: "Arial",
    fontSize: "23px",
    color: "#9fe09f",
    fontStyle: "bold"
  }).setOrigin(0.5).setDepth(113));
  scene.modal = scene.add.container(0, 0, objects).setDepth(100);
}

function openSettings(scene: RuntimeStorefront): void {
  if (scene.modal?.active) return;
  let soundEnabled = readValue(SOUND_SETTING_KEY, "on") !== "off";
  let guidanceEnabled = readValue(GUIDANCE_SETTING_KEY, "on") !== "off";
  const objects = createPanelBase(scene, "SETTINGS", "Settings are saved in this browser.");

  const soundButton = createToggle(scene, 665, 465, "SOUND", soundEnabled, (enabled) => {
    soundEnabled = enabled;
    writeValue(SOUND_SETTING_KEY, enabled ? "on" : "off");
  });
  const guideButton = createToggle(scene, 665, 575, "STEP GUIDANCE", guidanceEnabled, (enabled) => {
    guidanceEnabled = enabled;
    writeValue(GUIDANCE_SETTING_KEY, enabled ? "on" : "off");
  });

  const resetBackground = scene.add.rectangle(665, 745, 430, 82, 0x7a3b32, 1)
    .setStrokeStyle(4, 0xd58a7e)
    .setDepth(113)
    .setInteractive({ useHandCursor: true });
  const resetText = scene.add.text(665, 745, "RESET ALL PROGRESS", {
    fontFamily: "Arial",
    fontSize: "24px",
    color: "#ffffff",
    fontStyle: "bold"
  }).setOrigin(0.5).setDepth(114);
  const warning = scene.add.text(665, 825, "", {
    fontFamily: "Arial",
    fontSize: "20px",
    color: "#ffd3c8",
    fontStyle: "bold"
  }).setOrigin(0.5).setDepth(114);

  let resetArmed = false;
  const reset = (): void => {
    if (!resetArmed) {
      resetArmed = true;
      warning.setText("Tap RESET again to confirm.");
      scene.time.delayedCall(3500, () => {
        resetArmed = false;
        if (warning.active) warning.setText("");
      });
      return;
    }
    clearProgress();
    globalThis.location?.reload();
  };
  resetBackground.on("pointerdown", reset);
  resetText.setInteractive({ useHandCursor: true }).on("pointerdown", reset);

  objects.push(soundButton, guideButton, resetBackground, resetText, warning);
  scene.modal = scene.add.container(0, 0, objects).setDepth(100);
}

function createPanelBase(scene: RuntimeStorefront, titleText: string, subtitleText: string): Phaser.GameObjects.GameObject[] {
  const shade = scene.add.rectangle(665, 591, 1330, 1182, 0x061012, 0.82)
    .setInteractive()
    .setDepth(100);
  const panel = scene.add.rectangle(665, 590, 980, 850, 0x10252a, 0.99)
    .setStrokeStyle(7, 0x78a465)
    .setDepth(101);
  const title = scene.add.text(665, 235, titleText, {
    fontFamily: "Arial",
    fontSize: "40px",
    color: "#ffffff",
    fontStyle: "bold"
  }).setOrigin(0.5).setDepth(102);
  const subtitle = scene.add.text(665, 295, subtitleText, {
    fontFamily: "Arial",
    fontSize: "21px",
    color: "#cfe0da",
    align: "center",
    wordWrap: { width: 820 }
  }).setOrigin(0.5).setDepth(102);
  const closeBg = scene.add.rectangle(665, 955, 260, 72, 0x34454a, 1)
    .setDepth(115)
    .setInteractive({ useHandCursor: true });
  const closeText = scene.add.text(665, 955, "CLOSE", {
    fontFamily: "Arial",
    fontSize: "24px",
    color: "#ffffff",
    fontStyle: "bold"
  }).setOrigin(0.5).setDepth(116);
  const close = (): void => {
    scene.modal?.destroy(true);
    scene.modal = undefined;
  };
  closeBg.on("pointerdown", close);
  closeText.setInteractive({ useHandCursor: true }).on("pointerdown", close);
  return [shade, panel, title, subtitle, closeBg, closeText];
}

function createToggle(
  scene: RuntimeStorefront,
  x: number,
  y: number,
  label: string,
  initialValue: boolean,
  onChange: (enabled: boolean) => void
): Phaser.GameObjects.Container {
  let enabled = initialValue;
  const background = scene.add.rectangle(0, 0, 680, 82, 0x173238, 1)
    .setStrokeStyle(3, 0x5d797f)
    .setInteractive({ useHandCursor: true });
  const name = scene.add.text(-295, 0, label, {
    fontFamily: "Arial",
    fontSize: "24px",
    color: "#ffffff",
    fontStyle: "bold"
  }).setOrigin(0, 0.5);
  const value = scene.add.text(285, 0, enabled ? "ON" : "OFF", {
    fontFamily: "Arial",
    fontSize: "22px",
    color: enabled ? "#9fe09f" : "#e09f9f",
    fontStyle: "bold"
  }).setOrigin(1, 0.5);
  const toggle = scene.add.container(x, y, [background, name, value]).setDepth(113);
  background.on("pointerdown", () => {
    enabled = !enabled;
    value.setText(enabled ? "ON" : "OFF").setColor(enabled ? "#9fe09f" : "#e09f9f");
    onChange(enabled);
  });
  return toggle;
}

function fitImage(image: Phaser.GameObjects.Image, maxWidth: number, maxHeight: number): void {
  const width = Math.max(1, image.width);
  const height = Math.max(1, image.height);
  image.setScale(Math.min(maxWidth / width, maxHeight / height));
}

function clearProgress(): void {
  const keys = [
    "supermarket.walletCoins",
    "supermarket.lastShiftResult",
    "supermarket.bestStars",
    "supermarket.activeDay",
    "supermarket.deliveryReady",
    HANDLING_UPGRADE_KEY,
    SOUND_SETTING_KEY,
    GUIDANCE_SETTING_KEY
  ];
  try {
    keys.forEach((key) => globalThis.localStorage?.removeItem(key));
  } catch {
    // A reload still resets the current in-memory run when storage is unavailable.
  }
}

function readValue(key: string, fallback: string): string {
  try {
    return globalThis.localStorage?.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function readNumber(key: string, fallback: number): number {
  const value = Number(readValue(key, String(fallback)));
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback;
}

function writeValue(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    // Settings remain optional when storage is unavailable.
  }
}
