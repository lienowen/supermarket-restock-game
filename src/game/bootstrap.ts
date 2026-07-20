import type Phaser from "phaser";
import { validateAssetCatalogue } from "./assets/AssetDescriptor";
import {
  STARTER_RUNTIME_ASSET_REGISTRY
} from "./assets/RuntimeAssetRegistry";
import { STARTER_ASSET_CATALOGUE } from "./assets/starterAssetCatalogue";
import { validateCampaignRuntime } from "./application/CampaignRuntime";
import {
  levelAssetKeys,
  validateLevelCampaignRuntime
} from "./application/LevelRuntimeContent";
import { validateRestockShiftRuntime } from "./application/ShiftRuntimeContent";
import { PROJECT_CONFIG } from "./config/project";
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
  const restockRuntimes = MAIN_LEVEL_CAMPAIGN_RUNTIME.levels.map((entry) => entry.runtime);
  const presentationContexts = MAIN_LEVEL_CAMPAIGN_RUNTIME.levels.map((entry) => (
    createStarterMarketPresentationContext(entry.level.id)
  ));
  const productIds = restockRuntimes.map((runtime) => runtime.product.id);
  const configuredAssetKeys = MAIN_LEVEL_CAMPAIGN_RUNTIME.levels.flatMap((entry) => (
    levelAssetKeys(entry.level)
  ));

  const errors = [
    ...validateAssetCatalogue(STARTER_ASSET_CATALOGUE),
    ...STARTER_RUNTIME_ASSET_REGISTRY.validateKeys(configuredAssetKeys),
    ...validateWorldLayout(STARTER_MARKET_LAYOUT),
    ...validateStarterMarketVisualSpec().errors,
    ...validateProductionAssetPlan(),
    ...validateCampaignRuntime(MAIN_CAMPAIGN_RUNTIME),
    ...validateLevelCampaignRuntime(MAIN_LEVEL_CAMPAIGN_RUNTIME),
    ...validateProductAssetMappings(productIds),
    ...restockRuntimes.flatMap((runtime) => validateRestockShiftRuntime(runtime)),
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
  document.body.dataset.visualTarget = "locked-starter-market";
  document.body.dataset.activeCampaign = MAIN_CAMPAIGN_RUNTIME.campaign.id;
  return createPhaserGame();
}
