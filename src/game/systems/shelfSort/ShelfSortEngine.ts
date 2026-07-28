export const SHELF_BAY_CAPACITY = 3 as const;

export type ShelfSortProductId = string;
export type ShelfSortStatus = "playing" | "complete" | "failed";

export interface ShelfBayDefinition {
  readonly id: string;
  /** Back-to-front order. The last item is the movable front item. */
  readonly items: readonly ShelfSortProductId[];
  readonly locked?: boolean;
}

export interface ShelfSortRewardDefinition {
  readonly coins: number;
  readonly stars: 1 | 2 | 3;
}

export interface ShelfSortLevelDefinition {
  readonly id: string;
  readonly title: string;
  readonly layoutId: "2x2" | "3x2" | "3x3" | "4x3" | "3x5";
  readonly bays: readonly ShelfBayDefinition[];
  readonly moveLimit?: number;
  readonly targetSetCount: number;
  readonly reward: ShelfSortRewardDefinition;
}

export interface ShelfBayState {
  readonly id: string;
  readonly items: readonly ShelfSortProductId[];
  readonly locked: boolean;
}

export interface ShelfSortState {
  readonly levelId: string;
  readonly bays: readonly ShelfBayState[];
  readonly moves: number;
  readonly completedSets: number;
  readonly score: number;
  readonly status: ShelfSortStatus;
  readonly moveLimit?: number;
  readonly targetSetCount: number;
}

export type ShelfMoveRejectReason =
  | "level-not-playing"
  | "same-bay"
  | "unknown-source"
  | "unknown-destination"
  | "source-locked"
  | "destination-locked"
  | "source-empty"
  | "destination-full";

export interface ShelfMoveResult {
  readonly accepted: boolean;
  readonly state: ShelfSortState;
  readonly reason?: ShelfMoveRejectReason;
  readonly movedProductId?: ShelfSortProductId;
  readonly clearedProductId?: ShelfSortProductId;
}

export interface ShelfMoveCandidate {
  readonly fromBayId: string;
  readonly toBayId: string;
  readonly productId: ShelfSortProductId;
}

const freezeBay = (bay: ShelfBayState): ShelfBayState => Object.freeze({
  id: bay.id,
  items: Object.freeze([...bay.items]),
  locked: bay.locked
});

const freezeState = (state: ShelfSortState): ShelfSortState => Object.freeze({
  ...state,
  bays: Object.freeze(state.bays.map(freezeBay))
});

const nonEmpty = (value: string): boolean => value.trim().length > 0;

const productCounts = (level: ShelfSortLevelDefinition): ReadonlyMap<string, number> => {
  const counts = new Map<string, number>();
  for (const bay of level.bays) {
    for (const productId of bay.items) {
      counts.set(productId, (counts.get(productId) ?? 0) + 1);
    }
  }
  return counts;
};

export function validateShelfSortLevel(level: ShelfSortLevelDefinition): readonly string[] {
  const errors: string[] = [];
  const bayIds = new Set<string>();

  if (!nonEmpty(level.id)) errors.push("Shelf-sort level id is required");
  if (!nonEmpty(level.title)) errors.push(`${level.id || "Shelf-sort level"} title is required`);
  if (level.bays.length < 4) errors.push(`${level.id} requires at least four shelf bays`);
  if (level.targetSetCount < 1) errors.push(`${level.id} targetSetCount must be positive`);
  if (level.moveLimit !== undefined && level.moveLimit < 1) {
    errors.push(`${level.id} moveLimit must be positive when configured`);
  }

  let availableSlots = 0;
  for (const bay of level.bays) {
    if (!nonEmpty(bay.id)) errors.push(`${level.id} contains a bay without an id`);
    if (bayIds.has(bay.id)) errors.push(`${level.id} contains duplicate bay id ${bay.id}`);
    bayIds.add(bay.id);

    if (bay.items.length > SHELF_BAY_CAPACITY) {
      errors.push(`${level.id}/${bay.id} exceeds the ${SHELF_BAY_CAPACITY}-item bay capacity`);
    }
    availableSlots += SHELF_BAY_CAPACITY - bay.items.length;

    for (const productId of bay.items) {
      if (!nonEmpty(productId)) errors.push(`${level.id}/${bay.id} contains an empty product id`);
    }
  }

  if (availableSlots < SHELF_BAY_CAPACITY) {
    errors.push(`${level.id} needs at least one full empty bay of working space`);
  }

  const counts = productCounts(level);
  let expectedSetCount = 0;
  for (const [productId, count] of counts) {
    if (count % SHELF_BAY_CAPACITY !== 0) {
      errors.push(`${level.id} product ${productId} count ${count} is not divisible by ${SHELF_BAY_CAPACITY}`);
    }
    expectedSetCount += count / SHELF_BAY_CAPACITY;
  }

  if (expectedSetCount !== level.targetSetCount) {
    errors.push(
      `${level.id} targetSetCount ${level.targetSetCount} does not match product inventory ${expectedSetCount}`
    );
  }

  if (level.reward.coins < 0) errors.push(`${level.id} coin reward cannot be negative`);
  return Object.freeze(errors);
}

export function createShelfSortState(level: ShelfSortLevelDefinition): ShelfSortState {
  const errors = validateShelfSortLevel(level);
  if (errors.length > 0) {
    throw new Error(`Invalid shelf-sort level ${level.id}:\n${errors.map((error) => `- ${error}`).join("\n")}`);
  }

  return freezeState({
    levelId: level.id,
    bays: level.bays.map((bay) => ({
      id: bay.id,
      items: bay.items,
      locked: bay.locked ?? false
    })),
    moves: 0,
    completedSets: 0,
    score: 0,
    status: "playing",
    moveLimit: level.moveLimit,
    targetSetCount: level.targetSetCount
  });
}

const rejectMove = (state: ShelfSortState, reason: ShelfMoveRejectReason): ShelfMoveResult => Object.freeze({
  accepted: false,
  state,
  reason
});

const allSame = (items: readonly ShelfSortProductId[]): boolean => (
  items.length === SHELF_BAY_CAPACITY && items.every((item) => item === items[0])
);

const calculateMoveScore = (completedSet: boolean, moves: number): number => {
  const actionScore = completedSet ? 300 : 10;
  const efficiencyPenalty = Math.max(0, moves - 1) * 2;
  return Math.max(1, actionScore - efficiencyPenalty);
};

export function moveShelfProduct(
  state: ShelfSortState,
  fromBayId: string,
  toBayId: string
): ShelfMoveResult {
  if (state.status !== "playing") return rejectMove(state, "level-not-playing");
  if (fromBayId === toBayId) return rejectMove(state, "same-bay");

  const sourceIndex = state.bays.findIndex((bay) => bay.id === fromBayId);
  const destinationIndex = state.bays.findIndex((bay) => bay.id === toBayId);
  if (sourceIndex < 0) return rejectMove(state, "unknown-source");
  if (destinationIndex < 0) return rejectMove(state, "unknown-destination");

  const source = state.bays[sourceIndex];
  const destination = state.bays[destinationIndex];
  if (!source || !destination) throw new Error("Shelf-sort bay lookup failed after index validation");
  if (source.locked) return rejectMove(state, "source-locked");
  if (destination.locked) return rejectMove(state, "destination-locked");
  if (source.items.length === 0) return rejectMove(state, "source-empty");
  if (destination.items.length >= SHELF_BAY_CAPACITY) return rejectMove(state, "destination-full");

  const movedProductId = source.items[source.items.length - 1];
  if (!movedProductId) return rejectMove(state, "source-empty");

  const nextSourceItems = source.items.slice(0, -1);
  const nextDestinationItems = [...destination.items, movedProductId];
  const completedSet = allSame(nextDestinationItems);
  const clearedProductId = completedSet ? movedProductId : undefined;
  const nextMoves = state.moves + 1;
  const nextCompletedSets = state.completedSets + (completedSet ? 1 : 0);

  const nextBays = state.bays.map((bay, index): ShelfBayState => {
    if (index === sourceIndex) return { ...bay, items: nextSourceItems };
    if (index === destinationIndex) return {
      ...bay,
      items: completedSet ? [] : nextDestinationItems
    };
    return bay;
  });

  const inventoryCleared = nextBays.every((bay) => bay.items.length === 0);
  const reachedTarget = nextCompletedSets >= state.targetSetCount;
  const complete = inventoryCleared && reachedTarget;
  const exhaustedMoves = state.moveLimit !== undefined && nextMoves >= state.moveLimit;
  const status: ShelfSortStatus = complete ? "complete" : exhaustedMoves ? "failed" : "playing";

  const nextState = freezeState({
    ...state,
    bays: nextBays,
    moves: nextMoves,
    completedSets: nextCompletedSets,
    score: state.score + calculateMoveScore(completedSet, nextMoves),
    status
  });

  return Object.freeze({
    accepted: true,
    state: nextState,
    movedProductId,
    clearedProductId
  });
}

export function listLegalShelfMoves(state: ShelfSortState): readonly ShelfMoveCandidate[] {
  if (state.status !== "playing") return Object.freeze([]);

  const moves: ShelfMoveCandidate[] = [];
  for (const source of state.bays) {
    if (source.locked || source.items.length === 0) continue;
    const productId = source.items[source.items.length - 1];
    if (!productId) continue;

    for (const destination of state.bays) {
      if (destination.id === source.id) continue;
      if (destination.locked || destination.items.length >= SHELF_BAY_CAPACITY) continue;
      moves.push(Object.freeze({
        fromBayId: source.id,
        toBayId: destination.id,
        productId
      }));
    }
  }

  return Object.freeze(moves);
}

export function shelfSortProgress(state: ShelfSortState): number {
  if (state.targetSetCount <= 0) return 1;
  return Math.min(1, state.completedSets / state.targetSetCount);
}
