export const CURRENT_COMMERCIAL_PROFILE_SCHEMA_VERSION = 1 as const;
export const COMMERCIAL_PRODUCT_ID = "shelf-rush-market" as const;

export interface CommercialProfileSnapshot {
  readonly schemaVersion: typeof CURRENT_COMMERCIAL_PROFILE_SCHEMA_VERSION;
  readonly productId: typeof COMMERCIAL_PRODUCT_ID;
  readonly currentLevelIndex: number;
  readonly unlockedLevelIndex: number;
  readonly coins: number;
  readonly totalStars: number;
  readonly completedLevelIds: readonly string[];
  readonly bestMovesByLevel: Readonly<Record<string, number>>;
  readonly starsByLevel: Readonly<Record<string, 1 | 2 | 3>>;
  readonly updatedAt: string;
}

export interface CommercialLevelCompletion {
  readonly levelId: string;
  readonly levelIndex: number;
  readonly moves: number;
  readonly stars: 1 | 2 | 3;
  readonly coins: number;
  readonly campaignLevelCount: number;
  readonly completedAt?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === "object" && value !== null && !Array.isArray(value)
);

const finiteNonNegativeInteger = (value: unknown): value is number => (
  typeof value === "number" && Number.isInteger(value) && value >= 0 && Number.isFinite(value)
);

const validStars = (value: unknown): value is 1 | 2 | 3 => value === 1 || value === 2 || value === 3;

const isoTimestamp = (value: unknown): string => {
  if (typeof value === "string" && Number.isFinite(Date.parse(value))) return value;
  return new Date(0).toISOString();
};

const numericRecord = (value: unknown): Readonly<Record<string, number>> => {
  if (!isRecord(value)) return Object.freeze({});
  const entries = Object.entries(value).filter((entry): entry is [string, number] => (
    entry[0].trim().length > 0 && finiteNonNegativeInteger(entry[1])
  ));
  return Object.freeze(Object.fromEntries(entries));
};

const starRecord = (value: unknown): Readonly<Record<string, 1 | 2 | 3>> => {
  if (!isRecord(value)) return Object.freeze({});
  const entries = Object.entries(value).filter((entry): entry is [string, 1 | 2 | 3] => (
    entry[0].trim().length > 0 && validStars(entry[1])
  ));
  return Object.freeze(Object.fromEntries(entries));
};

const stringArray = (value: unknown): readonly string[] => {
  if (!Array.isArray(value)) return Object.freeze([]);
  return Object.freeze([...new Set(value.filter((item): item is string => (
    typeof item === "string" && item.trim().length > 0
  )))]);
};

export function createDefaultCommercialProfile(now = new Date().toISOString()): CommercialProfileSnapshot {
  return Object.freeze({
    schemaVersion: CURRENT_COMMERCIAL_PROFILE_SCHEMA_VERSION,
    productId: COMMERCIAL_PRODUCT_ID,
    currentLevelIndex: 0,
    unlockedLevelIndex: 0,
    coins: 0,
    totalStars: 0,
    completedLevelIds: Object.freeze([]),
    bestMovesByLevel: Object.freeze({}),
    starsByLevel: Object.freeze({}),
    updatedAt: now
  });
}

export function migrateCommercialProfile(value: unknown): CommercialProfileSnapshot | undefined {
  if (!isRecord(value)) return undefined;
  if (value.productId !== undefined && value.productId !== COMMERCIAL_PRODUCT_ID) return undefined;

  const schemaVersion = value.schemaVersion;
  if (schemaVersion !== undefined && schemaVersion !== CURRENT_COMMERCIAL_PROFILE_SCHEMA_VERSION) {
    return undefined;
  }

  const starsByLevel = starRecord(value.starsByLevel);
  const totalStars = Object.values(starsByLevel).reduce((sum, stars) => sum + stars, 0);

  return Object.freeze({
    schemaVersion: CURRENT_COMMERCIAL_PROFILE_SCHEMA_VERSION,
    productId: COMMERCIAL_PRODUCT_ID,
    currentLevelIndex: finiteNonNegativeInteger(value.currentLevelIndex) ? value.currentLevelIndex : 0,
    unlockedLevelIndex: finiteNonNegativeInteger(value.unlockedLevelIndex) ? value.unlockedLevelIndex : 0,
    coins: finiteNonNegativeInteger(value.coins) ? value.coins : 0,
    totalStars,
    completedLevelIds: stringArray(value.completedLevelIds),
    bestMovesByLevel: numericRecord(value.bestMovesByLevel),
    starsByLevel,
    updatedAt: isoTimestamp(value.updatedAt)
  });
}

export function validateCommercialProfile(profile: CommercialProfileSnapshot): readonly string[] {
  const errors: string[] = [];
  if (profile.schemaVersion !== CURRENT_COMMERCIAL_PROFILE_SCHEMA_VERSION) {
    errors.push(`Unsupported commercial profile schema ${profile.schemaVersion}`);
  }
  if (profile.productId !== COMMERCIAL_PRODUCT_ID) errors.push("Commercial profile productId mismatch");
  if (!finiteNonNegativeInteger(profile.currentLevelIndex)) errors.push("Invalid currentLevelIndex");
  if (!finiteNonNegativeInteger(profile.unlockedLevelIndex)) errors.push("Invalid unlockedLevelIndex");
  if (profile.currentLevelIndex > profile.unlockedLevelIndex) {
    errors.push("Current level cannot be greater than unlocked level");
  }
  if (!finiteNonNegativeInteger(profile.coins)) errors.push("Invalid coin balance");
  if (!finiteNonNegativeInteger(profile.totalStars)) errors.push("Invalid total star count");
  if (!Number.isFinite(Date.parse(profile.updatedAt))) errors.push("Invalid profile updatedAt timestamp");

  const calculatedStars = Object.values(profile.starsByLevel).reduce((sum, stars) => sum + stars, 0);
  if (calculatedStars !== profile.totalStars) errors.push("Profile totalStars does not match starsByLevel");

  return Object.freeze(errors);
}

export function applyCommercialLevelCompletion(
  profile: CommercialProfileSnapshot,
  completion: CommercialLevelCompletion
): CommercialProfileSnapshot {
  if (!completion.levelId.trim()) throw new Error("Commercial completion levelId is required");
  if (!finiteNonNegativeInteger(completion.levelIndex)) throw new Error("Commercial completion levelIndex is invalid");
  if (!finiteNonNegativeInteger(completion.moves) || completion.moves < 1) {
    throw new Error("Commercial completion moves must be a positive integer");
  }
  if (!validStars(completion.stars)) throw new Error("Commercial completion stars are invalid");
  if (!finiteNonNegativeInteger(completion.coins)) throw new Error("Commercial completion coins are invalid");
  if (!finiteNonNegativeInteger(completion.campaignLevelCount) || completion.campaignLevelCount < 1) {
    throw new Error("Commercial campaign level count is invalid");
  }

  const previousMoves = profile.bestMovesByLevel[completion.levelId];
  const previousStars = profile.starsByLevel[completion.levelId] ?? 0;
  const firstCompletion = !profile.completedLevelIds.includes(completion.levelId);
  const completedLevelIds = firstCompletion
    ? [...profile.completedLevelIds, completion.levelId]
    : [...profile.completedLevelIds];
  const nextUnlocked = Math.min(
    completion.campaignLevelCount - 1,
    Math.max(profile.unlockedLevelIndex, completion.levelIndex + 1)
  );

  const nextProfile: CommercialProfileSnapshot = Object.freeze({
    schemaVersion: CURRENT_COMMERCIAL_PROFILE_SCHEMA_VERSION,
    productId: COMMERCIAL_PRODUCT_ID,
    currentLevelIndex: nextUnlocked,
    unlockedLevelIndex: nextUnlocked,
    coins: profile.coins + (firstCompletion ? completion.coins : 0),
    totalStars: profile.totalStars - previousStars + Math.max(previousStars, completion.stars),
    completedLevelIds: Object.freeze(completedLevelIds),
    bestMovesByLevel: Object.freeze({
      ...profile.bestMovesByLevel,
      [completion.levelId]: previousMoves === undefined ? completion.moves : Math.min(previousMoves, completion.moves)
    }),
    starsByLevel: Object.freeze({
      ...profile.starsByLevel,
      [completion.levelId]: Math.max(previousStars, completion.stars) as 1 | 2 | 3
    }),
    updatedAt: completion.completedAt ?? new Date().toISOString()
  });

  const errors = validateCommercialProfile(nextProfile);
  if (errors.length > 0) {
    throw new Error(`Commercial profile update failed:\n${errors.map((error) => `- ${error}`).join("\n")}`);
  }
  return nextProfile;
}
