import Phaser from "phaser";
import { Assets } from "./assets";
import { GameScene } from "./scenes/GameScene";
import { ProgressionCustomerScene } from "./scenes/ProgressionCustomerScene";
import { PromotionWingScene } from "./scenes/PromotionWingScene";
import { gameSession } from "./systems/GameSession";

type RuntimeGameScene = Phaser.Scene & {
  hintText?: Phaser.GameObjects.Text;
  hintBubble?: Phaser.GameObjects.Image;
  bubbleText?: Phaser.GameObjects.Text;
  __batchDutyText?: Phaser.GameObjects.Text;
  __batchHintText?: Phaser.GameObjects.Text;
  __finalUiLayoutMonitor?: () => void;
  __compactHintRestore?: Phaser.Time.TimerEvent;
  updateHud: () => void;
};

type RuntimeProgressionScene = Phaser.Scene & {
  dayBanner?: Phaser.GameObjects.Container;
};

type RuntimePromotionWing = Phaser.Scene & {
  flowText?: Phaser.GameObjects.Text;
  stockEntryGlow?: Phaser.GameObjects.Rectangle;
  stockEntryButton?: Phaser.GameObjects.Container;
};

type GamePrototype = {
  create: (...args: unknown[]) => void;
  showTransientHint: (message: string) => void;
};

type ProgressionPrototype = {
  showDayBanner: () => void;
};

type PromotionPrototype = {
  create: (...args: unknown[]) => void;
};

installCompactGameLayout();
installSingleDayBannerPolicy();
installCompactPromotionFlow();

function installCompactGameLayout(): void {
  const prototype = GameScene.prototype as unknown as GamePrototype;
  const originalCreate = prototype.create;
  const originalShowTransientHint = prototype.showTransientHint;

  prototype.showTransientHint = function showCompactTransientHint(message: string): void {
    const scene = this as unknown as RuntimeGameScene;
    if (gameSession.day === "day01" || !scene.hintText?.active) {
      originalShowTransientHint.call(this, message);
      return;
    }

    hideLargeSpeechBubble(scene);
    scene.__compactHintRestore?.remove(false);
    scene.hintText
      .setText(message)
      .setColor("#172020")
      .setFontStyle("bold")
      .setAlpha(1);

    scene.__compactHintRestore = scene.time.delayedCall(1_900, () => {
      if (!scene.scene.isActive()) return;
      scene.__compactHintRestore = undefined;
      scene.hintText?.setColor("#172020");
      scene.updateHud();
    });
  };

  prototype.create = function createWithFinalUiLayout(...args: unknown[]): void {
    originalCreate.apply(this, args);
    const scene = this as unknown as RuntimeGameScene;
    let lastCheck = -Infinity;

    const monitor = (): void => {
      if (scene.time.now - lastCheck < 220) return;
      lastCheck = scene.time.now;
      applyGameLayout(scene);
    };

    scene.__finalUiLayoutMonitor = monitor;
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, monitor);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, monitor);
      scene.__compactHintRestore?.remove(false);
      scene.__compactHintRestore = undefined;
      scene.__finalUiLayoutMonitor = undefined;
      delete document.body.dataset.finalUiLayout;
    });

    monitor();
  };
}

function applyGameLayout(scene: RuntimeGameScene): void {
  const day = gameSession.day;
  if (day === "day01") {
    document.body.dataset.finalUiLayout = "day01";
    return;
  }

  hideLargeSpeechBubble(scene);
  compactBaseHintBar(scene);

  if (day === "day04" || day === "day05") {
    compactBatchHud(scene);
    compactStockDockCopy(scene);
  }

  document.body.dataset.finalUiLayout = String(day);
}

function hideLargeSpeechBubble(scene: RuntimeGameScene): void {
  scene.hintBubble?.setVisible(false).setAlpha(0).disableInteractive();
  scene.bubbleText?.setVisible(false).setAlpha(0).disableInteractive();
}

function compactBaseHintBar(scene: RuntimeGameScene): void {
  const stepCard = scene.children.list.find((child): child is Phaser.GameObjects.Image =>
    child instanceof Phaser.GameObjects.Image &&
    child.texture.key === Assets.ui.stepCard &&
    child.y > 1_000
  );

  stepCard
    ?.setPosition(665, 1_143)
    .setDisplaySize(760, 70)
    .setAlpha(0.94);

  scene.hintText
    ?.setPosition(665, 1_143)
    .setFontSize(18)
    .setColor("#172020")
    .setWordWrapWidth(680)
    .setLineSpacing(0);
}

function compactBatchHud(scene: RuntimeGameScene): void {
  const bottomPanel = scene.children.list.find((child): child is Phaser.GameObjects.Rectangle =>
    child instanceof Phaser.GameObjects.Rectangle &&
    child.depth >= 8_900 &&
    Math.abs(child.x - 665) < 5 &&
    child.y > 1_000 &&
    child.width >= 1_100 &&
    child.height >= 90
  );

  bottomPanel
    ?.setPosition(665, 1_137)
    .setDisplaySize(1_120, 72)
    .setStrokeStyle(3, 0xffd75a, 0.95);

  scene.__batchDutyText
    ?.setPosition(665, 1_121)
    .setFontSize(16)
    .setWordWrapWidth(1_030);

  scene.__batchHintText
    ?.setPosition(665, 1_150)
    .setFontSize(15)
    .setWordWrapWidth(1_030)
    .setText(shortBatchInstruction(scene.__batchHintText.text));
}

function shortBatchInstruction(current: string): string {
  const normalized = current.toUpperCase();
  if (normalized.includes("RED LOW-STOCK")) return "RESTOCK THE RED LOW-STOCK DISPLAY FIRST";
  if (normalized.includes("SALES FLOOR")) return "KEEP LOW-STOCK DISPLAYS FULL WHILE CUSTOMERS SHOP";
  return "LOAD CASES · MOVE CART · TAP A LOW-STOCK DISPLAY";
}

function compactStockDockCopy(scene: RuntimeGameScene): void {
  for (const child of scene.children.list) {
    if (!(child instanceof Phaser.GameObjects.Text)) continue;
    const value = child.text.toUpperCase();

    if (value === "STOCK DOCK") {
      child.setFontSize(23).setPadding(18, 8);
      continue;
    }

    if (value.includes("LOAD CASES") && value.includes("BUILD A ROUTE") && value.includes("BATCH RESTOCK")) {
      child
        .setText("LOAD CASES · BUILD A ROUTE")
        .setFontSize(14)
        .setLineSpacing(0)
        .setPosition(170, 398);
    }
  }
}

function installSingleDayBannerPolicy(): void {
  const prototype = ProgressionCustomerScene.prototype as unknown as ProgressionPrototype;
  const originalShowDayBanner = prototype.showDayBanner;

  prototype.showDayBanner = function showOnlyFirstDayBanner(): void {
    if (gameSession.day === "day01") {
      originalShowDayBanner.call(this);
      return;
    }

    const scene = this as unknown as RuntimeProgressionScene;
    scene.dayBanner?.destroy(true);
    scene.dayBanner = undefined;
  };
}

function installCompactPromotionFlow(): void {
  const prototype = PromotionWingScene.prototype as unknown as PromotionPrototype;
  const originalCreate = prototype.create;

  prototype.create = function createWithCompactPromotionFlow(...args: unknown[]): void {
    originalCreate.apply(this, args);
    const scene = this as unknown as RuntimePromotionWing;

    scene.time.delayedCall(0, () => compactPromotionFlow(scene));
    scene.time.delayedCall(450, () => compactPromotionFlow(scene));
  };
}

function compactPromotionFlow(scene: RuntimePromotionWing): void {
  if (!scene.scene.isActive()) return;

  const flowPanel = scene.children.list.find((child): child is Phaser.GameObjects.Rectangle =>
    child instanceof Phaser.GameObjects.Rectangle &&
    Math.abs(child.x - 665) < 5 &&
    Math.abs(child.y - 335) < 10 &&
    child.width >= 1_000 &&
    child.depth >= 50
  );

  flowPanel
    ?.setPosition(665, 270)
    .setDisplaySize(1_020, 82)
    .setStrokeStyle(2, 0x789d89, 0.8);

  scene.flowText
    ?.setPosition(665, 245)
    .setText("LOAD RESERVE  →  FILL DISPLAY  →  CHECKOUT")
    .setFontSize(16)
    .setLetterSpacing(0);

  scene.stockEntryGlow?.setPosition(245, 292).setDisplaySize(230, 48);
  scene.stockEntryButton?.setPosition(245, 292).setScale(0.9);

  for (const child of scene.children.list) {
    if (!(child instanceof Phaser.GameObjects.Text)) continue;
    const value = child.text.toUpperCase();

    if (child.depth === 56 && (value === "CART" || value === "EMPTY DISPLAY" || value === "CHECKOUT")) {
      child.setY(292).setFontSize(14).setPadding(20, 10);
    }

    if (value === "← MAIN STORE") {
      child.setFontSize(20);
      child.parentContainer?.setPosition(155, 1_085).setScale(0.82);
    }
  }

  document.body.dataset.promotionFlowLayout = "compact";
}
