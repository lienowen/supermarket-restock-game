import type Phaser from "phaser";
import { validateAssetCatalogue } from "./assets/AssetDescriptor";
import { STARTER_RUNTIME_ASSET_REGISTRY } from "./assets/RuntimeAssetRegistry";
import { STARTER_ASSET_CATALOGUE } from "./assets/starterAssetCatalogue";
import { validateCampaignRuntime } from "./application/CampaignRuntime";
import { validateGameplayRuntime } from "./application/GameplayModeRegistry";
import { validateLevelCampaignRuntime } from "./application/LevelRuntimeContent";
import { validateCommercialUpgradeDefinitions } from "./application/CommercialUpgrades";
import { COMMERCIAL_CONFIG, validateCommercialConfig } from "./config/commercial";
import { PROJECT_CONFIG } from "./config/project";
import {
  COMMERCIAL_VERTICAL_SLICE_LEVELS,
  validateCommercialVerticalSliceLevels
} from "./content/commercial/commercialShelfSortLevels";
import { validateLevelDefinitions } from "./content/validation/LevelConfigValidator";
import { validateCommercialProductAssetCoverage } from "./presentation/assets/CommercialProductAssets";
import { validateProductionAssetPlan } from "./presentation/assets/ProductionAssetPlan";
import { validateProductAssetMappings } from "./presentation/assets/ProductAssetResolver";
import {
  MAIN_CAMPAIGN_RUNTIME,
  MAIN_LEVEL_CAMPAIGN_RUNTIME,
  createStarterMarketPresentationContext,
  validateStarterMarketPresentationContext
} from "./presentation/context/StarterMarketPresentationContext";
import { validateStarterMarketVisualSpec } from "./presentation/visual/StarterMarketVisualSpec";
import { createPhaserGame } from "./infrastructure/phaser/createPhaserGame";
import { validateWorldLayout } from "./world/WorldLayout";
import { STARTER_MARKET_LAYOUT } from "./world/starterMarketLayout";

function validateProjectContracts(): void {
  const presentationContexts = MAIN_LEVEL_CAMPAIGN_RUNTIME.levels.map((entry) => (
    createStarterMarketPresentationContext(entry.level.id)
  ));
  const productIds = MAIN_LEVEL_CAMPAIGN_RUNTIME.levels.flatMap((entry) => (
    "product" in entry.runtime ? [entry.runtime.product.id] : []
  ));
  const configuredAssetKeys = presentationContexts.flatMap((context) => (
    context.levelAssets.preload.map((asset) => asset.key)
  ));
  const gameplayRuntimeErrors = MAIN_LEVEL_CAMPAIGN_RUNTIME.levels.flatMap((entry) => (
    validateGameplayRuntime(entry.level, entry.runtime)
  ));

  const errors = [
    ...validateCommercialConfig(),
    ...validateCommercialVerticalSliceLevels(),
    ...validateCommercialProductAssetCoverage(COMMERCIAL_VERTICAL_SLICE_LEVELS),
    ...validateCommercialUpgradeDefinitions(),
    ...validateAssetCatalogue(STARTER_ASSET_CATALOGUE),
    ...STARTER_RUNTIME_ASSET_REGISTRY.validateKeys(configuredAssetKeys),
    ...validateLevelDefinitions(MAIN_LEVEL_CAMPAIGN_RUNTIME.levels.map((entry) => entry.level)),
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

/** Project-wide startup boundary. */
export async function bootstrapGame(): Promise<Phaser.Game> {
  validateProjectContracts();
  document.body.dataset.uiLanguage = PROJECT_CONFIG.language;
  document.body.dataset.gameArchitecture = PROJECT_CONFIG.version;
  document.body.dataset.gameVersion = PROJECT_CONFIG.version;
  document.body.dataset.visualTarget = PROJECT_CONFIG.visualTarget;
  document.body.dataset.activeCampaign = MAIN_CAMPAIGN_RUNTIME.campaign.id;
  document.body.dataset.commercialProduct = COMMERCIAL_CONFIG.product.productId;
  document.body.dataset.commercialStage = COMMERCIAL_CONFIG.product.releaseStage;
  document.body.dataset.commercialPrimaryMode = COMMERCIAL_CONFIG.product.primaryMode;
  return createPhaserGame();
}
