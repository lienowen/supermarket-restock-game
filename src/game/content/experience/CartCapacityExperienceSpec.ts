import type { LevelDefinition } from "../GameContent";

export type CartCaseSize = "small" | "medium" | "large";

export interface CartCaseOptionSpec {
  readonly id: string;
  readonly label: string;
  readonly assetKey: string;
  readonly size: CartCaseSize;
}

export interface CartCapacityLaneSpec {
  readonly id: string;
  readonly label: string;
  readonly acceptsSize: CartCaseSize;
}

export interface CartCapacityExperienceSpec {
  readonly levelId: string;
  readonly mode: "restock";
  readonly unlockAfterAction: string;
  readonly confirmAction: string;
  readonly eyebrow: string;
  readonly title: string;
  readonly instruction: string;
  readonly roundsRequired: number;
  readonly targetLabel: string;
  readonly targetAssetKey: string;
  readonly loadedTargetAssetKey: string;
  readonly lanes: readonly CartCapacityLaneSpec[];
  readonly options: readonly CartCaseOptionSpec[];
}

export const CART_CAPACITY_EXPERIENCE_SPECS: readonly CartCapacityExperienceSpec[] = Object.freeze([
  Object.freeze({
    levelId: "starter-level-006",
    mode: "restock" as const,
    unlockAfterAction: "PICK_BOX",
    confirmAction: "LOAD_CART",
    eyebrow: "CART CAPACITY",
    title: "Load the evening delivery",
    instruction: "Match each delivery box to the cart bay that fits its size. Build two complete loads with no wasted space.",
    roundsRequired: 2,
    targetLabel: "CAPACITY CART · 3 BAYS",
    targetAssetKey: "equipment-capacity-cart-empty",
    loadedTargetAssetKey: "equipment-capacity-cart-loaded",
    lanes: Object.freeze([
      Object.freeze({ id: "large-bay", label: "LARGE BAY", acceptsSize: "large" as const }),
      Object.freeze({ id: "medium-bay", label: "MEDIUM BAY", acceptsSize: "medium" as const }),
      Object.freeze({ id: "small-bay", label: "SMALL BAY", acceptsSize: "small" as const })
    ]),
    options: Object.freeze([
      Object.freeze({
        id: "delivery-small-a",
        label: "SMALL BOX A",
        assetKey: "delivery-box-small",
        size: "small" as const
      }),
      Object.freeze({
        id: "delivery-large-a",
        label: "LARGE BOX A",
        assetKey: "delivery-box-large",
        size: "large" as const
      }),
      Object.freeze({
        id: "delivery-medium-a",
        label: "MEDIUM BOX A",
        assetKey: "delivery-box-medium",
        size: "medium" as const
      }),
      Object.freeze({
        id: "delivery-medium-b",
        label: "MEDIUM BOX B",
        assetKey: "delivery-box-medium",
        size: "medium" as const
      }),
      Object.freeze({
        id: "delivery-small-b",
        label: "SMALL BOX B",
        assetKey: "delivery-box-small",
        size: "small" as const
      }),
      Object.freeze({
        id: "delivery-large-b",
        label: "LARGE BOX B",
        assetKey: "delivery-box-large",
        size: "large" as const
      })
    ])
  })
]);

const BY_LEVEL_ID: ReadonlyMap<string, CartCapacityExperienceSpec> = new Map(
  CART_CAPACITY_EXPERIENCE_SPECS.map((spec) => [spec.levelId, spec])
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

  CART_CAPACITY_EXPERIENCE_SPECS.forEach((spec) => {
    if (!levelIds.has(spec.levelId)) errors.push(`Cart capacity spec references missing level: ${spec.levelId}`);
    if (!Number.isInteger(spec.roundsRequired) || spec.roundsRequired < 2) {
      errors.push(`Cart capacity spec ${spec.levelId} requires at least two loads`);
    }
    if (spec.lanes.length < 3) {
      errors.push(`Cart capacity spec ${spec.levelId} requires at least three capacity bays`);
    }
    if (new Set(spec.lanes.map((lane) => lane.id)).size !== spec.lanes.length) {
      errors.push(`Cart capacity spec ${spec.levelId} has duplicate lane ids`);
    }
    if (new Set(spec.options.map((option) => option.id)).size !== spec.options.length) {
      errors.push(`Cart capacity spec ${spec.levelId} has duplicate case option ids`);
    }
    if (spec.options.length !== spec.lanes.length * spec.roundsRequired) {
      errors.push(`Cart capacity spec ${spec.levelId} must provide one box per lane for every load`);
    }
    spec.lanes.forEach((lane) => {
      if (!lane.label.trim()) errors.push(`Cart capacity lane ${lane.id} requires a label`);
      const matchingCases = spec.options.filter((option) => option.size === lane.acceptsSize);
      if (matchingCases.length !== spec.roundsRequired) {
        errors.push(`Cart capacity lane ${lane.id} requires one matching box per load`);
      }
    });
    spec.options.forEach((option) => {
      if (!option.label.trim()) errors.push(`Cart capacity option ${option.id} requires a label`);
      if (!option.assetKey.trim()) errors.push(`Cart capacity option ${option.id} requires an asset key`);
    });
    if (!spec.targetAssetKey.trim() || !spec.loadedTargetAssetKey.trim()) {
      errors.push(`Cart capacity spec ${spec.levelId} requires empty and loaded cart assets`);
    }
  });

  return Object.freeze(errors);
}
