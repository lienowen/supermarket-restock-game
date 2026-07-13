import Phaser from "phaser";
import { GameScene } from "../scenes/GameScene";
import { OpeningScene } from "../scenes/OpeningScene";
import { PromotionWingScene } from "../scenes/PromotionWingScene";
import { StorefrontScene } from "../scenes/StorefrontScene";
import { gameSession } from "../systems/GameSession";
import { crazyGamesPlatform } from "./crazyGamesPlatform";

type StorefrontPrototype = {
  create: (...args: unknown[]) => void;
  startShift: (...args: unknown[]) => void;
};

type OpeningPrototype = {
  create: (...args: unknown[]) => void;
};

type RuntimeGameScene = Phaser.Scene & {
  phase?: string;
  shiftEnded?: boolean;
};

type GamePrototype = {
  create: (...args: unknown[]) => void;
};

type PromotionPrototype = {
  create: (...args: unknown[]) => void;
};

installStorefrontLifecycle();
installOpeningLifecycle();
installGameLifecycle();
installPromotionLifecycle();

function installStorefrontLifecycle(): void {
  const prototype = StorefrontScene.prototype as unknown as StorefrontPrototype;
  const originalCreate = prototype.create;
  const originalStartShift = prototype.startShift;

  prototype.create = function createWithCrazyGamesLifecycle(...args: unknown[]): void {
    originalCreate.apply(this, args);
    crazyGamesPlatform.loadingStop();
    crazyGamesPlatform.gameplayStop();
    crazyGamesPlatform.clearGameContext();
    document.body.dataset.crazyGamesScene = "storefront";
  };

  prototype.startShift = function startShiftWithCrazyGamesLoading(...args: unknown[]): void {
    crazyGamesPlatform.loadingStart();
    originalStartShift.apply(this, args);
  };
}

function installOpeningLifecycle(): void {
  const prototype = OpeningScene.prototype as unknown as OpeningPrototype;
  const originalCreate = prototype.create;

  prototype.create = function createWithCrazyGamesGameplay(...args: unknown[]): void {
    originalCreate.apply(this, args);
    crazyGamesPlatform.loadingStop();
    crazyGamesPlatform.gameplayStart();
    crazyGamesPlatform.setGameContext({
      day: gameSession.day,
      scene: "receiving"
    });
    document.body.dataset.crazyGamesScene = "receiving";
  };
}

function installGameLifecycle(): void {
  const prototype = GameScene.prototype as unknown as GamePrototype;
  const originalCreate = prototype.create;

  prototype.create = function createWithCrazyGamesGameplay(...args: unknown[]): void {
    originalCreate.apply(this, args);
    const scene = this as unknown as RuntimeGameScene;

    crazyGamesPlatform.loadingStop();
    crazyGamesPlatform.gameplayStart();
    crazyGamesPlatform.setGameContext({
      day: gameSession.day,
      scene: "main-store"
    });
    document.body.dataset.crazyGamesScene = "main-store";

    const syncEndedState = (): void => {
      if (scene.shiftEnded || scene.phase === "RESULT") crazyGamesPlatform.gameplayStop();
    };

    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, syncEndedState);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, syncEndedState);
    });
  };
}

function installPromotionLifecycle(): void {
  const prototype = PromotionWingScene.prototype as unknown as PromotionPrototype;
  const originalCreate = prototype.create;

  prototype.create = function createWithCrazyGamesContext(...args: unknown[]): void {
    originalCreate.apply(this, args);
    crazyGamesPlatform.gameplayStart();
    crazyGamesPlatform.setGameContext({
      day: gameSession.day,
      scene: "promotion-wing"
    });
    document.body.dataset.crazyGamesScene = "promotion-wing";
  };
}
