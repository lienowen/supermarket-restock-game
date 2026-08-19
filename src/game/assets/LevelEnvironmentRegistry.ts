const LEVEL_ENVIRONMENT_ASSET_KEYS: Readonly<Record<string, string>> = Object.freeze({
  // L1 remains the mature visual reference.
  "starter-level-001": "environment-starter-market-restock-hd-v3",

  // L2 has its own authored water-restock plate while sharing L1 actor/prop art.
  "starter-level-002": "environment-restock-water-l2-v1",

  // Service/utility levels use their scene-specific project plates.
  "starter-level-003": "environment-project-checkout-v2",
  "starter-level-004": "environment-project-cleaning-v2",
  "starter-level-005": "environment-project-order-hunt-v2",

  // Later missions keep reviewed plates while their mechanics supply the variation.
  "starter-level-006": "environment-starter-market-restock-hd-v3",
  "starter-level-007": "environment-project-checkout-v2",
  "starter-level-008": "environment-project-cleaning-v2",
  "starter-level-009": "environment-project-order-hunt-v2",
  "starter-level-010": "environment-starter-market-restock-hd-v3"
});

export function resolveLevelEnvironmentAssetKey(
  levelId: string,
  fallbackAssetKey: string
): string {
  return LEVEL_ENVIRONMENT_ASSET_KEYS[levelId] ?? fallbackAssetKey;
}

export function levelEnvironmentAssetKey(levelId: string): string | undefined {
  return LEVEL_ENVIRONMENT_ASSET_KEYS[levelId];
}
