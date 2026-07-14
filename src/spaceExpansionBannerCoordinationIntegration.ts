import Phaser from "phaser";
import { ProgressionCustomerScene } from "./scenes/ProgressionCustomerScene";
import { gameSession } from "./systems/GameSession";

type RuntimeProgressionScene = Phaser.Scene & {
  dayBanner?: Phaser.GameObjects.Container;
};

type ProgressionPrototype = {
  showDayBanner: () => void;
};

const prototype = ProgressionCustomerScene.prototype as unknown as ProgressionPrototype;
const originalShowDayBanner = prototype.showDayBanner;

prototype.showDayBanner = function showDayBannerBelowRoomNavigation(): void {
  originalShowDayBanner.call(this);
  if (gameSession.day !== "day03") return;

  const scene = this as unknown as RuntimeProgressionScene;
  scene.dayBanner?.setY(72);
};
