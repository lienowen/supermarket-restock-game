import type {
  FixtureDefinition,
  GameContentCatalogue,
  MissionDefinition,
  MissionObjectiveDefinition,
  ShiftDefinition,
  StoreDefinition
} from "../content/GameContent";

export interface CheckoutLevelRuntimeContent {
  readonly shift: ShiftDefinition;
  readonly store: StoreDefinition;
  readonly mission: MissionDefinition;
  readonly objective: Extract<MissionObjectiveDefinition, { type: "operate-checkout" }>;
  readonly fixture: FixtureDefinition;
  readonly customerCount: number;
  readonly reward: {
    readonly totalCoins: number;
    readonly totalStars: number;
    readonly totalReputation: number;
    readonly coinsPerCustomer: number;
    readonly completionCoins: number;
  };
}

export interface ResolveCheckoutLevelOptions {
  readonly serviceRewardRatio?: number;
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

export function resolveCheckoutLevelRuntime(
  catalogue: GameContentCatalogue,
  shiftId: string,
  missionId: string,
  options: ResolveCheckoutLevelOptions = {}
): CheckoutLevelRuntimeContent {
  const shift = findRequired(catalogue.shifts, shiftId, "shift");
  const store = findRequired(catalogue.stores, shift.storeId, "store");

  if (!shift.missionIds.includes(missionId)) {
    throw new Error(`Mission ${missionId} does not belong to shift ${shift.id}`);
  }

  const mission = findRequired(catalogue.missions, missionId, "mission");
  const objectives = mission.objectives.filter(
    (objective): objective is Extract<MissionObjectiveDefinition, { type: "operate-checkout" }> => (
      objective.type === "operate-checkout"
    )
  );

  if (objectives.length !== 1) {
    throw new Error(`Checkout mission ${mission.id} must contain exactly one operate-checkout objective`);
  }

  const objective = objectives[0];
  const fixture = findRequired(catalogue.fixtures, objective.checkoutId, "checkout fixture");
  if (fixture.kind !== "checkout") {
    throw new Error(`Checkout mission ${mission.id} target ${fixture.id} is not a checkout fixture`);
  }
  if (!store.fixtureIds.includes(fixture.id)) {
    throw new Error(`Checkout fixture ${fixture.id} is not placed in store ${store.id}`);
  }
  if (!Number.isInteger(objective.customerCount) || objective.customerCount <= 0) {
    throw new Error(`Checkout mission ${mission.id} customer count must be a positive integer`);
  }

  const serviceRewardRatio = options.serviceRewardRatio ?? 0.75;
  if (serviceRewardRatio < 0 || serviceRewardRatio > 1) {
    throw new Error("Checkout service reward ratio must be between 0 and 1");
  }

  const totalCoins = mission.rewards.coins ?? 0;
  const serviceCoinPool = Math.floor(totalCoins * serviceRewardRatio);
  const coinsPerCustomer = Math.floor(serviceCoinPool / objective.customerCount);
  const completionCoins = totalCoins - coinsPerCustomer * objective.customerCount;

  return Object.freeze({
    shift,
    store,
    mission,
    objective,
    fixture,
    customerCount: objective.customerCount,
    reward: Object.freeze({
      totalCoins,
      totalStars: mission.rewards.stars ?? 0,
      totalReputation: mission.rewards.reputation ?? 0,
      coinsPerCustomer,
      completionCoins
    })
  });
}

export function validateCheckoutLevelRuntime(
  runtime: CheckoutLevelRuntimeContent
): readonly string[] {
  const errors: string[] = [];

  if (runtime.fixture.kind !== "checkout") {
    errors.push("Checkout runtime fixture must have checkout kind");
  }
  if (runtime.objective.checkoutId !== runtime.fixture.id) {
    errors.push("Checkout objective fixture does not match resolved checkout fixture");
  }
  if (!runtime.shift.missionIds.includes(runtime.mission.id)) {
    errors.push("Checkout mission does not belong to its resolved shift");
  }
  if (
    runtime.reward.coinsPerCustomer * runtime.customerCount + runtime.reward.completionCoins !==
    runtime.reward.totalCoins
  ) {
    errors.push("Checkout staged coin rewards do not equal mission coin reward");
  }

  return Object.freeze(errors);
}
