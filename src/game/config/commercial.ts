export type CommercialReleaseStage = "vertical-slice" | "soft-launch" | "production";
export type RewardedAdPlacement = "revive" | "double-reward" | "bonus-order";
export type AnalyticsEventName =
  | "game_boot"
  | "tutorial_start"
  | "tutorial_complete"
  | "level_start"
  | "level_complete"
  | "level_fail"
  | "level_retry"
  | "rewarded_offer"
  | "rewarded_complete"
  | "interstitial_shown"
  | "upgrade_purchase"
  | "session_end";

export interface CommercialProductConfig {
  readonly productId: string;
  readonly title: string;
  readonly releaseStage: CommercialReleaseStage;
  readonly primaryMode: "shelf-restock-puzzle";
  readonly targetPortal: "crazygames";
  readonly targetSessionMinutes: number;
  readonly targetFirstDayMinutes: number;
}

export interface CommercialProgressionConfig {
  readonly saveSchemaVersion: number;
  readonly launchLevelCount: number;
  readonly tutorialLevelCount: number;
  readonly productsAtLaunch: number;
  readonly shelfLayouts: readonly ["2x2", "3x2", "3x3", "4x3", "3x5"];
  readonly currencies: readonly ["coins", "stars"];
}

export interface CommercialMonetizationConfig {
  readonly rewardedAds: {
    readonly enabled: boolean;
    readonly placements: readonly RewardedAdPlacement[];
  };
  readonly interstitials: {
    readonly enabled: boolean;
    readonly minimumCompletedLevelsBetweenAds: number;
    readonly cooldownSeconds: number;
  };
  readonly purchases: {
    readonly enabled: boolean;
  };
}

export interface CommercialQualityConfig {
  readonly maximumInitialDownloadMiB: number;
  readonly minimumDesktopFps: number;
  readonly minimumMobileFps: number;
  readonly maximumFirstInteractiveSeconds: number;
  readonly requiresKeyboardAndPointer: boolean;
  readonly requiresSaveMigration: boolean;
  readonly requiresTenLevelBrowserRun: boolean;
}

export interface CommercialConfig {
  readonly product: CommercialProductConfig;
  readonly progression: CommercialProgressionConfig;
  readonly monetization: CommercialMonetizationConfig;
  readonly analytics: {
    readonly enabled: boolean;
    readonly requiredEvents: readonly AnalyticsEventName[];
  };
  readonly quality: CommercialQualityConfig;
  readonly legacyContentPolicy: {
    readonly runtimeStatus: "quarantined";
    readonly allowedForReuse: readonly ["assets", "navigation", "platform-adapter", "save-store"];
    readonly prohibitedAsPrimaryLoop: readonly ["checkout", "clean", "find-items", "walking-simulator"];
  };
}

export const COMMERCIAL_CONFIG: CommercialConfig = Object.freeze({
  product: Object.freeze({
    productId: "shelf-rush-market",
    title: "Shelf Rush Market",
    releaseStage: "vertical-slice",
    primaryMode: "shelf-restock-puzzle",
    targetPortal: "crazygames",
    targetSessionMinutes: 8,
    targetFirstDayMinutes: 20
  }),
  progression: Object.freeze({
    saveSchemaVersion: 1,
    launchLevelCount: 60,
    tutorialLevelCount: 3,
    productsAtLaunch: 30,
    shelfLayouts: Object.freeze(["2x2", "3x2", "3x3", "4x3", "3x5"]),
    currencies: Object.freeze(["coins", "stars"])
  }),
  monetization: Object.freeze({
    rewardedAds: Object.freeze({
      enabled: true,
      placements: Object.freeze(["revive", "double-reward", "bonus-order"])
    }),
    interstitials: Object.freeze({
      enabled: true,
      minimumCompletedLevelsBetweenAds: 2,
      cooldownSeconds: 180
    }),
    purchases: Object.freeze({ enabled: false })
  }),
  analytics: Object.freeze({
    enabled: true,
    requiredEvents: Object.freeze([
      "game_boot",
      "tutorial_start",
      "tutorial_complete",
      "level_start",
      "level_complete",
      "level_fail",
      "level_retry",
      "rewarded_offer",
      "rewarded_complete",
      "interstitial_shown",
      "upgrade_purchase",
      "session_end"
    ])
  }),
  quality: Object.freeze({
    maximumInitialDownloadMiB: 15,
    minimumDesktopFps: 55,
    minimumMobileFps: 30,
    maximumFirstInteractiveSeconds: 4,
    requiresKeyboardAndPointer: true,
    requiresSaveMigration: true,
    requiresTenLevelBrowserRun: true
  }),
  legacyContentPolicy: Object.freeze({
    runtimeStatus: "quarantined",
    allowedForReuse: Object.freeze(["assets", "navigation", "platform-adapter", "save-store"]),
    prohibitedAsPrimaryLoop: Object.freeze(["checkout", "clean", "find-items", "walking-simulator"])
  })
});

const duplicateValues = (values: readonly string[]): readonly string[] => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
};

export function validateCommercialConfig(config: CommercialConfig = COMMERCIAL_CONFIG): readonly string[] {
  const errors: string[] = [];

  if (!config.product.productId.trim()) errors.push("Commercial productId is required");
  if (!config.product.title.trim()) errors.push("Commercial product title is required");
  if (config.product.primaryMode !== "shelf-restock-puzzle") {
    errors.push("The commercial primary mode must remain shelf-restock-puzzle");
  }
  if (config.product.targetSessionMinutes < 5 || config.product.targetSessionMinutes > 15) {
    errors.push("Target session length must stay between 5 and 15 minutes");
  }
  if (config.progression.launchLevelCount < 30) {
    errors.push("Commercial launch requires at least 30 authored levels");
  }
  if (config.progression.tutorialLevelCount < 3) {
    errors.push("Commercial launch requires at least three tutorial levels");
  }
  if (config.progression.productsAtLaunch < 20) {
    errors.push("Commercial launch requires at least twenty product types");
  }
  if (config.monetization.interstitials.cooldownSeconds < 120) {
    errors.push("Interstitial cooldown must be at least 120 seconds");
  }
  if (config.monetization.interstitials.minimumCompletedLevelsBetweenAds < 2) {
    errors.push("Interstitials cannot appear after every level");
  }
  if (config.quality.maximumInitialDownloadMiB > 20) {
    errors.push("Initial release payload cannot exceed 20 MiB");
  }
  if (config.quality.maximumFirstInteractiveSeconds > 5) {
    errors.push("First interactive target cannot exceed five seconds");
  }

  const duplicateEvents = duplicateValues(config.analytics.requiredEvents);
  if (duplicateEvents.length > 0) {
    errors.push(`Duplicate analytics events: ${duplicateEvents.join(", ")}`);
  }

  return Object.freeze(errors);
}
