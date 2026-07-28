import {
  type ShelfBayDefinition,
  type ShelfSortLevelDefinition,
  validateShelfSortLevel
} from "../../systems/shelfSort/ShelfSortEngine";

const bay = (id: string, items: readonly string[] = []): ShelfBayDefinition => Object.freeze({
  id,
  items: Object.freeze([...items])
});

const emptyBays = (start: number, end: number): readonly ShelfBayDefinition[] => Object.freeze(
  Array.from({ length: end - start + 1 }, (_, index) => bay(`bay-${start + index}`))
);

const level = (definition: ShelfSortLevelDefinition): ShelfSortLevelDefinition => Object.freeze({
  ...definition,
  bays: Object.freeze([...definition.bays]),
  reward: Object.freeze({ ...definition.reward })
});

export const COMMERCIAL_VERTICAL_SLICE_LEVELS: readonly ShelfSortLevelDefinition[] = Object.freeze([
  level({
    id: "commercial-level-001",
    title: "First Shelf",
    layoutId: "2x2",
    targetSetCount: 2,
    moveLimit: 12,
    reward: { coins: 60, stars: 3 },
    bays: [
      bay("bay-1", ["apple", "milk-bottle"]),
      bay("bay-2", ["milk-bottle", "apple"]),
      bay("bay-3", ["apple", "milk-bottle"]),
      bay("bay-4")
    ]
  }),
  level({
    id: "commercial-level-002",
    title: "Drink Delivery",
    layoutId: "2x2",
    targetSetCount: 2,
    moveLimit: 11,
    reward: { coins: 70, stars: 3 },
    bays: [
      bay("bay-1", ["water-bottle", "cola-bottle"]),
      bay("bay-2", ["cola-bottle", "water-bottle"]),
      bay("bay-3", ["water-bottle", "cola-bottle"]),
      bay("bay-4")
    ]
  }),
  level({
    id: "commercial-level-003",
    title: "Morning Mix",
    layoutId: "3x2",
    targetSetCount: 3,
    moveLimit: 18,
    reward: { coins: 90, stars: 3 },
    bays: [
      bay("bay-1", ["apple", "milk-bottle", "cereal-box"]),
      bay("bay-2", ["milk-bottle", "cereal-box", "apple"]),
      bay("bay-3", ["cereal-box", "apple", "milk-bottle"]),
      ...emptyBays(4, 6)
    ]
  }),
  level({
    id: "commercial-level-004",
    title: "Promotion Wall",
    layoutId: "3x2",
    targetSetCount: 4,
    moveLimit: 24,
    reward: { coins: 110, stars: 3 },
    bays: [
      bay("bay-1", ["peanut-butter", "milk-bottle", "cola-bottle"]),
      bay("bay-2", ["cola-bottle", "oats-canister", "peanut-butter"]),
      bay("bay-3", ["oats-canister", "cola-bottle", "milk-bottle"]),
      bay("bay-4", ["milk-bottle", "peanut-butter", "oats-canister"]),
      ...emptyBays(5, 6)
    ]
  }),
  level({
    id: "commercial-level-005",
    title: "Busy Aisle",
    layoutId: "3x3",
    targetSetCount: 5,
    moveLimit: 30,
    reward: { coins: 130, stars: 3 },
    bays: [
      bay("bay-1", ["apple", "milk-bottle", "cereal-box"]),
      bay("bay-2", ["milk-bottle", "cereal-box", "oats-canister"]),
      bay("bay-3", ["cereal-box", "oats-canister", "cola-bottle"]),
      bay("bay-4", ["oats-canister", "cola-bottle", "apple"]),
      bay("bay-5", ["cola-bottle", "apple", "milk-bottle"]),
      ...emptyBays(6, 9)
    ]
  }),
  level({
    id: "commercial-level-006",
    title: "Household Rush",
    layoutId: "3x3",
    targetSetCount: 6,
    moveLimit: 38,
    reward: { coins: 150, stars: 3 },
    bays: [
      bay("bay-1", ["detergent-bottle", "orange-soda", "yogurt-cup"]),
      bay("bay-2", ["orange-soda", "yogurt-cup", "chips-bag"]),
      bay("bay-3", ["yogurt-cup", "chips-bag", "paper-towels"]),
      bay("bay-4", ["chips-bag", "paper-towels", "water-bottle"]),
      bay("bay-5", ["paper-towels", "water-bottle", "detergent-bottle"]),
      bay("bay-6", ["water-bottle", "detergent-bottle", "orange-soda"]),
      ...emptyBays(7, 9)
    ]
  }),
  level({
    id: "commercial-level-007",
    title: "Lunch Crowd",
    layoutId: "4x3",
    targetSetCount: 7,
    moveLimit: 46,
    reward: { coins: 180, stars: 3 },
    bays: [
      bay("bay-1", ["apple", "milk-bottle", "cereal-box"]),
      bay("bay-2", ["milk-bottle", "cereal-box", "oats-canister"]),
      bay("bay-3", ["cereal-box", "oats-canister", "cola-bottle"]),
      bay("bay-4", ["oats-canister", "cola-bottle", "peanut-butter"]),
      bay("bay-5", ["cola-bottle", "peanut-butter", "chips-bag"]),
      bay("bay-6", ["peanut-butter", "chips-bag", "apple"]),
      bay("bay-7", ["chips-bag", "apple", "milk-bottle"]),
      ...emptyBays(8, 12)
    ]
  }),
  level({
    id: "commercial-level-008",
    title: "Full Store",
    layoutId: "4x3",
    targetSetCount: 8,
    moveLimit: 54,
    reward: { coins: 210, stars: 3 },
    bays: [
      bay("bay-1", ["apple", "milk-bottle", "cereal-box"]),
      bay("bay-2", ["milk-bottle", "cereal-box", "oats-canister"]),
      bay("bay-3", ["cereal-box", "oats-canister", "cola-bottle"]),
      bay("bay-4", ["oats-canister", "cola-bottle", "peanut-butter"]),
      bay("bay-5", ["cola-bottle", "peanut-butter", "chips-bag"]),
      bay("bay-6", ["peanut-butter", "chips-bag", "orange-soda"]),
      bay("bay-7", ["chips-bag", "orange-soda", "apple"]),
      bay("bay-8", ["orange-soda", "apple", "milk-bottle"]),
      ...emptyBays(9, 12)
    ]
  }),
  level({
    id: "commercial-level-009",
    title: "Weekend Stock",
    layoutId: "3x5",
    targetSetCount: 9,
    moveLimit: 64,
    reward: { coins: 240, stars: 3 },
    bays: [
      bay("bay-1", ["apple", "milk-bottle", "cereal-box"]),
      bay("bay-2", ["milk-bottle", "cereal-box", "oats-canister"]),
      bay("bay-3", ["cereal-box", "oats-canister", "cola-bottle"]),
      bay("bay-4", ["oats-canister", "cola-bottle", "peanut-butter"]),
      bay("bay-5", ["cola-bottle", "peanut-butter", "chips-bag"]),
      bay("bay-6", ["peanut-butter", "chips-bag", "orange-soda"]),
      bay("bay-7", ["chips-bag", "orange-soda", "yogurt-cup"]),
      bay("bay-8", ["orange-soda", "yogurt-cup", "apple"]),
      bay("bay-9", ["yogurt-cup", "apple", "milk-bottle"]),
      ...emptyBays(10, 15)
    ]
  }),
  level({
    id: "commercial-level-010",
    title: "Grand Opening",
    layoutId: "3x5",
    targetSetCount: 10,
    moveLimit: 74,
    reward: { coins: 300, stars: 3 },
    bays: [
      bay("bay-1", ["apple", "milk-bottle", "cereal-box"]),
      bay("bay-2", ["milk-bottle", "cereal-box", "oats-canister"]),
      bay("bay-3", ["cereal-box", "oats-canister", "cola-bottle"]),
      bay("bay-4", ["oats-canister", "cola-bottle", "peanut-butter"]),
      bay("bay-5", ["cola-bottle", "peanut-butter", "chips-bag"]),
      bay("bay-6", ["peanut-butter", "chips-bag", "orange-soda"]),
      bay("bay-7", ["chips-bag", "orange-soda", "yogurt-cup"]),
      bay("bay-8", ["orange-soda", "yogurt-cup", "water-bottle"]),
      bay("bay-9", ["yogurt-cup", "water-bottle", "apple"]),
      bay("bay-10", ["water-bottle", "apple", "milk-bottle"]),
      ...emptyBays(11, 15)
    ]
  })
]);

export function validateCommercialVerticalSliceLevels(): readonly string[] {
  const errors = COMMERCIAL_VERTICAL_SLICE_LEVELS.flatMap(validateShelfSortLevel);
  const ids = new Set<string>();

  for (const levelDefinition of COMMERCIAL_VERTICAL_SLICE_LEVELS) {
    if (ids.has(levelDefinition.id)) errors.push(`Duplicate commercial level id ${levelDefinition.id}`);
    ids.add(levelDefinition.id);
  }

  if (COMMERCIAL_VERTICAL_SLICE_LEVELS.length < 10) {
    errors.push("Commercial vertical slice requires at least ten authored levels");
  }

  return Object.freeze(errors);
}
