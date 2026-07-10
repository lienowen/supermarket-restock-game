import { GameScene } from "./scenes/GameScene";
import { PolishOverlayScene } from "./scenes/PolishOverlayScene";
import { gameSession } from "./systems/GameSession";

type RuntimeGameScene = Phaser.Scene & {
  stocked: number;
  clearGuide: () => void;
};

type GameScenePrototype = {
  showCartGuide: (mode: "CART_TO_SALES" | "CART_TO_WAREHOUSE") => void;
  showRestockGuide: (slot: unknown) => void;
};

type RuntimeOverlay = Phaser.Scene & {
  gameScene?: { stocked: number };
  tutorialGraphics: Phaser.GameObjects.Graphics;
  tutorialBg: Phaser.GameObjects.Rectangle;
  tutorialText: Phaser.GameObjects.Text;
  tutorialStage?: string;
  __tutorialSignature?: string;
};

type OverlayPrototype = {
  updateTutorial: (force?: boolean) => void;
};

const gamePrototype = GameScene.prototype as unknown as GameScenePrototype;
const originalShowCartGuide = gamePrototype.showCartGuide;
const originalShowRestockGuide = gamePrototype.showRestockGuide;

function shouldShowGuide(scene: RuntimeGameScene): boolean {
  return gameSession.day === "day01" && scene.stocked === 0;
}

gamePrototype.showCartGuide = function showCartGuideOnce(
  mode: "CART_TO_SALES" | "CART_TO_WAREHOUSE"
): void {
  const scene = this as unknown as RuntimeGameScene;
  if (!shouldShowGuide(scene)) {
    scene.clearGuide();
    return;
  }
  originalShowCartGuide.call(this, mode);
};

gamePrototype.showRestockGuide = function showRestockGuideOnce(slot: unknown): void {
  const scene = this as unknown as RuntimeGameScene;
  if (!shouldShowGuide(scene)) {
    scene.clearGuide();
    return;
  }
  originalShowRestockGuide.call(this, slot);
};

const overlayPrototype = PolishOverlayScene.prototype as unknown as OverlayPrototype;
const originalUpdateTutorial = overlayPrototype.updateTutorial;

overlayPrototype.updateTutorial = function updateOneTimeTutorial(force = false): void {
  const overlay = this as unknown as RuntimeOverlay;
  const stocked = overlay.gameScene?.stocked ?? 0;

  if (gameSession.day !== "day01" || stocked > 0) {
    overlay.tutorialGraphics?.clear().setVisible(false).setAlpha(1);
    overlay.tutorialBg?.setVisible(false);
    overlay.tutorialText?.setVisible(false);
    overlay.tutorialStage = "DONE";
    overlay.__tutorialSignature = "DONE";
    return;
  }

  originalUpdateTutorial.call(this, force);
};
