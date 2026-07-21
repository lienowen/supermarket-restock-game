import type {
  CampaignDefinition,
  GameContentCatalogue,
  LevelDefinition,
  MissionDefinition,
  ShiftDefinition,
  StoreDefinition
} from "../content/GameContent";
import {
  registeredGameplayModes,
  resolveGameplayRuntime,
  type PlayableLevelRuntimeContent
} from "./GameplayModeRegistry";

export type { PlayableLevelRuntimeContent } from "./GameplayModeRegistry";

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

    const runtime = resolveGameplayRuntime(catalogue, level, shift, mission);

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

const validatePositiveOptional = (
  errors: string[],
  levelId: string,
  label: string,
  value: number | undefined
): void => {
  if (value !== undefined && (!Number.isFinite(value) || value <= 0)) {
    errors.push(`Level ${levelId} ${label} must be positive`);
  }
};

export function validateLevelCampaignRuntime(
  runtime: LevelCampaignRuntime
): readonly string[] {
  const errors: string[] = [];
  const registeredModes = new Set(registeredGameplayModes());

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
    if (!registeredModes.has(level.mode)) {
      errors.push(`Level ${level.id} mode ${level.mode} has no registered gameplay resolver`);
    }
    if (!level.presentation.assetPackId.trim()) {
      errors.push(`Level ${level.id} requires a global asset pack id`);
    }
    if (!level.presentation.visualPresetId.trim()) {
      errors.push(`Level ${level.id} requires a visual preset id`);
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

    switch (level.mode) {
      case "restock": {
        if (!("product" in entry.runtime)) {
          errors.push(`Level ${level.id} did not resolve a restock runtime`);
        }
        const rush = level.tuning.rush;
        if (rush) {
          validatePositiveOptional(errors, level.id, "rush target duration", rush.targetDurationMs);
          validatePositiveOptional(
            errors,
            level.id,
            "rush minimum target duration",
            rush.minimumTargetDurationMs
          );
          validatePositiveOptional(errors, level.id, "rush speed-up", rush.speedUpPerSuccessMs);
          validatePositiveOptional(errors, level.id, "rush streak window", rush.streakWindowMs);
          validatePositiveOptional(errors, level.id, "rush gold time", rush.goldTimeMs);
          validatePositiveOptional(errors, level.id, "rush silver time", rush.silverTimeMs);
          if (
            rush.targetDurationMs !== undefined &&
            rush.minimumTargetDurationMs !== undefined &&
            rush.minimumTargetDurationMs > rush.targetDurationMs
          ) {
            errors.push(`Level ${level.id} rush minimum target duration exceeds its starting duration`);
          }
          if (
            rush.goldTimeMs !== undefined &&
            rush.silverTimeMs !== undefined &&
            rush.goldTimeMs >= rush.silverTimeMs
          ) {
            errors.push(`Level ${level.id} rush gold time must be lower than silver time`);
          }
        }
        return;
      }
      case "checkout":
        if (!("customerCount" in entry.runtime)) {
          errors.push(`Level ${level.id} did not resolve a checkout runtime`);
        }
        if (!Number.isFinite(level.tuning.scanDurationMs) || level.tuning.scanDurationMs <= 0) {
          errors.push(`Level ${level.id} scan duration must be positive`);
        }
        return;
      case "clean":
        if (!("spotCount" in entry.runtime)) {
          errors.push(`Level ${level.id} did not resolve a clean runtime`);
        }
        if (level.tuning.spotPositions.length === 0) {
          errors.push(`Level ${level.id} requires clean spot positions`);
        }
        return;
      case "find-items":
        if (!("products" in entry.runtime)) {
          errors.push(`Level ${level.id} did not resolve a find-items runtime`);
        }
        if (level.tuning.itemTargets.length === 0) {
          errors.push(`Level ${level.id} requires item targets`);
        }
        return;
    }
  });

  return Object.freeze(errors);
}
