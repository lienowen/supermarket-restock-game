import type {
  CampaignDefinition,
  GameContentCatalogue,
  LevelDefinition,
  MissionDefinition,
  ShiftDefinition,
  StoreDefinition
} from "../content/GameContent";
import {
  resolveCheckoutLevelRuntime,
  type CheckoutLevelRuntimeContent
} from "./CheckoutLevelRuntimeContent";
import {
  resolveRestockShiftRuntime,
  type RestockShiftRuntimeContent
} from "./ShiftRuntimeContent";

export type PlayableLevelRuntimeContent =
  | RestockShiftRuntimeContent
  | CheckoutLevelRuntimeContent;

export interface CampaignLevelRuntime {
  readonly campaignId: string;
  readonly index: number;
  readonly levelNumber: number;
  readonly levelLabel: string;
  readonly level: LevelDefinition;
  readonly shift: ShiftDefinition;
  readonly store: StoreDefinition;
  readonly mission: MissionDefinition;
  readonly runtime: PlayableLevelRuntimeContent;
  readonly previousLevelId?: string;
  readonly nextLevelId?: string;
}

export interface LevelCampaignRuntime {
  readonly campaign: CampaignDefinition;
  readonly levels: readonly CampaignLevelRuntime[];
}

const findRequired = <T extends { readonly id: string }>(
  collection: readonly T[],
  id: string,
  kind: string
): T => {
  const value = collection.find((entry) => entry.id === id);
  if (!value) throw new Error(`Missing ${kind}: ${id}`);
  return value;
};

export function resolveLevelCampaignRuntime(
  catalogue: GameContentCatalogue,
  campaignId: string
): LevelCampaignRuntime {
  const campaign = findRequired(catalogue.campaigns, campaignId, "campaign");
  const seenLevelIds = new Set<string>();

  const levels = campaign.levelIds.map((levelId, index): CampaignLevelRuntime => {
    if (seenLevelIds.has(levelId)) {
      throw new Error(`Campaign ${campaign.id} contains duplicate level ${levelId}`);
    }
    seenLevelIds.add(levelId);

    const level = findRequired(catalogue.levels, levelId, "level");
    const shift = findRequired(catalogue.shifts, level.shiftId, "shift");
    const store = findRequired(catalogue.stores, shift.storeId, "store");
    const mission = findRequired(catalogue.missions, level.missionId, "mission");

    if (!shift.missionIds.includes(mission.id)) {
      throw new Error(`Level ${level.id} mission ${mission.id} does not belong to shift ${shift.id}`);
    }

    const runtime: PlayableLevelRuntimeContent = level.mode === "restock"
      ? resolveRestockShiftRuntime(catalogue, shift.id, {
          missionId: mission.id,
          slotCount: level.tuning.slotCount,
          progressRewardRatio: level.tuning.progressRewardRatio
        })
      : resolveCheckoutLevelRuntime(catalogue, shift.id, mission.id, {
          serviceRewardRatio: level.tuning.serviceRewardRatio
        });

    return Object.freeze({
      campaignId: campaign.id,
      index,
      levelNumber: index + 1,
      levelLabel: `LEVEL ${index + 1}`,
      level,
      shift,
      store,
      mission,
      runtime,
      previousLevelId: campaign.levelIds[index - 1],
      nextLevelId: campaign.levelIds[index + 1]
    });
  });

  return Object.freeze({
    campaign,
    levels: Object.freeze(levels)
  });
}

export function resolveCampaignLevel(
  runtime: LevelCampaignRuntime,
  levelId: string
): CampaignLevelRuntime {
  const level = runtime.levels.find((entry) => entry.level.id === levelId);
  if (!level) {
    throw new Error(`Level ${levelId} does not belong to campaign ${runtime.campaign.id}`);
  }
  return level;
}

export function selectCampaignLevel(
  runtime: LevelCampaignRuntime,
  requestedId?: string
): CampaignLevelRuntime {
  if (!requestedId) {
    const first = runtime.levels[0];
    if (!first) throw new Error(`Campaign ${runtime.campaign.id} has no levels`);
    return first;
  }

  const byLevelId = runtime.levels.find((entry) => entry.level.id === requestedId);
  if (byLevelId) return byLevelId;

  const byShiftId = runtime.levels.find((entry) => entry.shift.id === requestedId);
  if (byShiftId) return byShiftId;

  throw new Error(`Level or shift ${requestedId} does not belong to campaign ${runtime.campaign.id}`);
}

const SHARED_STORE_ASSET_KEYS = [
  "fixture-produce-display-a",
  "fixture-backroom-rack-a"
] as const;

const SHARED_WORKER_ASSET_KEYS = [
  "worker-a-walk-01",
  "worker-a-walk-02"
] as const;

export function levelAssetKeys(level: LevelDefinition): readonly string[] {
  if (level.mode === "checkout") {
    return Object.freeze([
      level.assetBindings.environmentAssetKey,
      level.assetBindings.workerAssetKey,
      ...level.assetBindings.customerAssetKeys,
      ...SHARED_STORE_ASSET_KEYS,
      ...SHARED_WORKER_ASSET_KEYS,
      "worker-a-scan-register",
      "fixture-checkout-a",
      "equipment-checkout-scanner",
      "equipment-pos-terminal",
      "equipment-shopping-basket"
    ]);
  }

  const bindings = level.assetBindings;
  return Object.freeze([
    bindings.environmentAssetKey,
    bindings.fixtureAssetKey,
    bindings.workerIdleAssetKey,
    bindings.workerPushAssetKey,
    bindings.workerCarryAssetKey,
    bindings.cartAssetKey,
    bindings.caseAssetKey,
    bindings.productAssetKey,
    ...bindings.ambientProductAssetKeys,
    ...SHARED_STORE_ASSET_KEYS,
    ...SHARED_WORKER_ASSET_KEYS,
    "worker-a-open-case",
    "worker-a-place-middle",
    "equipment-restock-cart-a-loaded",
    "prop-cola-case-open"
  ]);
}

export function validateLevelCampaignRuntime(
  runtime: LevelCampaignRuntime
): readonly string[] {
  const errors: string[] = [];

  if (runtime.levels.length !== runtime.campaign.levelIds.length) {
    errors.push("Level campaign runtime count does not match campaign configuration");
  }

  runtime.levels.forEach((entry, index) => {
    const { level, shift, mission } = entry;

    if (entry.levelNumber !== index + 1 || entry.levelLabel !== `LEVEL ${index + 1}`) {
      errors.push(`Level ${level.id} has an invalid campaign position`);
    }
    if (!shift.missionIds.includes(mission.id)) {
      errors.push(`Level ${level.id} mission does not belong to shift ${shift.id}`);
    }
    if (!Number.isFinite(level.tuning.initialCoins) || level.tuning.initialCoins < 0) {
      errors.push(`Level ${level.id} initial coins must be zero or greater`);
    }
    if (!Number.isFinite(level.navigation.moveSpeed) || level.navigation.moveSpeed <= 0) {
      errors.push(`Level ${level.id} movement speed must be positive`);
    }
    if (
      !Number.isFinite(level.navigation.interactionRadius) ||
      level.navigation.interactionRadius <= 0
    ) {
      errors.push(`Level ${level.id} interaction radius must be positive`);
    }

    if (level.mode === "restock") {
      if (!("product" in entry.runtime)) {
        errors.push(`Level ${level.id} did not resolve a restock runtime`);
        return;
      }
      if (entry.runtime.product.assetKey !== level.assetBindings.productAssetKey) {
        errors.push(`Level ${level.id} product asset does not match product catalogue`);
      }
      return;
    }

    if (!("customerCount" in entry.runtime)) {
      errors.push(`Level ${level.id} did not resolve a checkout runtime`);
      return;
    }
    if (level.assetBindings.customerAssetKeys.length === 0) {
      errors.push(`Level ${level.id} requires at least one customer asset`);
    }
    if (!Number.isFinite(level.tuning.scanDurationMs) || level.tuning.scanDurationMs <= 0) {
      errors.push(`Level ${level.id} scan duration must be positive`);
    }
    if (
      !Number.isFinite(level.tuning.queueAdvanceDurationMs) ||
      level.tuning.queueAdvanceDurationMs <= 0
    ) {
      errors.push(`Level ${level.id} queue advance duration must be positive`);
    }
  });

  return Object.freeze(errors);
}
