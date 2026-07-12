import Phaser from "phaser";
import type { ProductId } from "./gameConfig";
import { BackStockScene } from "./scenes/BackStockScene";
import { GameScene } from "./scenes/GameScene";
import { OpeningScene } from "./scenes/OpeningScene";
import { PromotionWingScene } from "./scenes/PromotionWingScene";
import { StorefrontScene } from "./scenes/StorefrontScene";

const SOUND_SETTING_KEY = "supermarket.settings.sound";

type PressTarget = Phaser.GameObjects.GameObject & {
  scaleX?: number;
  scaleY?: number;
  parentContainer?: Phaser.GameObjects.Container;
  getData: (key: string) => unknown;
  setData: (key: string, value: unknown) => Phaser.GameObjects.GameObject;
};

type ScenePrototype = {
  create: (...args: unknown[]) => void;
};

type RuntimeSlot = {
  productId: ProductId;
  product?: unknown;
  reservedForCustomer?: boolean;
};

type RuntimeGame = Phaser.Scene & {
  loadedProducts: ProductId[];
  cartAtShelf: boolean;
  movingCart: boolean;
  restockBusy: boolean;
  shiftEnded: boolean;
};

type GamePrototype = {
  recordRestockCombo: () => void;
  openStore: () => void;
  endShift: () => void;
  tryRestockSlot: (slot: RuntimeSlot) => void;
};

let audioContext: AudioContext | undefined;

installScenePressFeedback(StorefrontScene.prototype as unknown as ScenePrototype);
installScenePressFeedback(OpeningScene.prototype as unknown as ScenePrototype);
installScenePressFeedback(GameScene.prototype as unknown as ScenePrototype);
installScenePressFeedback(PromotionWingScene.prototype as unknown as ScenePrototype);
installScenePressFeedback(BackStockScene.prototype as unknown as ScenePrototype);
installContextualGameFeedback();

function installScenePressFeedback(prototype: ScenePrototype): void {
  const originalCreate = prototype.create;
  prototype.create = function createWithPressFeedback(...args: unknown[]): void {
    originalCreate.apply(this, args);
    const scene = this as unknown as Phaser.Scene;

    const down = (_pointer: Phaser.Input.Pointer, rawTarget: Phaser.GameObjects.GameObject): void => {
      const target = rawTarget as PressTarget;
      animatePressed(scene, target);
      playTone("tap");
      vibrate(7);
    };
    scene.input.on(Phaser.Input.Events.GAMEOBJECT_DOWN, down);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.input.off(Phaser.Input.Events.GAMEOBJECT_DOWN, down);
    });
  };
}

function installContextualGameFeedback(): void {
  const prototype = GameScene.prototype as unknown as GamePrototype;
  const originalCombo = prototype.recordRestockCombo;
  const originalOpenStore = prototype.openStore;
  const originalEndShift = prototype.endShift;
  const originalTryRestock = prototype.tryRestockSlot;

  prototype.recordRestockCombo = function restockWithFeedback(): void {
    originalCombo.call(this);
    playTone("success");
    vibrate([12, 18, 16]);
  };

  prototype.openStore = function openStoreWithFeedback(): void {
    originalOpenStore.call(this);
    playTone("open");
    vibrate([18, 20, 22]);
  };

  prototype.endShift = function endShiftWithFeedback(): void {
    const scene = this as unknown as RuntimeGame;
    const alreadyEnded = scene.shiftEnded;
    originalEndShift.call(this);
    if (!alreadyEnded && scene.shiftEnded) {
      playTone("complete");
      vibrate([22, 30, 22, 30, 34]);
    }
  };

  prototype.tryRestockSlot = function restockAttemptWithFeedback(slot: RuntimeSlot): void {
    const scene = this as unknown as RuntimeGame;
    const wrongAttempt =
      !scene.shiftEnded &&
      !scene.movingCart &&
      scene.cartAtShelf &&
      !scene.restockBusy &&
      !slot.product &&
      !slot.reservedForCustomer &&
      scene.loadedProducts.length > 0 &&
      !scene.loadedProducts.includes(slot.productId);

    originalTryRestock.call(this, slot);
    if (wrongAttempt) {
      playTone("error");
      vibrate([28, 28, 28]);
    }
  };
}

function animatePressed(scene: Phaser.Scene, target: PressTarget): void {
  const displayTarget = target.parentContainer?.active ? target.parentContainer : target;
  const object = displayTarget as PressTarget;
  const originalX = Number(object.getData("feedbackScaleX") ?? object.scaleX ?? 1);
  const originalY = Number(object.getData("feedbackScaleY") ?? object.scaleY ?? 1);
  object.setData("feedbackScaleX", originalX);
  object.setData("feedbackScaleY", originalY);

  scene.tweens.killTweensOf(displayTarget);
  scene.tweens.add({
    targets: displayTarget,
    scaleX: originalX * 0.965,
    scaleY: originalY * 0.965,
    duration: 55,
    yoyo: true,
    ease: "Quad.Out",
    onComplete: () => {
      if (!displayTarget.active) return;
      (displayTarget as unknown as { setScale: (x: number, y: number) => void }).setScale(originalX, originalY);
    }
  });
}

function playTone(kind: "tap" | "success" | "open" | "complete" | "error"): void {
  if (!soundEnabled()) return;
  const context = getAudioContext();
  if (!context) return;
  if (context.state === "suspended") void context.resume();

  const now = context.currentTime;
  if (kind === "tap") {
    scheduleTone(context, now, 420, 0.035, 0.045, "sine");
    return;
  }
  if (kind === "error") {
    scheduleTone(context, now, 170, 0.09, 0.11, "square");
    scheduleTone(context, now + 0.09, 125, 0.07, 0.12, "square");
    return;
  }
  if (kind === "success") {
    scheduleTone(context, now, 520, 0.065, 0.09, "sine");
    scheduleTone(context, now + 0.075, 720, 0.055, 0.12, "sine");
    return;
  }
  if (kind === "open") {
    scheduleTone(context, now, 392, 0.06, 0.12, "triangle");
    scheduleTone(context, now + 0.1, 523, 0.065, 0.13, "triangle");
    scheduleTone(context, now + 0.2, 659, 0.07, 0.16, "triangle");
    return;
  }
  scheduleTone(context, now, 523, 0.07, 0.14, "triangle");
  scheduleTone(context, now + 0.11, 659, 0.075, 0.15, "triangle");
  scheduleTone(context, now + 0.23, 784, 0.08, 0.22, "triangle");
}

function scheduleTone(
  context: AudioContext,
  start: number,
  frequency: number,
  volume: number,
  duration: number,
  type: OscillatorType
): void {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume), start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function getAudioContext(): AudioContext | undefined {
  if (audioContext) return audioContext;
  try {
    const AudioContextConstructor = globalThis.AudioContext ??
      (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) return undefined;
    audioContext = new AudioContextConstructor();
    return audioContext;
  } catch {
    return undefined;
  }
}

function soundEnabled(): boolean {
  try {
    return globalThis.localStorage?.getItem(SOUND_SETTING_KEY) !== "off";
  } catch {
    return true;
  }
}

function vibrate(pattern: number | number[]): void {
  if (!soundEnabled()) return;
  try {
    globalThis.navigator?.vibrate?.(pattern);
  } catch {
    // Haptics are optional and unsupported on many desktop browsers.
  }
}
