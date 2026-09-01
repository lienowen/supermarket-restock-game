import type { GameDomainEventSink } from "../events/GameDomainEvents";
import {
  DEFAULT_MARKET_UPGRADES,
  applyMovementUpgrade,
  applyProfitUpgrade,
  applyServiceUpgrade,
  marketUpgradeOptions,
  normalizeMarketUpgrades,
  purchaseMarketUpgrade,
  type MarketUpgradeId,
  type MarketUpgradeLevels,
  type MarketUpgradeOption,
  type MarketUpgradePurchaseResult
} from "./MarketUpgrades";
import {
  DEFAULT_STAFF_PROGRESSION,
  levelNumberFromId,
  normalizeStaffProgression,
  promotionForCompletedLevel,
  staffAfterLevelCompletion,
  type StaffProgressionState,
  type StaffRankDefinition
} from "./StaffProgression";

export interface CampaignEconomy {
  readonly coins: number;
  readonly stars: number;
  readonly reputation: number;
}

export interface CampaignSessionSnapshot extends CampaignEconomy {
  readonly version: 3;
  readonly campaignId: string;
  readonly currentLevelId: string;
  readonly completedLevelIds: readonly string[];
  readonly upgrades: MarketUpgradeLevels;
  readonly staff: StaffProgressionState;
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

export interface CampaignResetOptions {
  readonly preserveMetaProgress?: boolean;
}

export interface StaffPromotionCelebration {
  readonly completedLevelId: string;
  readonly rank: StaffRankDefinition;
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

const createSnapshot = (
  campaignId: string,
  currentLevelId: string,
  completedLevelIds: readonly string[],
  economy: CampaignEconomy,
  upgrades: MarketUpgradeLevels,
  staff: StaffProgressionState = DEFAULT_STAFF_PROGRESSION
): CampaignSessionSnapshot => Object.freeze({
  version: 3 as const,
  campaignId,
  currentLevelId,
  completedLevelIds: Object.freeze([...new Set(completedLevelIds)]),
  ...normalizeEconomy(economy),
  upgrades: normalizeMarketUpgrades(upgrades),
  staff: normalizeStaffProgression(staff, currentLevelId)
});

export class CampaignSession {
  private pendingPromotion?: StaffPromotionCelebration;

  constructor(
    readonly config: CampaignSessionConfig,
    private readonly store: CampaignSessionStore,
    private readonly events?: GameDomainEventSink
  ) {
    if (!config.campaignId.trim()) throw new Error("Campaign ID is required");
    if (!config.firstLevelId.trim()) throw new Error("First level ID is required");
    normalizeEconomy(config.defaultEconomy);
  }

  snapshot(): CampaignSessionSnapshot {
    return this.store.load(this.config.campaignId) ?? createSnapshot(
      this.config.campaignId,
      this.config.firstLevelId,
      [],
      this.config.defaultEconomy,
      DEFAULT_MARKET_UPGRADES,
      DEFAULT_STAFF_PROGRESSION
    );
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

  upgrades(): MarketUpgradeLevels {
    return this.snapshot().upgrades;
  }

  staff(): StaffProgressionState {
    return this.snapshot().staff;
  }

  consumePendingPromotion(levelId?: string): StaffPromotionCelebration | undefined {
    if (!this.pendingPromotion) return undefined;
    if (levelId && this.pendingPromotion.completedLevelId !== levelId) return undefined;
    const promotion = this.pendingPromotion;
    this.pendingPromotion = undefined;
    return promotion;
  }

  upgradeOptions(): readonly MarketUpgradeOption[] {
    const snapshot = this.snapshot();
    return marketUpgradeOptions(snapshot, snapshot.upgrades);
  }

  purchaseUpgrade(upgradeId: MarketUpgradeId): MarketUpgradePurchaseResult {
    const previous = this.snapshot();
    const result = purchaseMarketUpgrade(previous, previous.upgrades, upgradeId);
    if (!result.purchased) return result;

    const snapshot = createSnapshot(
      previous.campaignId,
      previous.currentLevelId,
      previous.completedLevelIds,
      result.economy,
      result.upgrades,
      previous.staff
    );
    this.store.save(snapshot);
    this.events?.emit("campaign.upgrade-purchased", {
      campaignId: previous.campaignId,
      upgradeId,
      economy: result.economy,
      upgrades: result.upgrades,
      snapshot
    });
    return Object.freeze({ ...result, economy: snapshot, upgrades: snapshot.upgrades });
  }

  movementSpeed(baseSpeed: number): number {
    return applyMovementUpgrade(baseSpeed, this.upgrades());
  }

  serviceDuration(baseDurationMs: number): number {
    return applyServiceUpgrade(baseDurationMs, this.upgrades());
  }

  completionEconomy(
    initialEconomy: CampaignEconomy,
    completedEconomy: CampaignEconomy
  ): CampaignEconomy {
    return applyProfitUpgrade(initialEconomy, completedEconomy, this.upgrades());
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
    const previousStaff = previous?.staff ?? DEFAULT_STAFF_PROGRESSION;
    const completedLevelNumber = levelNumberFromId(levelId);
    const promotedRank = completedLevelNumber === undefined
      ? undefined
      : promotionForCompletedLevel(completedLevelNumber);
    const firstPromotionCompletion = (
      completedLevelNumber !== undefined &&
      promotedRank !== undefined &&
      completedLevelNumber > previousStaff.promotedThroughLevel
    );
    if (firstPromotionCompletion) {
      this.pendingPromotion = Object.freeze({ completedLevelId: levelId, rank: promotedRank });
    }
    const staff = staffAfterLevelCompletion(previousStaff, levelId, nextLevelId);

    const snapshot = createSnapshot(
      this.config.campaignId,
      nextLevelId ?? levelId,
      [...completed],
      normalizedEconomy,
      previous?.upgrades ?? DEFAULT_MARKET_UPGRADES,
      staff
    );
    this.store.save(snapshot);
    this.events?.emit("campaign.level-completed", {
      campaignId: this.config.campaignId,
      levelId,
      nextLevelId,
      economy: normalizedEconomy,
      upgrades: snapshot.upgrades,
      snapshot
    });
    return snapshot;
  }

  reset(options: CampaignResetOptions = {}): CampaignSessionSnapshot {
    const previous = this.store.load(this.config.campaignId);
    this.pendingPromotion = undefined;
    this.store.clear(this.config.campaignId);
    const preserveMetaProgress = options.preserveMetaProgress !== false;
    const economy = normalizeEconomy(
      preserveMetaProgress && previous ? previous : this.config.defaultEconomy
    );
    const snapshot = createSnapshot(
      this.config.campaignId,
      this.config.firstLevelId,
      [],
      economy,
      preserveMetaProgress ? previous?.upgrades ?? DEFAULT_MARKET_UPGRADES : DEFAULT_MARKET_UPGRADES,
      DEFAULT_STAFF_PROGRESSION
    );
    this.store.save(snapshot);
    this.events?.emit("campaign.reset", {
      campaignId: this.config.campaignId,
      preserveMetaProgress,
      snapshot
    });
    return snapshot;
  }
}

export function migrateCampaignSessionSnapshot(
  value: unknown,
  campaignId: string
): CampaignSessionSnapshot | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Record<string, unknown>;
  if (candidate.campaignId !== campaignId) return undefined;
  const currentLevelId = typeof candidate.currentLevelId === "string"
    ? candidate.currentLevelId.trim()
    : "";
  if (!currentLevelId) return undefined;
  if (!Array.isArray(candidate.completedLevelIds)) return undefined;
  if (candidate.completedLevelIds.some((levelId) => typeof levelId !== "string" || !levelId.trim())) {
    return undefined;
  }
  const completedLevelIds = candidate.completedLevelIds as string[];

  const economy = {
    coins: Number(candidate.coins),
    stars: Number(candidate.stars),
    reputation: Number(candidate.reputation)
  };
  try {
    normalizeEconomy(economy);
  } catch {
    return undefined;
  }

  if (candidate.version === 1) {
    return createSnapshot(
      campaignId,
      currentLevelId,
      completedLevelIds,
      economy,
      DEFAULT_MARKET_UPGRADES,
      DEFAULT_STAFF_PROGRESSION
    );
  }

  const upgrades = candidate.upgrades && typeof candidate.upgrades === "object"
    ? candidate.upgrades as Partial<MarketUpgradeLevels>
    : undefined;

  if (candidate.version === 2) {
    return createSnapshot(
      campaignId,
      currentLevelId,
      completedLevelIds,
      economy,
      normalizeMarketUpgrades(upgrades),
      DEFAULT_STAFF_PROGRESSION
    );
  }
  if (candidate.version !== 3) return undefined;

  const staff = candidate.staff && typeof candidate.staff === "object"
    ? candidate.staff as Partial<StaffProgressionState>
    : undefined;
  return createSnapshot(
    campaignId,
    currentLevelId,
    completedLevelIds,
    economy,
    normalizeMarketUpgrades(upgrades),
    normalizeStaffProgression(staff, currentLevelId)
  );
}

export function validateCampaignSessionSnapshot(
  snapshot: CampaignSessionSnapshot,
  campaignId: string
): readonly string[] {
  const errors: string[] = [];
  if (snapshot.version !== 3) errors.push("Unsupported campaign session version");
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
  const normalizedUpgrades = normalizeMarketUpgrades(snapshot.upgrades);
  if (
    normalizedUpgrades.movement !== snapshot.upgrades.movement ||
    normalizedUpgrades.service !== snapshot.upgrades.service ||
    normalizedUpgrades.profit !== snapshot.upgrades.profit
  ) {
    errors.push("Campaign upgrades are outside supported levels");
  }
  const normalizedStaff = normalizeStaffProgression(snapshot.staff, snapshot.currentLevelId);
  if (
    normalizedStaff.rankId !== snapshot.staff.rankId ||
    normalizedStaff.promotedThroughLevel !== snapshot.staff.promotedThroughLevel
  ) {
    errors.push("Campaign staff progression is invalid");
  }
  return Object.freeze(errors);
}
