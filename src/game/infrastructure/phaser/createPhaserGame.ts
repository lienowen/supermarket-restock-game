import Phaser from "phaser";
import { crazyGamesPlatform } from "../../../platform/crazyGamesPlatform";
import {
  createStarterMarketPresentationContext,
  MAIN_CAMPAIGN_RUNTIME
} from "../../presentation/context/StarterMarketPresentationContext";
import { StarterMarketScene } from "../../presentation/scenes/StarterMarketScene";
import { installSafeInteractiveGuard } from "./SafeInteractiveGuard";

export interface PhaserGameFactoryOptions {
  readonly parent?: string;
  readonly exposeTestBridge?: boolean;
  readonly shiftId?: string;
}

const requestedShiftFromLocation = (): string | undefined => {
  const requested = new URLSearchParams(window.location.search).get("shift")?.trim();
  return requested || undefined;
};

export async function createPhaserGame(
  options: PhaserGameFactoryOptions = {}
): Promise<Phaser.Game> {
  installSafeInteractiveGuard();
  await crazyGamesPlatform.initialize();
  crazyGamesPlatform.loadingStart();

  const shiftId = options.shiftId ?? requestedShiftFromLocation() ?? MAIN_CAMPAIGN_RUNTIME.shifts[0]?.shift.id;
  if (!shiftId) throw new Error("Main campaign has no playable shifts");
  const presentation = createStarterMarketPresentationContext(shiftId);

  document.body.dataset.activeShift = presentation.runtime.shift.id;
  document.body.dataset.activeDay = String(presentation.campaignShift.dayNumber);

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: options.parent ?? "app",
    width: presentation.world.width,
    height: presentation.world.height,
    backgroundColor: "#171712",
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      expandParent: true
    },
    render: {
      antialias: true,
      roundPixels: false,
      pixelArt: false
    },
    input: {
      activePointers: 3
    },
    scene: [new StarterMarketScene(presentation)]
  });

  const exposeTestBridge = options.exposeTestBridge ?? (
    new URLSearchParams(window.location.search).get("test") === "1"
  );
  if (exposeTestBridge) {
    const testWindow = window as Window & { __IMMERSIVE_GAME__?: Phaser.Game };
    testWindow.__IMMERSIVE_GAME__ = game;
  }

  crazyGamesPlatform.bindGame(game);
  return game;
}
