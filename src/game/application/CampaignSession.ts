export interface CampaignEconomy {
  readonly coins: number;
  readonly stars: number;
  readonly reputation: number;
}

export interface CampaignSessionSnapshot extends CampaignEconomy {
  readonly version: 1;
  readonly campaignId: string;
  readonly currentLevelId: string;
  readonly completedLevelIds: readonly string[];
}

export interface CampaignSessionStore {
  load(campaignId: string): CampaignSessionSnapshot | undefined;
  save(snapshot: CampaignSessionSnapshot): void;
  clear(campaignId: string): void;
}

export interface CampaignSessionConfig {
  readonly campaignId: string;
  readonly firstLevelId: string;
  readonly defaultEconomy: CampaignEconomy;
}

const normalizeEconomy = (economy: CampaignEconomy): CampaignEconomy => {
  const values = [economy.coins, economy.stars, economy.reputation];
  if (values.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new Error("Campaign economy values must be finite and zero or greater");
  }
  return Object.freeze({
    coins: Math.floor(economy.coins),
    stars: Math.floor(economy.stars),
    reputation: Math.floor(economy.reputation)
  });
};

export class CampaignSession {
  constructor(
    readonly config: CampaignSessionConfig,
    private readonly store: CampaignSessionStore
  ) {
    if (!config.campaignId.trim()) throw new Error("Campaign ID is required");
    if (!config.firstLevelId.trim()) throw new Error("First level ID is required");
    normalizeEconomy(config.defaultEconomy);
  }

  initialEconomyFor(levelId: string, fallbackCoins: number): CampaignEconomy {
    if (!levelId.trim()) throw new Error("Level ID is required");
    const saved = this.store.load(this.config.campaignId);
    if (saved && saved.currentLevelId === levelId) {
      return normalizeEconomy(saved);
    }

    return normalizeEconomy({
      coins: fallbackCoins,
      stars: 0,
      reputation: 0
    });
  }

  completeLevel(
    levelId: string,
    nextLevelId: string | undefined,
    economy: CampaignEconomy
  ): CampaignSessionSnapshot {
    if (!levelId.trim()) throw new Error("Completed level ID is required");
    const normalizedEconomy = normalizeEconomy(economy);
    const previous = this.store.load(this.config.campaignId);
    const completed = new Set(previous?.completedLevelIds ?? []);
    completed.add(levelId);

    const snapshot = Object.freeze({
      version: 1 as const,
      campaignId: this.config.campaignId,
      currentLevelId: nextLevelId ?? levelId,
      completedLevelIds: Object.freeze([...completed]),
      ...normalizedEconomy
    });
    this.store.save(snapshot);
    return snapshot;
  }

  reset(): CampaignSessionSnapshot {
    this.store.clear(this.config.campaignId);
    const economy = normalizeEconomy(this.config.defaultEconomy);
    const snapshot = Object.freeze({
      version: 1 as const,
      campaignId: this.config.campaignId,
      currentLevelId: this.config.firstLevelId,
      completedLevelIds: Object.freeze([]),
      ...economy
    });
    this.store.save(snapshot);
    return snapshot;
  }
}

export function validateCampaignSessionSnapshot(
  snapshot: CampaignSessionSnapshot,
  campaignId: string
): readonly string[] {
  const errors: string[] = [];
  if (snapshot.version !== 1) errors.push("Unsupported campaign session version");
  if (snapshot.campaignId !== campaignId) errors.push("Campaign session belongs to another campaign");
  if (!snapshot.currentLevelId.trim()) errors.push("Campaign session requires a current level");
  if (new Set(snapshot.completedLevelIds).size !== snapshot.completedLevelIds.length) {
    errors.push("Campaign session contains duplicate completed levels");
  }
  if ([snapshot.coins, snapshot.stars, snapshot.reputation].some((value) => (
    !Number.isFinite(value) || value < 0
  ))) {
    errors.push("Campaign session economy must be valid");
  }
  return Object.freeze(errors);
}
