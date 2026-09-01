export type StaffRankId =
  | "trainee"
  | "store-associate"
  | "senior-associate"
  | "shift-leader";

export interface StaffProgressionState {
  readonly rankId: StaffRankId;
  readonly promotedThroughLevel: 0 | 3 | 6 | 9;
}

export interface StaffRankDefinition {
  readonly id: StaffRankId;
  readonly title: string;
  readonly minLevel: number;
  readonly maxLevel: number;
}

export interface PromotionProgress {
  readonly rank: StaffRankDefinition;
  readonly completedInRank: number;
  readonly requiredInRank: number;
  readonly nextRank?: StaffRankDefinition;
  readonly percent: number;
}

export const STAFF_RANKS: readonly StaffRankDefinition[] = Object.freeze([
  Object.freeze({ id: "trainee" as const, title: "Trainee", minLevel: 1, maxLevel: 3 }),
  Object.freeze({ id: "store-associate" as const, title: "Store Associate", minLevel: 4, maxLevel: 6 }),
  Object.freeze({ id: "senior-associate" as const, title: "Senior Associate", minLevel: 7, maxLevel: 9 }),
  Object.freeze({ id: "shift-leader" as const, title: "Shift Leader", minLevel: 10, maxLevel: 10 })
]);

export const DEFAULT_STAFF_PROGRESSION: StaffProgressionState = Object.freeze({
  rankId: "trainee",
  promotedThroughLevel: 0
});

export function levelNumberFromId(levelId: string): number | undefined {
  const match = levelId.match(/(\d+)(?!.*\d)/);
  if (!match) return undefined;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : undefined;
}

export function rankForLevel(level: number): StaffRankDefinition {
  const normalized = Math.max(1, Math.floor(level));
  return STAFF_RANKS.find((rank) => normalized >= rank.minLevel && normalized <= rank.maxLevel)
    ?? STAFF_RANKS[STAFF_RANKS.length - 1];
}

export function rankForLevelId(levelId: string): StaffRankDefinition {
  return rankForLevel(levelNumberFromId(levelId) ?? 1);
}

export function promotionForCompletedLevel(level: number): StaffRankDefinition | undefined {
  if (level === 3) return rankForLevel(4);
  if (level === 6) return rankForLevel(7);
  if (level === 9) return rankForLevel(10);
  return undefined;
}

export function promotionProgress(level: number): PromotionProgress {
  const normalized = Math.max(1, Math.floor(level));
  const rank = rankForLevel(normalized);
  if (rank.id === "shift-leader") {
    return Object.freeze({
      rank,
      completedInRank: 1,
      requiredInRank: 1,
      percent: 1
    });
  }
  const completedInRank = Math.min(rank.maxLevel - rank.minLevel + 1, normalized - rank.minLevel + 1);
  const requiredInRank = rank.maxLevel - rank.minLevel + 1;
  const nextRankIndex = STAFF_RANKS.findIndex((entry) => entry.id === rank.id) + 1;
  return Object.freeze({
    rank,
    completedInRank,
    requiredInRank,
    nextRank: STAFF_RANKS[nextRankIndex],
    percent: completedInRank / requiredInRank
  });
}

export function normalizeStaffProgression(
  value: Partial<StaffProgressionState> | undefined,
  currentLevelId: string
): StaffProgressionState {
  const rank = rankForLevelId(currentLevelId);
  const promotedThrough = value?.promotedThroughLevel;
  const promotedThroughLevel = promotedThrough === 3 || promotedThrough === 6 || promotedThrough === 9
    ? promotedThrough
    : 0;
  return Object.freeze({
    rankId: rank.id,
    promotedThroughLevel
  });
}

export function staffAfterLevelCompletion(
  previous: StaffProgressionState,
  completedLevelId: string,
  nextLevelId?: string
): StaffProgressionState {
  const completedLevel = levelNumberFromId(completedLevelId);
  const promotionLevel = completedLevel === 3 || completedLevel === 6 || completedLevel === 9
    ? completedLevel
    : undefined;
  const promotedThroughLevel = promotionLevel && promotionLevel > previous.promotedThroughLevel
    ? promotionLevel
    : previous.promotedThroughLevel;
  const rankId = rankForLevelId(nextLevelId ?? completedLevelId).id;
  return Object.freeze({ rankId, promotedThroughLevel });
}
