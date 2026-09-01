import type { AssetDescriptor } from "./AssetDescriptor";
import type { RuntimeAssetRegistry } from "./RuntimeAssetRegistry";
import { STAFF_GROWTH_ASSET_KEYS, type StaffGrowthAssetKeys } from "./StaffGrowthAssetCatalogue";
import { rankForLevelId } from "../application/StaffProgression";

export interface ResolvedStaffGrowthAssets {
  readonly rankTitle: string;
  readonly keys?: StaffGrowthAssetKeys;
  readonly preload: readonly AssetDescriptor[];
}

export function resolveStaffGrowthAssets(
  registry: RuntimeAssetRegistry,
  levelId: string
): ResolvedStaffGrowthAssets {
  const rank = rankForLevelId(levelId);
  if (rank.id === "trainee") {
    return Object.freeze({
      rankTitle: rank.title,
      preload: Object.freeze([])
    });
  }

  const keys = STAFF_GROWTH_ASSET_KEYS[rank.id];
  return Object.freeze({
    rankTitle: rank.title,
    keys,
    preload: registry.resolve([keys.idle, keys.carry, keys.place, keys.push])
  });
}
