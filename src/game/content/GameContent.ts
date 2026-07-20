export type ProductCategory =
  | "beverage"
  | "produce"
  | "snack"
  | "frozen"
  | "household";

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

export interface RestockLevelAssetBindingsDefinition {
  readonly environmentAssetKey: string;
  readonly fixtureAssetKey: string;
  readonly workerPushAssetKey: string;
  readonly workerCarryAssetKey: string;
  readonly cartAssetKey: string;
  readonly caseAssetKey: string;
  readonly productAssetKey: string;
  readonly ambientProductAssetKeys: readonly string[];
}

/** Compatibility name retained for existing imports. */
export type LevelAssetBindingsDefinition = RestockLevelAssetBindingsDefinition;

export interface CheckoutLevelAssetBindingsDefinition {
  readonly environmentAssetKey: string;
  readonly workerAssetKey: string;
  readonly customerAssetKeys: readonly string[];
}

export interface RestockLevelTuningDefinition {
  readonly initialCoins: number;
  readonly slotCount?: number;
  readonly progressRewardRatio?: number;
  readonly travelDurationMs: number;
  readonly travelLockBufferMs?: number;
}

export interface CheckoutLevelTuningDefinition {
  readonly initialCoins: number;
  readonly serviceRewardRatio?: number;
  readonly scanDurationMs: number;
  readonly queueAdvanceDurationMs: number;
}

interface BaseLevelDefinition {
  readonly id: string;
  readonly shiftId: string;
  readonly missionId: string;
  readonly title: string;
}

export interface RestockLevelDefinition extends BaseLevelDefinition {
  readonly mode: "restock";
  readonly assetBindings: RestockLevelAssetBindingsDefinition;
  readonly tuning: RestockLevelTuningDefinition;
}

export interface CheckoutLevelDefinition extends BaseLevelDefinition {
  readonly mode: "checkout";
  readonly assetBindings: CheckoutLevelAssetBindingsDefinition;
  readonly tuning: CheckoutLevelTuningDefinition;
}

export type LevelDefinition = RestockLevelDefinition | CheckoutLevelDefinition;

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
