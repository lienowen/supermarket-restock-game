import Phaser from "phaser";
import { crazyGamesPlatform } from "../../../platform/crazyGamesPlatform";
import { CampaignSession } from "../../application/CampaignSession";
import { gameDomainEvents } from "../../events/GameDomainEvents";
import {
  createStarterMarketPresentationContext,
  MAIN_LEVEL_CAMPAIGN_RUNTIME,
  type StarterMarketPresentationContext
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

const rewardWithProfitUpgrade = <T extends { readonly totalCoins: number }>(
  reward: T,
  profitLevel: number
): T => Object.freeze({
  ...reward,
  totalCoins: Math.round(reward.totalCoins * (1 + profitLevel * 0.1))
}) as T;

const applyCampaignUpgrades = (
  presentation: StarterMarketPresentationContext,
  session: CampaignSession
): StarterMarketPresentationContext => {
  const upgrades = session.upgrades();
  const navigation = Object.freeze({
    ...presentation.campaignLevel.level.navigation,
    moveSpeed: session.movementSpeed(presentation.campaignLevel.level.navigation.moveSpeed)
  });

  switch (presentation.mode) {
    case "restock": {
      const runtime = Object.freeze({
        ...presentation.runtime,
        reward: rewardWithProfitUpgrade(presentation.runtime.reward, upgrades.profit)
      });
      const level = Object.freeze({
        ...presentation.campaignLevel.level,
        navigation
      });
      return Object.freeze({
        ...presentation,
        runtime,
        campaignLevel: Object.freeze({
          ...presentation.campaignLevel,
          level,
          runtime
        })
      });
    }
    case "checkout": {
      const tuning = Object.freeze({
        ...presentation.campaignLevel.level.tuning,
        scanDurationMs: session.serviceDuration(presentation.campaignLevel.level.tuning.scanDurationMs),
        queueAdvanceDurationMs: session.serviceDuration(
          presentation.campaignLevel.level.tuning.queueAdvanceDurationMs
        )
      });
      const runtime = Object.freeze({
        ...presentation.runtime,
        reward: rewardWithProfitUpgrade(presentation.runtime.reward, upgrades.profit)
      });
      const level = Object.freeze({
        ...presentation.campaignLevel.level,
        navigation,
        tuning
      });
      return Object.freeze({
        ...presentation,
        runtime,
        campaignLevel: Object.freeze({
          ...presentation.campaignLevel,
          level,
          runtime
        })
      });
    }
    case "clean": {
      const cleanDurationMs = session.serviceDuration(presentation.runtime.cleanDurationMs);
      const tuning = Object.freeze({
        ...presentation.campaignLevel.level.tuning,
        cleanDurationMs
      });
      const runtime = Object.freeze({
        ...presentation.runtime,
        cleanDurationMs,
        reward: rewardWithProfitUpgrade(presentation.runtime.reward, upgrades.profit)
      });
      const level = Object.freeze({
        ...presentation.campaignLevel.level,
        navigation,
        tuning
      });
      return Object.freeze({
        ...presentation,
        runtime,
        campaignLevel: Object.freeze({
          ...presentation.campaignLevel,
          level,
          runtime
        })
      });
    }
    case "find-items": {
      const runtime = Object.freeze({
        ...presentation.runtime,
        reward: rewardWithProfitUpgrade(presentation.runtime.reward, upgrades.profit)
      });
      const level = Object.freeze({
        ...presentation.campaignLevel.level,
        navigation
      });
      return Object.freeze({
        ...presentation,
        runtime,
        campaignLevel: Object.freeze({
          ...presentation.campaignLevel,
          level,
          runtime
        })
      });
    }
  }
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
  const presentation = applyCampaignUpgrades(basePresentation, session);
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
      pixelArt: false,
      powerPreference: "high-performance"
    },
    input: {
      activePointers: 3
    },
    scene: [activeScene]
  });
  game.registry.set("campaignSession", session);

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
