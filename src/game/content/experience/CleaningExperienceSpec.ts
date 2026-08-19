import type { LevelDefinition } from "../GameContent";

export interface ClosingSafetyCleaningExperienceSpec {
  readonly kind: "closing-safety";
  readonly spillAssetKeys: readonly string[];
  readonly warningRequiredSpillIndexes: readonly number[];
}

export type CleaningExperienceSpec = ClosingSafetyCleaningExperienceSpec;

const CLEANING_EXPERIENCE_BY_LEVEL_ID: Readonly<Record<string, CleaningExperienceSpec>> = Object.freeze({
  "starter-level-008": Object.freeze({
    kind: "closing-safety",
    spillAssetKeys: Object.freeze([
      "spill-water-large",
      "spill-footprint-large",
      "spill-juice-large",
      "spill-dirt-smear-large",
      "spill-oil-large",
      "spill-trash-smear-large"
    ]),
    warningRequiredSpillIndexes: Object.freeze([0, 2, 4])
  })
});

export function resolveCleaningExperienceSpec(
  level: LevelDefinition
): CleaningExperienceSpec | undefined {
  if (level.mode !== "clean") return undefined;
  return CLEANING_EXPERIENCE_BY_LEVEL_ID[level.id];
}

export function validateCleaningExperienceSpec(
  level: LevelDefinition,
  spec: CleaningExperienceSpec | undefined
): readonly string[] {
  if (!spec) return Object.freeze([]);
  const errors: string[] = [];
  if (level.mode !== "clean") errors.push(`Cleaning experience ${level.id} requires clean mode`);
  if (spec.spillAssetKeys.length === 0) errors.push(`Cleaning experience ${level.id} requires spill assets`);
  if (new Set(spec.spillAssetKeys).size !== spec.spillAssetKeys.length) {
    errors.push(`Cleaning experience ${level.id} requires distinct spill assets`);
  }
  const invalidWarningIndex = spec.warningRequiredSpillIndexes.find((index) => (
    !Number.isInteger(index) || index < 0 || index >= spec.spillAssetKeys.length
  ));
  if (invalidWarningIndex !== undefined) {
    errors.push(`Cleaning experience ${level.id} has invalid warning spill index ${invalidWarningIndex}`);
  }
  if (new Set(spec.warningRequiredSpillIndexes).size !== spec.warningRequiredSpillIndexes.length) {
    errors.push(`Cleaning experience ${level.id} has duplicate warning spill indexes`);
  }
  return Object.freeze(errors);
}
