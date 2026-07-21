import Phaser from "phaser";
import { crazyGamesPlatform } from "../../../platform/crazyGamesPlatform";
import { CampaignSession } from "../../application/CampaignSession";
import {
  createStarterMarketPresentationContext,
  MAIN_LEVEL_CAMPAIGN_RUNTIME
} from "../../presentation/context/StarterMarketPresentationContext";
import type { SceneCampaignSessionContext } from "../../presentation/scenes/StarterMarketScene";
import { BrowserCampaignSessionStore } from "../browser/BrowserCampaignSessionStore";
import { createGameplayScene } from "./GameplaySceneRegistry";
import { installSafeInteractiveGuard } from "./SafeInteractiveGuard";

export interface PhaserGameFactoryOptions {
  readonly parent?: string;
  readonly exposeTestBridge?: boolean;
  readonly levelId?: string;
  readonly shiftId?: string;
}

const requestedLevelFromLocation = (): string | undefined => {
  const parameters = new URLSearchParams(window.location.search);
  return parameters.get("level")?.trim() || parameters.get("shift")?.trim() || undefined;
};

export async function createPhaserGame(
  options: PhaserGameFactoryOptions = {}
): Promise<Phaser.Game> {
  installSafeInteractiveGuard();
  await crazyGamesPlatform.initialize();
  crazyGamesPlatform.loadingStart();

  const firstLevel = MAIN_LEVEL_CAMPAIGN_RUNTIME.levels[0];
  if (!firstLevel) throw new Error("Main campaign has no playable levels");
  const requestedId = options.levelId ?? options.shiftId ?? requestedLevelFromLocation();
  const levelId = requestedId ?? firstLevel.level.id;
  const presentation = createStarterMarketPresentationContext(levelId);

  const session = new CampaignSession(
    {
      campaignId: MAIN_LEVEL_CAMPAIGN_RUNTIME.campaign.id,
      firstLevelId: firstLevel.level.id,
      defaultEconomy: {
        coins: firstLevel.level.tuning.initialCoins,
        stars: 0,
        reputation: 0
      }
    },
    new BrowserCampaignSessionStore()
  );
  const campaignSession: SceneCampaignSessionContext = Object.freeze({
    session,
    initialEconomy: session.initialEconomyFor(
      presentation.campaignLevel.level.id,
      presentation.campaignLevel.level.tuning.initialCoins
    ),
    firstLevelId: firstLevel.level.id
  });

  document.body.dataset.activeShift = presentation.runtime.shift.id;
  document.body.dataset.activeDay = String(presentation.campaignShift.dayNumber);
  document.body.dataset.activeLevel = presentation.campaignLevel.level.id;
  document.body.dataset.activeMode = presentation.mode;

  const activeScene = createGameplayScene(presentation, campaignSession);

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
    scene: [activeScene]
  });

  const exposeTestBridge = options.exposeTestBridge ?? (
    new URLSearchParams(window.location.search).get("test") === "1"
  );
  if (exposeTestBridge) {
    const testWindow = window as Window & {
      __IMMERSIVE_GAME__?: Phaser.Game;
      __CAMPAIGN_SESSION__?: CampaignSession;
    };
    testWindow.__IMMERSIVE_GAME__ = game;
    testWindow.__CAMPAIGN_SESSION__ = session;
  }

  crazyGamesPlatform.bindGame(game);
  return game;
}
