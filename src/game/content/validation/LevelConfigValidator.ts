import { resolveGlobalAssetPack } from "../../assets/GlobalAssetPackRegistry";
import { registeredGameplayModes } from "../../application/GameplayModeRegistry";
import { resolveLevelVisualPreset } from "../../presentation/visual/LevelVisualPresetResolver";
import { EMPTY_RULE_COMPONENT_REGISTRY } from "../../rules/RuleComponentRegistry";
import {
  CURRENT_LEVEL_SCHEMA_VERSION,
  type LevelDefinition
} from "../GameContent";

const asErrorMessage = (error: unknown): string => (
  error instanceof Error ? error.message : String(error)
);

export function validateLevelDefinitions(
  levels: readonly LevelDefinition[]
): readonly string[] {
  const errors: string[] = [];
  const levelIds = new Set<string>();
  const registeredModes = new Set(registeredGameplayModes());

  levels.forEach((level) => {
    const prefix = `Level ${level.id || "<missing>"}`;
    if (level.schemaVersion !== CURRENT_LEVEL_SCHEMA_VERSION) {
      errors.push(`${prefix} uses unsupported schema version ${level.schemaVersion}`);
    }
    if (!level.id.trim()) errors.push("Level id is required");
    if (levelIds.has(level.id)) errors.push(`Duplicate level id: ${level.id}`);
    levelIds.add(level.id);
    if (!level.shiftId.trim()) errors.push(`${prefix} requires a shift id`);
    if (!level.missionId.trim()) errors.push(`${prefix} requires a mission id`);
    if (!level.title.trim()) errors.push(`${prefix} requires a title`);
    if (!level.randomSeed.trim()) errors.push(`${prefix} requires a reproducible random seed`);
    if (!registeredModes.has(level.mode)) errors.push(`${prefix} uses unregistered mode ${level.mode}`);

    try {
      resolveGlobalAssetPack(level.presentation.assetPackId, level.mode);
    } catch (error) {
      errors.push(`${prefix}: ${asErrorMessage(error)}`);
    }

    try {
      resolveLevelVisualPreset(level);
    } catch (error) {
      errors.push(`${prefix}: ${asErrorMessage(error)}`);
    }

    EMPTY_RULE_COMPONENT_REGISTRY.validate(level.rules).forEach((error) => (
      errors.push(`${prefix}: ${error}`)
    ));

    if (!Number.isFinite(level.navigation.moveSpeed) || level.navigation.moveSpeed <= 0) {
      errors.push(`${prefix} movement speed must be positive`);
    }
    if (!Number.isFinite(level.navigation.interactionRadius) || level.navigation.interactionRadius <= 0) {
      errors.push(`${prefix} interaction radius must be positive`);
    }
    if (!Number.isFinite(level.tuning.initialCoins) || level.tuning.initialCoins < 0) {
      errors.push(`${prefix} initial coins must be zero or greater`);
    }
  });

  return Object.freeze(errors);
}
