import Phaser from "phaser";
import { GameScene } from "./scenes/GameScene";

type RuntimeGameScene = Phaser.Scene & {
  phase: "PREPARE" | "OPEN" | "RUSH" | "CLOSING" | "RESULT";
  __finalServiceActive?: boolean;
  __closingTaskReady?: boolean;
  __atmosphereShade?: Phaser.GameObjects.Rectangle;
  __storeStatus?: Phaser.GameObjects.Text;
  __lastAtmosphereState?: string;
  __atmosphereHandler?: () => void;
};

type GamePrototype = {
  create: () => void;
};

const prototype = GameScene.prototype as unknown as GamePrototype;
const originalCreate = prototype.create;

prototype.create = function createWithShiftAtmosphere(): void {
  originalCreate.call(this);
  const scene = this as unknown as RuntimeGameScene;

  scene.__atmosphereShade?.destroy();
  scene.__storeStatus?.destroy();

  scene.__atmosphereShade = scene.add.rectangle(665, 669, 1330, 1026, 0x0d1c25, 0.14)
    .setDepth(43)
    .setBlendMode(Phaser.BlendModes.MULTIPLY)
    .setScrollFactor(0);
  scene.__storeStatus = scene.add.text(655, 172, "PREPARING", {
    fontFamily: "Arial",
    fontSize: "17px",
    color: "#dcebf0",
    fontStyle: "bold",
    letterSpacing: 2,
    backgroundColor: "#20363d",
    padding: { x: 15, y: 8 }
  }).setOrigin(0.5).setDepth(47);

  const updateAtmosphere = (): void => applyAtmosphere(scene);
  scene.__atmosphereHandler = updateAtmosphere;
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, updateAtmosphere);
  applyAtmosphere(scene, true);

  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, updateAtmosphere);
    scene.__atmosphereShade?.destroy();
    scene.__storeStatus?.destroy();
    scene.__atmosphereShade = undefined;
    scene.__storeStatus = undefined;
    scene.__atmosphereHandler = undefined;
    scene.__lastAtmosphereState = undefined;
  });
};

function applyAtmosphere(scene: RuntimeGameScene, force = false): void {
  const state = resolveState(scene);
  if (!force && state === scene.__lastAtmosphereState) return;
  scene.__lastAtmosphereState = state;

  const style = stateStyle(state);
  const shade = scene.__atmosphereShade;
  const sign = scene.__storeStatus;
  if (!shade || !sign) return;

  scene.tweens.killTweensOf(shade);
  scene.tweens.killTweensOf(sign);
  shade.setFillStyle(style.color, shade.alpha);
  scene.tweens.add({
    targets: shade,
    alpha: style.alpha,
    duration: 520,
    ease: "Sine.InOut"
  });

  sign
    .setText(style.label)
    .setColor(style.textColor)
    .setBackgroundColor(style.background)
    .setAlpha(0)
    .setScale(0.9);
  scene.tweens.add({
    targets: sign,
    alpha: 1,
    scaleX: 1,
    scaleY: 1,
    duration: 220,
    ease: "Back.Out"
  });
}

function resolveState(scene: RuntimeGameScene): string {
  if (scene.phase === "CLOSING" && scene.__finalServiceActive) return "FINAL_WAVE";
  if (scene.phase === "CLOSING" && scene.__closingTaskReady) return "CLOSING_TASK";
  return scene.phase;
}

function stateStyle(state: string): {
  label: string;
  color: number;
  alpha: number;
  background: string;
  textColor: string;
} {
  switch (state) {
    case "OPEN":
      return { label: "OPEN", color: 0xfff4c2, alpha: 0.035, background: "#2f7043", textColor: "#efffdc" };
    case "RUSH":
      return { label: "LUNCH RUSH", color: 0xffa84f, alpha: 0.09, background: "#874a17", textColor: "#fff0b0" };
    case "FINAL_WAVE":
      return { label: "LAST CUSTOMERS", color: 0xffb34f, alpha: 0.11, background: "#7b3f16", textColor: "#fff0b0" };
    case "CLOSING_TASK":
      return { label: "CLOSING", color: 0x243a52, alpha: 0.2, background: "#253d56", textColor: "#dcecff" };
    case "RESULT":
      return { label: "CLOSED", color: 0x091113, alpha: 0.42, background: "#202b2e", textColor: "#d5e0e3" };
    default:
      return { label: "PREPARING", color: 0x173039, alpha: 0.15, background: "#20363d", textColor: "#dcebf0" };
  }
}
