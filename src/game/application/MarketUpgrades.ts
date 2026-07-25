import type { CampaignEconomy } from "./CampaignSession";

export type MarketUpgradeId = "movement" | "service" | "profit";

export interface MarketUpgradeLevels {
  readonly movement: number;
  readonly service: number;
  readonly profit: number;
}

export interface MarketUpgradeDefinition {
  readonly id: MarketUpgradeId;
  readonly title: string;
  readonly description: string;
  readonly maxLevel: number;
  readonly costs: readonly number[];
}

export interface MarketUpgradeOption extends MarketUpgradeDefinition {
  readonly level: number;
  readonly nextCost?: number;
  readonly affordable: boolean;
  readonly maxed: boolean;
}

export interface MarketUpgradePurchaseResult {
  readonly purchased: boolean;
  readonly reason?: "unknown-upgrade" | "max-level" | "insufficient-coins";
  readonly economy: CampaignEconomy;
  readonly upgrades: MarketUpgradeLevels;
}

export const DEFAULT_MARKET_UPGRADES: MarketUpgradeLevels = Object.freeze({
  movement: 0,
  service: 0,
  profit: 0
});

export const MARKET_UPGRADE_DEFINITIONS: readonly MarketUpgradeDefinition[] = Object.freeze([
  Object.freeze({
    id: "movement" as const,
    title: "QUICK SHOES",
    description: "+8% worker movement speed",
    maxLevel: 3,
    costs: Object.freeze([120, 240, 420])
  }),
  Object.freeze({
    id: "service" as const,
    title: "BETTER TOOLS",
    description: "-10% checkout and task time",
    maxLevel: 3,
    costs: Object.freeze([140, 280, 460])
  }),
  Object.freeze({
    id: "profit" as const,
    title: "STORE PROMO",
    description: "+10% coins earned per level",
    maxLevel: 3,
    costs: Object.freeze([160, 320, 520])
  })
]);

const normalizeLevel = (value: number, maxLevel: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.min(maxLevel, Math.max(0, Math.floor(value)));
};

export function normalizeMarketUpgrades(
  upgrades: Partial<MarketUpgradeLevels> | undefined
): MarketUpgradeLevels {
  const definitionById = new Map(MARKET_UPGRADE_DEFINITIONS.map((definition) => [definition.id, definition]));
  return Object.freeze({
    movement: normalizeLevel(upgrades?.movement ?? 0, definitionById.get("movement")?.maxLevel ?? 3),
    service: normalizeLevel(upgrades?.service ?? 0, definitionById.get("service")?.maxLevel ?? 3),
    profit: normalizeLevel(upgrades?.profit ?? 0, definitionById.get("profit")?.maxLevel ?? 3)
  });
}

export function marketUpgradeOptions(
  economy: CampaignEconomy,
  upgrades: MarketUpgradeLevels
): readonly MarketUpgradeOption[] {
  const normalized = normalizeMarketUpgrades(upgrades);
  return Object.freeze(MARKET_UPGRADE_DEFINITIONS.map((definition) => {
    const level = normalized[definition.id];
    const nextCost = definition.costs[level];
    return Object.freeze({
      ...definition,
      level,
      nextCost,
      affordable: nextCost !== undefined && economy.coins >= nextCost,
      maxed: level >= definition.maxLevel
    });
  }));
}

export function purchaseMarketUpgrade(
  economy: CampaignEconomy,
  upgrades: MarketUpgradeLevels,
  upgradeId: MarketUpgradeId
): MarketUpgradePurchaseResult {
  const definition = MARKET_UPGRADE_DEFINITIONS.find((entry) => entry.id === upgradeId);
  const normalized = normalizeMarketUpgrades(upgrades);
  if (!definition) {
    return Object.freeze({ purchased: false, reason: "unknown-upgrade", economy, upgrades: normalized });
  }

  const level = normalized[upgradeId];
  if (level >= definition.maxLevel) {
    return Object.freeze({ purchased: false, reason: "max-level", economy, upgrades: normalized });
  }

  const cost = definition.costs[level];
  if (cost === undefined || economy.coins < cost) {
    return Object.freeze({ purchased: false, reason: "insufficient-coins", economy, upgrades: normalized });
  }

  return Object.freeze({
    purchased: true,
    economy: Object.freeze({
      coins: economy.coins - cost,
      stars: economy.stars,
      reputation: economy.reputation
    }),
    upgrades: Object.freeze({
      ...normalized,
      [upgradeId]: level + 1
    }) as MarketUpgradeLevels
  });
}

export function applyMovementUpgrade(baseSpeed: number, upgrades: MarketUpgradeLevels): number {
  return Math.round(baseSpeed * (1 + normalizeMarketUpgrades(upgrades).movement * 0.08));
}

export function applyServiceUpgrade(baseDurationMs: number, upgrades: MarketUpgradeLevels): number {
  const multiplier = 1 - normalizeMarketUpgrades(upgrades).service * 0.1;
  return Math.max(120, Math.round(baseDurationMs * multiplier));
}

export function applyProfitUpgrade(
  initialEconomy: CampaignEconomy,
  completedEconomy: CampaignEconomy,
  upgrades: MarketUpgradeLevels
): CampaignEconomy {
  const earnedCoins = Math.max(0, completedEconomy.coins - initialEconomy.coins);
  const bonusCoins = Math.round(earnedCoins * normalizeMarketUpgrades(upgrades).profit * 0.1);
  return Object.freeze({
    coins: completedEconomy.coins + bonusCoins,
    stars: completedEconomy.stars,
    reputation: completedEconomy.reputation
  });
}
