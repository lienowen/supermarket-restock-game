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

export interface CampaignDefinition {
  readonly id: string;
  readonly shiftIds: readonly string[];
}

export interface GameContentCatalogue {
  readonly products: readonly ProductDefinition[];
  readonly fixtures: readonly FixtureDefinition[];
  readonly missions: readonly MissionDefinition[];
  readonly stores: readonly StoreDefinition[];
  readonly shifts: readonly ShiftDefinition[];
  readonly campaigns: readonly CampaignDefinition[];
}
