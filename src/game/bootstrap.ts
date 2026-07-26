import type Phaser from "phaser";
import { validateAssetCatalogue } from "./assets/AssetDescriptor";
import { STARTER_RUNTIME_ASSET_REGISTRY } from "./assets/RuntimeAssetRegistry";
import { STARTER_ASSET_CATALOGUE } from "./assets/starterAssetCatalogue";
import { validateCampaignRuntime } from "./application/CampaignRuntime";
import { validateGameplayRuntime } from "./application/GameplayModeRegistry";
import { validateLevelCampaignRuntime } from "./application/LevelRuntimeContent";
import { PROJECT_CONFIG } from "./config/project";
import { validateLevelExperienceSpecs } from "./content/experience/LevelExperienceSpec";
import { validateLevelDefinitions } from "./content/validation/LevelConfigValidator";
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
  const levelDefinitions = MAIN_LEVEL_CAMPAIGN_RUNTIME.levels.map((entry) => entry.level);
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
    ...validateAssetCatalogue(STARTER_ASSET_CATALOGUE),
    ...STARTER_RUNTIME_ASSET_REGISTRY.validateKeys(configuredAssetKeys),
    ...validateLevelDefinitions(levelDefinitions),
    ...validateLevelExperienceSpecs(levelDefinitions),
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
  document.body.dataset.visualTarget = "production-v1-ten-level-polish";
  document.body.dataset.activeCampaign = MAIN_CAMPAIGN_RUNTIME.campaign.id;
  return createPhaserGame();
}
