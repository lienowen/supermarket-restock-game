import type { RuleReferenceDefinition } from "../rules/RuleProtocol";

export const CURRENT_LEVEL_SCHEMA_VERSION = 1 as const;

export type ProductCategory =
  | "beverage"
  | "produce"
  | "snack"
  | "frozen"
  | "household"
  | "dairy"
  | "pantry";

export interface ProductDefinition {
  readonly id: string;
  readonly name: string;
  readonly category: ProductCategory;
  readonly unitPrice: number;
  readonly caseSize: number;
  readonly assetKey: string;
}

export type FixtureKind =
  | "shelf"
  | "cooler"
  | "produce-display"
  | "checkout"
  | "backroom-rack";

export interface FixtureDefinition {
  readonly id: string;
  readonly kind: FixtureKind;
  readonly capacity: number;
  readonly slotCount?: number;
  readonly acceptedProductCategories: readonly ProductCategory[];
  readonly assetKey: string;
}

export type MissionObjectiveDefinition =
  | {
      readonly type: "transfer-product";
      readonly productId: string;
      readonly targetFixtureId: string;
      readonly amount: number;
    }
  | {
      readonly type: "operate-checkout";
      readonly checkoutId: string;
      readonly customerCount: number;
    }
  | {
      readonly type: "clean-zone";
      readonly zoneId: string;
      readonly amount: number;
    }
  | {
      readonly type: "find-items";
      readonly fixtureId: string;
      readonly productIds: readonly string[];
    };

export interface MissionRewardDefinition {
  readonly coins?: number;
  readonly stars?: number;
  readonly reputation?: number;
  readonly unlockIds?: readonly string[];
}

export interface MissionDefinition {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly objectives: readonly MissionObjectiveDefinition[];
  readonly rewards: MissionRewardDefinition;
}

export interface StoreDefinition {
  readonly id: string;
  readonly name: string;
  readonly worldLayoutId: string;
  readonly fixtureIds: readonly string[];
  readonly zoneIds: readonly string[];
}

export interface ShiftDefinition {
  readonly id: string;
  readonly storeId: string;
  readonly startTime: string;
  readonly missionIds: readonly string[];
  readonly dialogueId?: string;
  readonly unlockIds?: readonly string[];
}

/** Compatibility-only legacy binding types. New levels use presentation.assetPackId. */
export interface RestockLevelAssetBindingsDefinition {
  readonly environmentAssetKey: string;
  readonly fixtureAssetKey: string;
  readonly workerIdleAssetKey: string;
  readonly workerPushAssetKey: string;
  readonly workerCarryAssetKey: string;
  readonly cartAssetKey: string;
  readonly caseAssetKey: string;
  readonly productAssetKey: string;
  readonly ambientProductAssetKeys: readonly string[];
}

export type LevelAssetBindingsDefinition = RestockLevelAssetBindingsDefinition;

export interface CheckoutLevelAssetBindingsDefinition {
  readonly environmentAssetKey: string;
  readonly workerAssetKey: string;
  readonly customerAssetKeys: readonly string[];
}

export interface CleanLevelAssetBindingsDefinition {
  readonly environmentAssetKey: string;
  readonly workerAssetKey: string;
  readonly workerMopAssetKey: string;
  readonly cleaningFixtureAssetKey: string;
  readonly cleaningCartAssetKey: string;
  readonly wetFloorSignAssetKey: string;
}

export interface FindItemsLevelAssetBindingsDefinition {
  readonly environmentAssetKey: string;
  readonly workerAssetKey: string;
  readonly workerThinkingAssetKey: string;
  readonly fixtureAssetKey: string;
  readonly itemAssetKeys: readonly string[];
}

export interface LevelNavigationDefinition {
  readonly moveSpeed: number;
  readonly interactionRadius: number;
}

export interface RestockRushTuningDefinition {
  readonly targetDurationMs?: number;
  readonly minimumTargetDurationMs?: number;
  readonly speedUpPerSuccessMs?: number;
  readonly streakWindowMs?: number;
  readonly goldTimeMs?: number;
  readonly silverTimeMs?: number;
}

export interface RestockLevelTuningDefinition {
  readonly initialCoins: number;
  readonly slotCount?: number;
  readonly progressRewardRatio?: number;
  readonly rush?: RestockRushTuningDefinition;
}

export interface CheckoutLevelTuningDefinition {
  readonly initialCoins: number;
  readonly serviceRewardRatio?: number;
  readonly scanDurationMs: number;
  readonly queueAdvanceDurationMs: number;
}

export interface WorldPointDefinition {
  readonly x: number;
  readonly y: number;
}

export interface CleanLevelTuningDefinition {
  readonly initialCoins: number;
  readonly cleanDurationMs: number;
  readonly toolPoint: WorldPointDefinition;
  readonly spotPositions: readonly WorldPointDefinition[];
}

export interface FindItemTargetDefinition extends WorldPointDefinition {
  readonly productId: string;
}

export interface FindItemsLevelTuningDefinition {
  readonly initialCoins: number;
  readonly timeLimitSeconds: number;
  readonly mistakePenaltySeconds: number;
  readonly itemTargets: readonly FindItemTargetDefinition[];
}

export interface LevelPresentationDefinition {
  readonly assetPackId: string;
  readonly visualPresetId: string;
}

interface BaseLevelDefinition {
  readonly schemaVersion: typeof CURRENT_LEVEL_SCHEMA_VERSION;
  readonly id: string;
  readonly shiftId: string;
  readonly missionId: string;
  readonly title: string;
  readonly randomSeed: string;
  readonly navigation: LevelNavigationDefinition;
  readonly presentation: LevelPresentationDefinition;
  readonly rules: readonly RuleReferenceDefinition[];
}

export interface RestockLevelDefinition extends BaseLevelDefinition {
  readonly mode: "restock";
  readonly tuning: RestockLevelTuningDefinition;
}

export interface CheckoutLevelDefinition extends BaseLevelDefinition {
  readonly mode: "checkout";
  readonly tuning: CheckoutLevelTuningDefinition;
}

export interface CleanLevelDefinition extends BaseLevelDefinition {
  readonly mode: "clean";
  readonly tuning: CleanLevelTuningDefinition;
}

export interface FindItemsLevelDefinition extends BaseLevelDefinition {
  readonly mode: "find-items";
  readonly tuning: FindItemsLevelTuningDefinition;
}

export type LevelDefinition =
  | RestockLevelDefinition
  | CheckoutLevelDefinition
  | CleanLevelDefinition
  | FindItemsLevelDefinition;

export interface CampaignDefinition {
  readonly id: string;
  readonly shiftIds: readonly string[];
  readonly levelIds: readonly string[];
}

export interface GameContentCatalogue {
  readonly products: readonly ProductDefinition[];
  readonly fixtures: readonly FixtureDefinition[];
  readonly missions: readonly MissionDefinition[];
  readonly stores: readonly StoreDefinition[];
  readonly shifts: readonly ShiftDefinition[];
  readonly levels: readonly LevelDefinition[];
  readonly campaigns: readonly CampaignDefinition[];
}
