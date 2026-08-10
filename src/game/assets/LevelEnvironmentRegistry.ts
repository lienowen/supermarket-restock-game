const LEVEL_ENVIRONMENT_ASSET_KEYS: Readonly<Record<string, string>> = Object.freeze({
  // L1 was already visually mature: keep the richer supermarket floor.
  "starter-level-001": "environment-starter-market-restock-hd-v3",

  // L2 uses the dedicated cold-display plate submitted for the contextual water-restock flow.
  "starter-level-002": "environment-project-restock-v2",

  // Service/utility levels use their scene-specific project plates.
  "starter-level-003": "environment-project-checkout-v2",
  "starter-level-004": "environment-project-cleaning-v2",
  "starter-level-005": "environment-project-order-hunt-v2",

  // Do not force the sparse L2 cold-display plate onto later restock missions.
  // L6 keeps the richer market until a dedicated delivery/capacity scene is approved.
  "starter-level-006": "environment-starter-market-restock-hd-v3",
  "starter-level-007": "environment-project-checkout-v2",

  // Later levels remain explicitly scene-bound instead of inheriting by gameplay mode.
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
