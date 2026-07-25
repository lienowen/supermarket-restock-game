import type { CampaignSession } from "../../application/CampaignSession";
import type { StarterMarketPresentationContext } from "./StarterMarketPresentationContext";

const rewardWithProfitUpgrade = <T extends { readonly totalCoins: number }>(
  reward: T,
  profitLevel: number
): T => Object.freeze({
  ...reward,
  totalCoins: Math.round(reward.totalCoins * (1 + profitLevel * 0.1))
}) as T;

export function applyMarketUpgradesToPresentation(
  presentation: StarterMarketPresentationContext,
  session: CampaignSession
): StarterMarketPresentationContext {
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
      const level = Object.freeze({ ...presentation.campaignLevel.level, navigation });
      return Object.freeze({
        ...presentation,
        runtime,
        campaignLevel: Object.freeze({ ...presentation.campaignLevel, level, runtime })
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
      const level = Object.freeze({ ...presentation.campaignLevel.level, navigation, tuning });
      return Object.freeze({
        ...presentation,
        runtime,
        campaignLevel: Object.freeze({ ...presentation.campaignLevel, level, runtime })
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
      const level = Object.freeze({ ...presentation.campaignLevel.level, navigation, tuning });
      return Object.freeze({
        ...presentation,
        runtime,
        campaignLevel: Object.freeze({ ...presentation.campaignLevel, level, runtime })
      });
    }
    case "find-items": {
      const runtime = Object.freeze({
        ...presentation.runtime,
        reward: rewardWithProfitUpgrade(presentation.runtime.reward, upgrades.profit)
      });
      const level = Object.freeze({ ...presentation.campaignLevel.level, navigation });
      return Object.freeze({
        ...presentation,
        runtime,
        campaignLevel: Object.freeze({ ...presentation.campaignLevel, level, runtime })
      });
    }
  }
}
