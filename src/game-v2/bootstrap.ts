import Phaser from "phaser";
import { crazyGamesPlatform } from "../platform/crazyGamesPlatform";
import { DAY_ONE_CONTENT } from "./content/day01";
import { ImmersiveDayOneScene } from "./presentation/ImmersiveDayOneScene";

type GuardedGameObjectPrototype = Phaser.GameObjects.GameObject & {
  __safeInteractiveGuardInstalled?: boolean;
};

function installSafeInteractiveGuard(): void {
  const prototype = Phaser.GameObjects.GameObject.prototype as GuardedGameObjectPrototype;
  if (prototype.__safeInteractiveGuardInstalled) return;

  const originalSetInteractive = prototype.setInteractive;
  prototype.setInteractive = function safeSetInteractive(
    hitArea?: Phaser.Types.Input.InputConfiguration | Phaser.Geom.Rectangle | Phaser.Geom.Circle | Phaser.Geom.Ellipse | Phaser.Geom.Polygon | false,
    hitAreaCallback?: Phaser.Types.Input.HitAreaCallback,
    dropZone?: boolean
  ): Phaser.GameObjects.GameObject {
    if (hitArea === false) return this;
    return originalSetInteractive.call(this, hitArea, hitAreaCallback, dropZone);
  };
  prototype.__safeInteractiveGuardInstalled = true;
}

export async function bootstrapImmersiveGame(): Promise<Phaser.Game> {
  document.body.dataset.uiLanguage = "en";
  document.body.dataset.gameVersion = "architecture-v3";

  installSafeInteractiveGuard();
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

  if (new URLSearchParams(window.location.search).get("test") === "1") {
    const testWindow = window as Window & { __IMMERSIVE_GAME__?: Phaser.Game };
    testWindow.__IMMERSIVE_GAME__ = game;
  }

  crazyGamesPlatform.bindGame(game);
  return game;
}
