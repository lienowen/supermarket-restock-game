import type { LevelDefinition } from "../GameContent";

export interface CartCaseOptionSpec {
  readonly id: string;
  readonly label: string;
  readonly assetKey: string;
  readonly accepted: boolean;
}

export interface CartCapacityExperienceSpec {
  readonly levelId: string;
  readonly mode: "restock";
  readonly unlockAfterAction: string;
  readonly confirmAction: string;
  readonly eyebrow: string;
  readonly title: string;
  readonly instruction: string;
  readonly capacity: number;
  readonly targetLabel: string;
  readonly options: readonly CartCaseOptionSpec[];
}

const SPECS: readonly CartCapacityExperienceSpec[] = Object.freeze([
  Object.freeze({
    levelId: "starter-level-006",
    mode: "restock" as const,
    unlockAfterAction: "PICK_BOX",
    confirmAction: "LOAD_CART",
    eyebrow: "CART CAPACITY",
    title: "Load the closing stock",
    instruction: "The cart holds two cases. Load both cola cases and leave the water case in the backroom.",
    capacity: 2,
    targetLabel: "2-CASE RESTOCK CART",
    options: Object.freeze([
      Object.freeze({
        id: "closing-cola-a",
        label: "COLA CASE A",
        assetKey: "prop-cola-case-closed",
        accepted: true
      }),
      Object.freeze({
        id: "closing-water-decoy",
        label: "WATER CASE",
        assetKey: "prop-water-case-closed",
        accepted: false
      }),
      Object.freeze({
        id: "closing-cola-b",
        label: "COLA CASE B",
        assetKey: "prop-cola-case-closed",
        accepted: true
      })
    ])
  })
]);

const BY_LEVEL_ID: ReadonlyMap<string, CartCapacityExperienceSpec> = new Map(
  SPECS.map((spec) => [spec.levelId, spec])
);

export function resolveCartCapacityExperienceSpec(
  level: LevelDefinition
): CartCapacityExperienceSpec | undefined {
  const spec = BY_LEVEL_ID.get(level.id);
  if (!spec) return undefined;
  if (level.mode !== spec.mode) {
    throw new Error(`Cart capacity spec ${spec.levelId} expects ${spec.mode}, received ${level.mode}`);
  }
  return spec;
}

export function validateCartCapacityExperienceSpecs(
  levels: readonly LevelDefinition[]
): readonly string[] {
  const errors: string[] = [];
  const levelIds = new Set(levels.map((level) => level.id));

  SPECS.forEach((spec) => {
    if (!levelIds.has(spec.levelId)) errors.push(`Cart capacity spec references missing level: ${spec.levelId}`);
    if (!Number.isInteger(spec.capacity) || spec.capacity < 2) {
      errors.push(`Cart capacity spec ${spec.levelId} requires capacity of at least two`);
    }
    const accepted = spec.options.filter((option) => option.accepted);
    const rejected = spec.options.filter((option) => !option.accepted);
    if (accepted.length !== spec.capacity) {
      errors.push(`Cart capacity spec ${spec.levelId} accepted case count must equal cart capacity`);
    }
    if (rejected.length === 0) errors.push(`Cart capacity spec ${spec.levelId} requires at least one wrong case`);
    if (new Set(spec.options.map((option) => option.id)).size !== spec.options.length) {
      errors.push(`Cart capacity spec ${spec.levelId} has duplicate case option ids`);
    }
    spec.options.forEach((option) => {
      if (!option.label.trim()) errors.push(`Cart capacity option ${option.id} requires a label`);
      if (!option.assetKey.trim()) errors.push(`Cart capacity option ${option.id} requires an asset key`);
    });
  });

  return Object.freeze(errors);
}
