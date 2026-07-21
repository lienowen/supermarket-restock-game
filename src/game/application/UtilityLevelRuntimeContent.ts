import type {
  FindItemTargetDefinition,
  FixtureDefinition,
  GameContentCatalogue,
  MissionDefinition,
  MissionObjectiveDefinition,
  ProductDefinition,
  ShiftDefinition,
  StoreDefinition
} from "../content/GameContent";

interface BaseUtilityRuntime {
  readonly shift: ShiftDefinition;
  readonly store: StoreDefinition;
  readonly mission: MissionDefinition;
  readonly reward: {
    readonly totalCoins: number;
    readonly totalStars: number;
    readonly totalReputation: number;
  };
}

export interface CleanLevelRuntimeContent extends BaseUtilityRuntime {
  readonly mode: "clean";
  readonly objective: Extract<MissionObjectiveDefinition, { type: "clean-zone" }>;
  readonly spotCount: number;
  readonly cleanDurationMs: number;
  readonly toolPoint: { readonly x: number; readonly y: number };
  readonly spotPositions: readonly { readonly x: number; readonly y: number }[];
}

export interface FindItemsLevelRuntimeContent extends BaseUtilityRuntime {
  readonly mode: "find-items";
  readonly objective: Extract<MissionObjectiveDefinition, { type: "find-items" }>;
  readonly fixture: FixtureDefinition;
  readonly products: readonly ProductDefinition[];
  readonly itemTargets: readonly FindItemTargetDefinition[];
  readonly timeLimitSeconds: number;
  readonly mistakePenaltySeconds: number;
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

const baseRuntime = (
  catalogue: GameContentCatalogue,
  shiftId: string,
  missionId: string
): {
  readonly shift: ShiftDefinition;
  readonly store: StoreDefinition;
  readonly mission: MissionDefinition;
  readonly reward: BaseUtilityRuntime["reward"];
} => {
  const shift = findRequired(catalogue.shifts, shiftId, "shift");
  const store = findRequired(catalogue.stores, shift.storeId, "store");
  if (!shift.missionIds.includes(missionId)) {
    throw new Error(`Mission ${missionId} does not belong to shift ${shift.id}`);
  }
  const mission = findRequired(catalogue.missions, missionId, "mission");
  return Object.freeze({
    shift,
    store,
    mission,
    reward: Object.freeze({
      totalCoins: mission.rewards.coins ?? 0,
      totalStars: mission.rewards.stars ?? 0,
      totalReputation: mission.rewards.reputation ?? 0
    })
  });
};

export function resolveCleanLevelRuntime(
  catalogue: GameContentCatalogue,
  shiftId: string,
  missionId: string,
  options: {
    readonly cleanDurationMs: number;
    readonly toolPoint: { readonly x: number; readonly y: number };
    readonly spotPositions: readonly { readonly x: number; readonly y: number }[];
  }
): CleanLevelRuntimeContent {
  const base = baseRuntime(catalogue, shiftId, missionId);
  const objectives = base.mission.objectives.filter(
    (objective): objective is Extract<MissionObjectiveDefinition, { type: "clean-zone" }> => (
      objective.type === "clean-zone"
    )
  );
  if (objectives.length !== 1) {
    throw new Error(`Clean mission ${base.mission.id} must contain exactly one clean-zone objective`);
  }
  const objective = objectives[0];
  if (objective.amount !== options.spotPositions.length) {
    throw new Error(`Clean mission ${base.mission.id} spot count does not match level tuning`);
  }
  return Object.freeze({
    ...base,
    mode: "clean" as const,
    objective,
    spotCount: objective.amount,
    cleanDurationMs: options.cleanDurationMs,
    toolPoint: Object.freeze({ ...options.toolPoint }),
    spotPositions: Object.freeze(options.spotPositions.map((point) => Object.freeze({ ...point })))
  });
}

export function resolveFindItemsLevelRuntime(
  catalogue: GameContentCatalogue,
  shiftId: string,
  missionId: string,
  options: {
    readonly itemTargets: readonly FindItemTargetDefinition[];
    readonly timeLimitSeconds: number;
    readonly mistakePenaltySeconds: number;
  }
): FindItemsLevelRuntimeContent {
  const base = baseRuntime(catalogue, shiftId, missionId);
  const objectives = base.mission.objectives.filter(
    (objective): objective is Extract<MissionObjectiveDefinition, { type: "find-items" }> => (
      objective.type === "find-items"
    )
  );
  if (objectives.length !== 1) {
    throw new Error(`Find-items mission ${base.mission.id} must contain exactly one find-items objective`);
  }
  const objective = objectives[0];
  const fixture = findRequired(catalogue.fixtures, objective.fixtureId, "find-items fixture");
  if (!base.store.fixtureIds.includes(fixture.id)) {
    throw new Error(`Find-items fixture ${fixture.id} is not placed in store ${base.store.id}`);
  }
  const products = objective.productIds.map((productId) => (
    findRequired(catalogue.products, productId, "find-items product")
  ));
  if (options.itemTargets.length !== products.length) {
    throw new Error(`Find-items mission ${base.mission.id} target count does not match products`);
  }
  for (const target of options.itemTargets) {
    if (!objective.productIds.includes(target.productId)) {
      throw new Error(`Find-items target uses unrequested product ${target.productId}`);
    }
  }
  return Object.freeze({
    ...base,
    mode: "find-items" as const,
    objective,
    fixture,
    products: Object.freeze(products),
    itemTargets: Object.freeze(options.itemTargets.map((target) => Object.freeze({ ...target }))),
    timeLimitSeconds: options.timeLimitSeconds,
    mistakePenaltySeconds: options.mistakePenaltySeconds
  });
}

export function validateUtilityLevelRuntime(
  runtime: CleanLevelRuntimeContent | FindItemsLevelRuntimeContent
): readonly string[] {
  const errors: string[] = [];
  if (!runtime.shift.missionIds.includes(runtime.mission.id)) {
    errors.push("Utility mission does not belong to its resolved shift");
  }
  if (runtime.mode === "clean") {
    if (runtime.spotPositions.length !== runtime.spotCount) {
      errors.push("Clean spot positions must match clean objective amount");
    }
    if (runtime.cleanDurationMs <= 0) errors.push("Clean duration must be positive");
  } else {
    if (runtime.products.length !== runtime.itemTargets.length) {
      errors.push("Find-items products and targets must have equal length");
    }
    if (runtime.timeLimitSeconds <= 0) errors.push("Find-items time limit must be positive");
  }
  return Object.freeze(errors);
}
