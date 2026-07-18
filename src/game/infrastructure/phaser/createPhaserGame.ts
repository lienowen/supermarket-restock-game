import Phaser from "phaser";
import { crazyGamesPlatform } from "../../../platform/crazyGamesPlatform";
import { STARTER_MARKET_PRESENTATION } from "../../presentation/context/StarterMarketPresentationContext";
import { StarterMarketScene } from "../../presentation/scenes/StarterMarketScene";
import { installSafeInteractiveGuard } from "./SafeInteractiveGuard";

export interface PhaserGameFactoryOptions {
  readonly parent?: string;
  readonly exposeTestBridge?: boolean;
}

export async function createPhaserGame(
  options: PhaserGameFactoryOptions = {}
): Promise<Phaser.Game> {
  installSafeInteractiveGuard();
  await crazyGamesPlatform.initialize();
  crazyGamesPlatform.loadingStart();

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: options.parent ?? "app",
    width: STARTER_MARKET_PRESENTATION.world.width,
    height: STARTER_MARKET_PRESENTATION.world.height,
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
    scene: [StarterMarketScene]
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
