import Phaser from "phaser";
import { Assets } from "./assets";
import { GameScene } from "./scenes/GameScene";
import { gameSession } from "./systems/GameSession";

type GamePrototype = {
  create: (...args: unknown[]) => void;
};

type RuntimeRestockImmersion = {
  pulseTween?: Phaser.Tweens.Tween;
  routeLayer?: Phaser.GameObjects.Container;
  targetGlow?: Phaser.GameObjects.Rectangle;
  targetArrow?: Phaser.GameObjects.Text;
  targetFrame?: Phaser.GameObjects.Graphics;
};

type RuntimeGame = Phaser.Scene & {
  __dayOneMotionCleanupInstalled?: boolean;
  __dayOneRestockImmersion?: RuntimeRestockImmersion;
};

type RuntimePolishOverlay = Phaser.Scene & {
  tutorialGraphics?: Phaser.GameObjects.Graphics;
  tutorialBg?: Phaser.GameObjects.Rectangle;
  tutorialText?: Phaser.GameObjects.Text;
  tutorialTween?: Phaser.Tweens.Tween;
  pressureBg?: Phaser.GameObjects.Rectangle;
  pressureText?: Phaser.GameObjects.Text;
  pressureTween?: Phaser.Tweens.Tween;
};

const CUSTOMER_TEXTURES = new Set<string>([
  Assets.characters.customer01Idle,
  Assets.characters.customer01Basket,
  Assets.characters.customer02Idle,
  Assets.characters.customer02Basket,
  Assets.promotion.customerWaiting,
  Assets.promotion.customerService
]);

const prototype = GameScene.prototype as unknown as GamePrototype;
const originalCreate = prototype.create;

prototype.create = function createWithoutDayOneGhosting(...args: unknown[]): void {
  originalCreate.apply(this, args);
  const scene = this as unknown as RuntimeGame;
  scene.time.delayedCall(560, () => installDayOneMotionCleanup(scene));
};

function installDayOneMotionCleanup(scene: RuntimeGame): void {
  if (gameSession.day !== "day01" || !scene.scene.isActive()) return;
  if (scene.__dayOneMotionCleanupInstalled) return;
  scene.__dayOneMotionCleanupInstalled = true;

  let lastCleanupAt = -1000;
  const cleanup = (): void => {
    if (!scene.scene.isActive() || gameSession.day !== "day01") return;
    if (scene.time.now - lastCleanupAt < 100) return;
    lastCleanupAt = scene.time.now;

    for (const activeScene of scene.game.scene.getScenes(true)) {
      removeGhostCustomers(activeScene);
      stopDecorativeLoops(activeScene);
      removeOversizedCartHighlight(activeScene);
    }

    stabilizeRestockTarget(scene);
    disablePolishOverlay(scene);
  };

  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, cleanup);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, cleanup);
    scene.__dayOneMotionCleanupInstalled = false;
  });

  cleanup();
  document.body.dataset.dayOneMotionCleanup = "ready";
}

function removeGhostCustomers(scene: Phaser.Scene): void {
  visitSceneObjects(scene, (object) => {
    if (object.name === "immersion-actor-shadow") {
      scene.tweens.killTweensOf(object);
      object.destroy();
      return;
    }

    if (!(object instanceof Phaser.GameObjects.Image)) return;
    if (!CUSTOMER_TEXTURES.has(object.texture.key)) return;

    scene.tweens.killTweensOf(object);
    object.destroy();
  });
}

function stopDecorativeLoops(scene: Phaser.Scene): void {
  visitSceneObjects(scene, (object) => {
    const name = object.name ?? "";
    const isCeilingLight = name.startsWith("immersion-ceiling-light-");
    const isDepartmentFloat = name.startsWith("day1-polished-zone-");
    const isOpeningIntro = name === "day1-opening-intro";

    if (isCeilingLight) {
      scene.tweens.killTweensOf(object);
      object.setVisible(false);
      return;
    }

    if (isDepartmentFloat) {
      scene.tweens.killTweensOf(object);
      return;
    }

    if (isOpeningIntro) {
      scene.tweens.killTweensOf(object);
      object.setAlpha(1).setScale(1);
    }
  });
}

function stabilizeRestockTarget(scene: RuntimeGame): void {
  const immersion = scene.__dayOneRestockImmersion;
  if (!immersion) return;

  immersion.pulseTween?.stop();
  immersion.routeLayer?.setVisible(false);

  if (immersion.targetGlow?.active) {
    scene.tweens.killTweensOf(immersion.targetGlow);
    immersion.targetGlow.setAlpha(0.16).setScale(1);
  }
  if (immersion.targetArrow?.active) {
    scene.tweens.killTweensOf(immersion.targetArrow);
    immersion.targetArrow.setAlpha(1).setScale(1);
  }
  if (immersion.targetFrame?.active) {
    scene.tweens.killTweensOf(immersion.targetFrame);
    immersion.targetFrame.setAlpha(1).setScale(1);
  }
}

function disablePolishOverlay(gameScene: Phaser.Scene): void {
  let overlay: RuntimePolishOverlay | undefined;
  try {
    overlay = gameScene.scene.get("polish-overlay") as RuntimePolishOverlay;
  } catch {
    return;
  }
  if (!overlay?.scene?.isActive()) return;

  overlay.tutorialTween?.stop();
  overlay.tutorialTween = undefined;
  overlay.tutorialGraphics?.clear().setVisible(false).setAlpha(1);
  overlay.tutorialBg?.setVisible(false);
  overlay.tutorialText?.setVisible(false);

  overlay.pressureTween?.stop();
  overlay.pressureTween = undefined;
  overlay.pressureBg?.setVisible(false).setAlpha(1);
  overlay.pressureText?.setVisible(false).setAlpha(1);
}

function removeOversizedCartHighlight(scene: Phaser.Scene): void {
  visitSceneObjects(scene, (object) => {
    if (!(object instanceof Phaser.GameObjects.Rectangle)) return;

    const rectangle = object as Phaser.GameObjects.Rectangle & {
      strokeColor?: number;
      isStroked?: boolean;
    };
    const color = rectangle.strokeColor ?? 0;
    const yellowStroke = color === 0xffd75a || color === 0xffdf67 || color === 0xffd95c;
    const aroundCart =
      rectangle.x > 250 && rectangle.x < 720 &&
      rectangle.y > 620 && rectangle.y < 1040 &&
      rectangle.width >= 180 && rectangle.width <= 420 &&
      rectangle.height >= 180 && rectangle.height <= 420;

    if (!yellowStroke || !aroundCart) return;
    scene.tweens.killTweensOf(rectangle);
    rectangle.setVisible(false).disableInteractive();
  });
}

function visitSceneObjects(
  scene: Phaser.Scene,
  visitor: (object: Phaser.GameObjects.GameObject) => void
): void {
  const visit = (object: Phaser.GameObjects.GameObject): void => {
    if (!object.active) return;
    visitor(object);
    if (!object.active || !(object instanceof Phaser.GameObjects.Container)) return;
    for (const child of [...object.list]) visit(child);
  };

  for (const child of [...scene.children.list]) visit(child);
}
