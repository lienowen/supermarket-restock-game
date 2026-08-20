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
  /** Legacy size metadata kept for content validation; Level 6 presents one shared cart capacity. */
  readonly lanes: readonly CartCapacityLaneSpec[];
  readonly options: readonly CartCaseOptionSpec[];
  readonly autoStart: boolean;
  readonly requiredSizesPerOrder: readonly CartCaseSize[];
}

export const CART_CAPACITY_EXPERIENCE_SPECS: readonly CartCapacityExperienceSpec[] = Object.freeze([
  Object.freeze({
    levelId: "starter-level-006",
    mode: "restock" as const,
    unlockAfterAction: "PICK_BOX",
    confirmAction: "LOAD_CART",
    eyebrow: "OUTBOUND DISPATCH",
    title: "Load two chilled orders",
    instruction: "Each order requires one LARGE, one MEDIUM and one SMALL case. Fit exactly 6/6 spaces, verify the load, then dispatch the truck.",
    roundsRequired: 2,
    targetLabel: "OUTBOUND TRUCK · 6 SPACES",
    targetAssetKey: "equipment-capacity-cart-empty",
    loadedTargetAssetKey: "equipment-capacity-cart-loaded",
    autoStart: true,
    requiredSizesPerOrder: Object.freeze(["large" as const, "medium" as const, "small" as const]),
    lanes: Object.freeze([
      Object.freeze({ id: "large-bay", label: "3 SPACE CASE", acceptsSize: "large" as const }),
      Object.freeze({ id: "medium-bay", label: "2 SPACE CASE", acceptsSize: "medium" as const }),
      Object.freeze({ id: "small-bay", label: "1 SPACE CASE", acceptsSize: "small" as const })
    ]),
    options: Object.freeze([
      Object.freeze({
        id: "delivery-small-a",
        label: "CASE A",
        assetKey: "delivery-box-small",
        size: "small" as const
      }),
      Object.freeze({
        id: "delivery-large-a",
        label: "CASE B",
        assetKey: "delivery-box-large",
        size: "large" as const
      }),
      Object.freeze({
        id: "delivery-medium-a",
        label: "CASE C",
        assetKey: "delivery-box-medium",
        size: "medium" as const
      }),
      Object.freeze({
        id: "delivery-medium-b",
        label: "CASE D",
        assetKey: "delivery-box-medium",
        size: "medium" as const
      }),
      Object.freeze({
        id: "delivery-small-b",
        label: "CASE E",
        assetKey: "delivery-box-small",
        size: "small" as const
      }),
      Object.freeze({
        id: "delivery-large-b",
        label: "CASE F",
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

export function isDispatchOrderValid(
  loadedSizes: readonly CartCaseSize[],
  requiredSizes: readonly CartCaseSize[]
): boolean {
  const units: Readonly<Record<CartCaseSize, number>> = Object.freeze({ small: 1, medium: 2, large: 3 });
  return loadedSizes.reduce((total, size) => total + units[size], 0) === 6 &&
    loadedSizes.length === requiredSizes.length &&
    requiredSizes.every((size) => loadedSizes.filter((loaded) => loaded === size).length === 1);
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
      errors.push(`Cart capacity spec ${spec.levelId} requires at least three case size definitions`);
    }
    if (new Set(spec.lanes.map((lane) => lane.id)).size !== spec.lanes.length) {
      errors.push(`Cart capacity spec ${spec.levelId} has duplicate lane ids`);
    }
    if (new Set(spec.options.map((option) => option.id)).size !== spec.options.length) {
      errors.push(`Cart capacity spec ${spec.levelId} has duplicate case option ids`);
    }
    if (spec.options.length !== spec.lanes.length * spec.roundsRequired) {
      errors.push(`Cart capacity spec ${spec.levelId} must provide two cases of each capacity size`);
    }
    spec.lanes.forEach((lane) => {
      if (!lane.label.trim()) errors.push(`Cart capacity lane ${lane.id} requires a label`);
      const matchingCases = spec.options.filter((option) => option.size === lane.acceptsSize);
      if (matchingCases.length !== spec.roundsRequired) {
        errors.push(`Cart capacity size ${lane.id} requires one matching box per trip`);
      }
    });
    spec.options.forEach((option) => {
      if (!option.label.trim()) errors.push(`Cart capacity option ${option.id} requires a label`);
      if (!option.assetKey.trim()) errors.push(`Cart capacity option ${option.id} requires an asset key`);
    });
    if (!spec.targetAssetKey.trim() || !spec.loadedTargetAssetKey.trim()) {
      errors.push(`Cart capacity spec ${spec.levelId} requires empty and loaded cart assets`);
    }
    if (new Set(spec.requiredSizesPerOrder).size !== 3) {
      errors.push(`Cart capacity spec ${spec.levelId} requires one small, medium and large case per order`);
    }
  });

  return Object.freeze(errors);
}
