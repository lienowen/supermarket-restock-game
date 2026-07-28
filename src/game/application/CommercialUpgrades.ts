import {
  replaceCommercialProfileEconomy,
  type CommercialProfileSnapshot,
  type CommercialUpgradeId,
  type CommercialUpgradeLevels
} from "./CommercialProfile";

export interface CommercialUpgradeDefinition {
  readonly id: CommercialUpgradeId;
  readonly title: string;
  readonly description: string;
  readonly maxLevel: 3;
  readonly costs: readonly [number, number, number];
}

export type CommercialUpgradePurchaseFailure = "max-level" | "insufficient-coins";

export interface CommercialUpgradePurchaseResult {
  readonly accepted: boolean;
  readonly profile: CommercialProfileSnapshot;
  readonly cost: number;
  readonly reason?: CommercialUpgradePurchaseFailure;
}

export const COMMERCIAL_UPGRADES: Readonly<Record<CommercialUpgradeId, CommercialUpgradeDefinition>> = Object.freeze({
  moveBuffer: Object.freeze({
    id: "moveBuffer",
    title: "Bigger Cart",
    description: "+1 move per level",
    maxLevel: 3,
    costs: Object.freeze([120, 320, 700] as const)
  }),
  undoCapacity: Object.freeze({
    id: "undoCapacity",
    title: "Smart Scanner",
    description: "+1 undo per level",
    maxLevel: 3,
    costs: Object.freeze([100, 280, 620] as const)
  }),
  coinBoost: Object.freeze({
    id: "coinBoost",
    title: "Store Signage",
    description: "+10% level coins",
    maxLevel: 3,
    costs: Object.freeze([180, 420, 900] as const)
  })
});

export function commercialUpgradeCost(
  profile: CommercialProfileSnapshot,
  upgradeId: CommercialUpgradeId
): number | undefined {
  const definition = COMMERCIAL_UPGRADES[upgradeId];
  const level = profile.upgrades[upgradeId];
  return level >= definition.maxLevel ? undefined : definition.costs[level];
}

export function purchaseCommercialUpgrade(
  profile: CommercialProfileSnapshot,
  upgradeId: CommercialUpgradeId,
  now = new Date().toISOString()
): CommercialUpgradePurchaseResult {
  const definition = COMMERCIAL_UPGRADES[upgradeId];
  const currentLevel = profile.upgrades[upgradeId];
  const cost = commercialUpgradeCost(profile, upgradeId);

  if (cost === undefined || currentLevel >= definition.maxLevel) {
    return Object.freeze({ accepted: false, profile, cost: 0, reason: "max-level" });
  }
  if (profile.coins < cost) {
    return Object.freeze({ accepted: false, profile, cost, reason: "insufficient-coins" });
  }

  const upgrades: CommercialUpgradeLevels = Object.freeze({
    ...profile.upgrades,
    [upgradeId]: currentLevel + 1
  });
  const nextProfile = replaceCommercialProfileEconomy(profile, {
    coins: profile.coins - cost,
    upgrades,
    updatedAt: now
  });

  return Object.freeze({ accepted: true, profile: nextProfile, cost });
}

export function commercialMoveLimitBonus(profile: CommercialProfileSnapshot): number {
  return profile.upgrades.moveBuffer;
}

export function commercialUndoLimit(profile: CommercialProfileSnapshot): number {
  return 1 + profile.upgrades.undoCapacity;
}

export function commercialLevelCoinReward(
  profile: CommercialProfileSnapshot,
  baseCoins: number
): number {
  const multiplier = 1 + profile.upgrades.coinBoost * 0.1;
  return Math.round(baseCoins * multiplier);
}

export function validateCommercialUpgradeDefinitions(): readonly string[] {
  const errors: string[] = [];
  for (const definition of Object.values(COMMERCIAL_UPGRADES)) {
    if (definition.costs.length !== definition.maxLevel) {
      errors.push(`${definition.id} upgrade must have exactly ${definition.maxLevel} prices`);
    }
    definition.costs.forEach((cost, index) => {
      if (!Number.isInteger(cost) || cost <= 0) {
        errors.push(`${definition.id} level ${index + 1} has invalid cost ${cost}`);
      }
      if (index > 0 && cost <= definition.costs[index - 1]) {
        errors.push(`${definition.id} costs must increase at every level`);
      }
    });
  }
  return Object.freeze(errors);
}
