import type {
  FixtureDefinition,
  GameContentCatalogue,
  MissionDefinition,
  MissionObjectiveDefinition,
  ProductDefinition,
  ShiftDefinition,
  StoreDefinition
} from "../content/GameContent";

export interface RestockShiftRuntimeContent {
  readonly shift: ShiftDefinition;
  readonly store: StoreDefinition;
  readonly mission: MissionDefinition;
  readonly objective: Extract<MissionObjectiveDefinition, { type: "transfer-product" }>;
  readonly product: ProductDefinition;
  readonly fixture: FixtureDefinition;
  readonly slotCount: number;
  readonly unitsPerSlot: number;
  readonly totalUnits: number;
  readonly reward: {
    readonly totalCoins: number;
    readonly totalStars: number;
    readonly coinsPerSlot: number;
    readonly completionCoins: number;
    readonly completionStars: number;
  };
}

export interface ResolveRestockShiftOptions {
  readonly missionId?: string;
  readonly slotCount?: number;
  readonly progressRewardRatio?: number;
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

const assertPositiveInteger = (value: number, label: string): void => {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
};

const transferObjectivesFor = (
  mission: MissionDefinition
): readonly Extract<MissionObjectiveDefinition, { type: "transfer-product" }>[] => (
  mission.objectives.filter(
    (objective): objective is Extract<MissionObjectiveDefinition, { type: "transfer-product" }> => (
      objective.type === "transfer-product"
    )
  )
);

export function resolveRestockShiftRuntime(
  catalogue: GameContentCatalogue,
  shiftId: string,
  options: ResolveRestockShiftOptions = {}
): RestockShiftRuntimeContent {
  const shift = findRequired(catalogue.shifts, shiftId, "shift");
  const store = findRequired(catalogue.stores, shift.storeId, "store");
  const shiftMissions = shift.missionIds.map((missionId) => (
    findRequired(catalogue.missions, missionId, "mission")
  ));

  let mission: MissionDefinition;
  if (options.missionId) {
    if (!shift.missionIds.includes(options.missionId)) {
      throw new Error(`Mission ${options.missionId} does not belong to shift ${shift.id}`);
    }
    mission = findRequired(catalogue.missions, options.missionId, "mission");
  } else {
    const restockMissions = shiftMissions.filter((entry) => transferObjectivesFor(entry).length > 0);
    if (restockMissions.length !== 1) {
      throw new Error(
        `Shift ${shift.id} must contain exactly one restock mission or specify ResolveRestockShiftOptions.missionId`
      );
    }
    mission = restockMissions[0];
  }

  const transferObjectives = transferObjectivesFor(mission);
  if (transferObjectives.length !== 1) {
    throw new Error(`Restock mission ${mission.id} must contain exactly one transfer-product objective`);
  }

  const objective = transferObjectives[0];
  const product = findRequired(catalogue.products, objective.productId, "product");
  const fixture = findRequired(catalogue.fixtures, objective.targetFixtureId, "fixture");

  if (!store.fixtureIds.includes(fixture.id)) {
    throw new Error(`Fixture ${fixture.id} is not placed in store ${store.id}`);
  }

  if (!fixture.acceptedProductCategories.includes(product.category)) {
    throw new Error(`Fixture ${fixture.id} does not accept product category ${product.category}`);
  }

  const totalUnits = objective.amount;
  const slotCount = options.slotCount ?? fixture.slotCount ?? 1;
  assertPositiveInteger(totalUnits, `Mission ${mission.id} transfer amount`);
  assertPositiveInteger(slotCount, `Fixture ${fixture.id} slot count`);

  if (totalUnits % slotCount !== 0) {
    throw new Error(`Mission ${mission.id} amount must divide evenly across ${slotCount} fixture slots`);
  }

  const unitsPerSlot = totalUnits / slotCount;
  const totalCoins = mission.rewards.coins ?? 0;
  const totalStars = mission.rewards.stars ?? 0;
  const progressRewardRatio = options.progressRewardRatio ?? 0.6;

  if (progressRewardRatio < 0 || progressRewardRatio > 1) {
    throw new Error("Restock progress reward ratio must be between 0 and 1");
  }

  const progressCoinPool = Math.floor(totalCoins * progressRewardRatio);
  const coinsPerSlot = Math.floor(progressCoinPool / slotCount);
  const completionCoins = totalCoins - coinsPerSlot * slotCount;

  return Object.freeze({
    shift,
    store,
    mission,
    objective,
    product,
    fixture,
    slotCount,
    unitsPerSlot,
    totalUnits,
    reward: Object.freeze({
      totalCoins,
      totalStars,
      coinsPerSlot,
      completionCoins,
      completionStars: totalStars
    })
  });
}

export function validateRestockShiftRuntime(runtime: RestockShiftRuntimeContent): readonly string[] {
  const errors: string[] = [];

  if (runtime.unitsPerSlot * runtime.slotCount !== runtime.totalUnits) {
    errors.push("Restock slot quantities do not equal the mission transfer amount");
  }

  if (
    runtime.reward.coinsPerSlot * runtime.slotCount + runtime.reward.completionCoins !==
    runtime.reward.totalCoins
  ) {
    errors.push("Restock staged coin rewards do not equal the mission coin reward");
  }

  if (runtime.reward.completionStars !== runtime.reward.totalStars) {
    errors.push("Restock completion stars do not equal the mission star reward");
  }

  if (runtime.objective.productId !== runtime.product.id) {
    errors.push("Restock objective product does not match the resolved product");
  }

  if (runtime.objective.targetFixtureId !== runtime.fixture.id) {
    errors.push("Restock objective fixture does not match the resolved fixture");
  }

  if (!runtime.shift.missionIds.includes(runtime.mission.id)) {
    errors.push("Restock mission does not belong to its resolved shift");
  }

  return Object.freeze(errors);
}
