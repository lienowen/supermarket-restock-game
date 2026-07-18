import Phaser from "phaser";
import { crazyGamesPlatform } from "../platform/crazyGamesPlatform";
import { DAY_ONE_CONTENT } from "./content/day01";
import { ImmersiveDayOneScene } from "./presentation/ImmersiveDayOneScene";

export async function bootstrapImmersiveGame(): Promise<Phaser.Game> {
  document.body.dataset.uiLanguage = "en";
  document.body.dataset.gameVersion = "immersive-v2";

  await crazyGamesPlatform.initialize();
  crazyGamesPlatform.loadingStart();

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "app",
    width: DAY_ONE_CONTENT.world.width,
    height: DAY_ONE_CONTENT.world.height,
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
    scene: [ImmersiveDayOneScene]
  });

  crazyGamesPlatform.bindGame(game);
  return game;
}
