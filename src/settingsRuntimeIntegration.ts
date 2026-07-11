import Phaser from "phaser";
import { GameScene } from "./scenes/GameScene";
import { OpeningScene } from "./scenes/OpeningScene";
import { StorefrontScene } from "./scenes/StorefrontScene";

const SOUND_SETTING_KEY = "supermarket.settings.sound";
const GUIDANCE_SETTING_KEY = "supermarket.settings.guidance";

type RuntimeGameScene = Phaser.Scene & {
  hintText: Phaser.GameObjects.Text;
  hintBubble: Phaser.GameObjects.Image;
  bubbleText: Phaser.GameObjects.Text;
  guideGraphics: Phaser.GameObjects.Graphics;
  guideLabelBg: Phaser.GameObjects.Rectangle;
  guideLabel: Phaser.GameObjects.Text;
};

type GamePrototype = {
  create: () => void;
  updateHud: () => void;
  showTransientHint: (message: string) => void;
};

type SimpleScenePrototype = {
  create: (...args: unknown[]) => void;
};

const gamePrototype = GameScene.prototype as unknown as GamePrototype;
const originalGameCreate = gamePrototype.create;
const originalUpdateHud = gamePrototype.updateHud;
const originalShowTransientHint = gamePrototype.showTransientHint;

gamePrototype.create = function createWithRuntimeSettings(): void {
  originalGameCreate.call(this);
  const scene = this as unknown as RuntimeGameScene;
  applySoundSetting(scene);
  applyGuidanceVisibility(scene);
};

gamePrototype.updateHud = function updateHudWithGuidanceSetting(): void {
  originalUpdateHud.call(this);
  applyGuidanceVisibility(this as unknown as RuntimeGameScene);
};

gamePrototype.showTransientHint = function showConfiguredTransientHint(message: string): void {
  if (!guidanceEnabled()) return;
  originalShowTransientHint.call(this, message);
};

wrapSceneCreate(StorefrontScene.prototype as unknown as SimpleScenePrototype);
wrapSceneCreate(OpeningScene.prototype as unknown as SimpleScenePrototype);

function wrapSceneCreate(prototype: SimpleScenePrototype): void {
  const originalCreate = prototype.create;
  prototype.create = function createWithSoundSetting(...args: unknown[]): void {
    originalCreate.apply(this, args);
    applySoundSetting(this as unknown as Phaser.Scene);
  };
}

function applySoundSetting(scene: Phaser.Scene): void {
  scene.sound.mute = !soundEnabled();
}

function applyGuidanceVisibility(scene: RuntimeGameScene): void {
  const visible = guidanceEnabled();
  scene.hintText?.setVisible(visible);
  if (!visible) {
    scene.hintBubble?.setAlpha(0);
    scene.bubbleText?.setAlpha(0);
    scene.guideGraphics?.setVisible(false);
    scene.guideLabelBg?.setVisible(false);
    scene.guideLabel?.setVisible(false);
  }
}

function soundEnabled(): boolean {
  return readSetting(SOUND_SETTING_KEY, "on") !== "off";
}

function guidanceEnabled(): boolean {
  return readSetting(GUIDANCE_SETTING_KEY, "on") !== "off";
}

function readSetting(key: string, fallback: string): string {
  try {
    return globalThis.localStorage?.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}
