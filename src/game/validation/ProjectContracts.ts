import { validateAssetCatalogue } from "../assets/AssetDescriptor";
import { STARTER_RUNTIME_ASSET_REGISTRY } from "../assets/RuntimeAssetRegistry";
import { STARTER_ASSET_CATALOGUE } from "../assets/starterAssetCatalogue";
import { validateCampaignRuntime } from "../application/CampaignRuntime";
import { validateGameplayRuntime } from "../application/GameplayModeRegistry";
import { validateLevelCampaignRuntime } from "../application/LevelRuntimeContent";
import {
  CART_CAPACITY_EXPERIENCE_SPECS,
  validateCartCapacityExperienceSpecs
} from "../content/experience/CartCapacityExperienceSpec";
import {
  CHECKOUT_PATIENCE_EXPERIENCE_SPECS,
  validateCheckoutPatienceExperienceSpecs
} from "../content/experience/CheckoutPatienceExperienceSpec";
import {
  STARTER_LEVEL_EXPERIENCE_SPECS,
  validateLevelExperienceSpecs
} from "../content/experience/LevelExperienceSpec";
import { validateLevelDefinitions } from "../content/validation/LevelConfigValidator";
import { validateProductionAssetPlan } from "../presentation/assets/ProductionAssetPlan";
import { validateProductAssetMappings } from "../presentation/assets/ProductAssetResolver";
import {
  MAIN_CAMPAIGN_RUNTIME,
  MAIN_LEVEL_CAMPAIGN_RUNTIME,
  createStarterMarketPresentationContext,
  validateStarterMarketPresentationContext
} from "../presentation/context/StarterMarketPresentationContext";
import { validateStarterMarketVisualSpec } from "../presentation/visual/StarterMarketVisualSpec";
import { validateWorldLayout } from "../world/WorldLayout";
import { STARTER_MARKET_LAYOUT } from "../world/starterMarketLayout";

/** Heavy project-wide contract validation used by development/test entry points.
 * Production releases already run these checks in the release pipeline, so this
 * module is loaded lazily instead of blocking the player's first frame. */
export function validateProjectContracts(): void {
  const levelDefinitions = MAIN_LEVEL_CAMPAIGN_RUNTIME.levels.map((entry) => entry.level);
  const presentationContexts = MAIN_LEVEL_CAMPAIGN_RUNTIME.levels.map((entry) => (
    createStarterMarketPresentationContext(entry.level.id)
  ));
  const productIds = MAIN_LEVEL_CAMPAIGN_RUNTIME.levels.flatMap((entry) => (
    "product" in entry.runtime ? [entry.runtime.product.id] : []
  ));
  const interactionAssetKeys = [
    ...STARTER_LEVEL_EXPERIENCE_SPECS.flatMap((spec) => [
      ...(spec.checkoutScan?.productAssetKeys ?? []),
      ...(spec.findItemsSearch?.decoys.map((decoy) => decoy.assetKey) ?? [])
    ]),
    ...CART_CAPACITY_EXPERIENCE_SPECS.flatMap((spec) => (
      spec.options.map((option) => option.assetKey)
    )),
    ...CHECKOUT_PATIENCE_EXPERIENCE_SPECS.flatMap((spec) => [
      ...spec.standardProductAssetKeys,
      spec.weighedProductAssetKey
    ])
  ];
  const configuredAssetKeys = [
    ...presentationContexts.flatMap((context) => (
      context.levelAssets.preload.map((asset) => asset.key)
    )),
    ...interactionAssetKeys
  ];
  const gameplayRuntimeErrors = MAIN_LEVEL_CAMPAIGN_RUNTIME.levels.flatMap((entry) => (
    validateGameplayRuntime(entry.level, entry.runtime)
  ));

  const errors = [
    ...validateAssetCatalogue(STARTER_ASSET_CATALOGUE),
    ...STARTER_RUNTIME_ASSET_REGISTRY.validateKeys(configuredAssetKeys),
    ...validateLevelDefinitions(levelDefinitions),
    ...validateLevelExperienceSpecs(levelDefinitions),
    ...validateCartCapacityExperienceSpecs(levelDefinitions),
    ...validateCheckoutPatienceExperienceSpecs(levelDefinitions),
    ...validateWorldLayout(STARTER_MARKET_LAYOUT),
    ...validateStarterMarketVisualSpec().errors,
    ...validateProductionAssetPlan(),
    ...validateCampaignRuntime(MAIN_CAMPAIGN_RUNTIME),
    ...validateLevelCampaignRuntime(MAIN_LEVEL_CAMPAIGN_RUNTIME),
    ...validateProductAssetMappings(productIds),
    ...gameplayRuntimeErrors,
    ...presentationContexts.flatMap((context) => validateStarterMarketPresentationContext(context))
  ];

  if (errors.length > 0) {
    throw new Error(`Project contract validation failed:\n${errors.map((error) => `- ${error}`).join("\n")}`);
  }
}
