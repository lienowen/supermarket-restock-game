import Phaser from "phaser";
import { crazyGamesPlatform } from "../../../platform/crazyGamesPlatform";
import { CampaignSession } from "../../application/CampaignSession";
import { gameDomainEvents } from "../../events/GameDomainEvents";
import {
  createStarterMarketPresentationContext,
  MAIN_LEVEL_CAMPAIGN_RUNTIME
} from "../../presentation/context/StarterMarketPresentationContext";
import { applyMarketUpgradesToPresentation } from "../../presentation/context/MarketUpgradePresentation";
import { CommercialShelfSortScene } from "../../presentation/scenes/CommercialShelfSortScene";
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

const shouldRunLegacyCampaign = (requestedId: string | undefined): boolean => {
  const parameters = new URLSearchParams(window.location.search);
  if (parameters.get("legacy") === "1") return true;
  return requestedId?.startsWith("starter-") ?? false;
};

const exposeGameForTesting = (
  game: Phaser.Game,
  expose: boolean,
  session?: CampaignSession
): void => {
  if (!expose) return;
  const testWindow = window as Window & {
    __IMMERSIVE_GAME__?: Phaser.Game;
    __CAMPAIGN_SESSION__?: CampaignSession;
  };
  testWindow.__IMMERSIVE_GAME__ = game;
  if (session) testWindow.__CAMPAIGN_SESSION__ = session;
};

const commonGameConfiguration = (
  parent: string,
  width: number,
  height: number,
  scene: Phaser.Scene
): Phaser.Types.Core.GameConfig => ({
  type: Phaser.AUTO,
  parent,
  width,
  height,
  backgroundColor: "#13231f",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    expandParent: true
  },
  render: {
    antialias: true,
    roundPixels: false,
    pixelArt: false,
    powerPreference: "high-performance"
  },
  input: {
    activePointers: 3
  },
  scene: [scene]
});

export async function createPhaserGame(
  options: PhaserGameFactoryOptions = {}
): Promise<Phaser.Game> {
  installSafeInteractiveGuard();
  await crazyGamesPlatform.initialize();
  crazyGamesPlatform.loadingStart();

  const requestedId = options.levelId ?? options.shiftId ?? requestedLevelFromLocation();
  const exposeTestBridge = options.exposeTestBridge ?? (
    new URLSearchParams(window.location.search).get("test") === "1"
  );

  if (!shouldRunLegacyCampaign(requestedId)) {
    document.body.dataset.activeCampaign = "commercial-vertical-slice";
    document.body.dataset.runtimeTrack = "commercial";
    const game = new Phaser.Game(commonGameConfiguration(
      options.parent ?? "app",
      750,
      1334,
      new CommercialShelfSortScene()
    ));
    exposeGameForTesting(game, exposeTestBridge);
    crazyGamesPlatform.bindGame(game);
    return game;
  }

  document.body.dataset.runtimeTrack = "legacy";
  const firstLevel = MAIN_LEVEL_CAMPAIGN_RUNTIME.levels[0];
  if (!firstLevel) throw new Error("Main campaign has no playable levels");
  const levelId = requestedId ?? firstLevel.level.id;
  const basePresentation = createStarterMarketPresentationContext(levelId);

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
    new BrowserCampaignSessionStore(),
    gameDomainEvents
  );
  const presentation = applyMarketUpgradesToPresentation(basePresentation, session);
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
  const game = new Phaser.Game(commonGameConfiguration(
    options.parent ?? "app",
    presentation.world.width,
    presentation.world.height,
    activeScene
  ));
  game.registry.set("campaignSession", session);
  exposeGameForTesting(game, exposeTestBridge, session);

  crazyGamesPlatform.bindGame(game);
  return game;
}
