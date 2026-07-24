import type { LevelDefinition } from "../../content/GameContent";
import { MAIN_LEVEL_CAMPAIGN_RUNTIME } from "../context/StarterMarketPresentationContext";

export interface CampaignProgressionPreview {
  readonly eyebrow: string;
  readonly title: string;
  readonly detail: string;
  readonly isCampaignComplete: boolean;
}

const MODE_LABELS: Readonly<Record<LevelDefinition["mode"], string>> = Object.freeze({
  restock: "RESTOCK CHALLENGE",
  checkout: "CHECKOUT RUSH",
  clean: "CLEANING SHIFT",
  "find-items": "ORDER HUNT"
});

export function resolveCampaignProgressionPreview(
  currentLevelId: string | undefined
): CampaignProgressionPreview {
  const current = currentLevelId
    ? MAIN_LEVEL_CAMPAIGN_RUNTIME.levels.find((entry) => entry.level.id === currentLevelId)
    : undefined;
  const next = current?.nextLevelId
    ? MAIN_LEVEL_CAMPAIGN_RUNTIME.levels.find((entry) => entry.level.id === current.nextLevelId)
    : undefined;

  if (next) {
    return Object.freeze({
      eyebrow: `UP NEXT · ${next.levelLabel}`,
      title: next.level.title.toUpperCase(),
      detail: `${MODE_LABELS[next.level.mode]} · ${next.mission.title.toUpperCase()}`,
      isCampaignComplete: false
    });
  }

  return Object.freeze({
    eyebrow: "CAMPAIGN COMPLETE",
    title: "THE STORE IS RUNNING",
    detail: "PLAY AGAIN TO BUILD A FASTER, CLEANER SHIFT",
    isCampaignComplete: true
  });
}
