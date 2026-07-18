import type Phaser from "phaser";
import { PROJECT_CONFIG } from "./config/project";
import { validateAssetCatalogue } from "./assets/AssetDescriptor";
import { STARTER_ASSET_CATALOGUE } from "./assets/starterAssetCatalogue";
import { validateWorldLayout } from "./world/WorldLayout";
import { STARTER_MARKET_LAYOUT } from "./world/starterMarketLayout";
import { validateStarterMarketVisualSpec } from "./presentation/visual/StarterMarketVisualSpec";
import { validateProductionAssetPlan } from "./presentation/assets/ProductionAssetPlan";
import { validateProductAssetMappings } from "./presentation/assets/ProductAssetResolver";
import { STARTER_MARKET_CONTENT } from "./content/starterMarket";
import { validateCampaignRuntime } from "./application/CampaignRuntime";
import {
  resolveRestockShiftRuntime,
  validateRestockShiftRuntime
} from "./application/ShiftRuntimeContent";
import {
  MAIN_CAMPAIGN_RUNTIME,
  createStarterMarketPresentationContext,
  validateStarterMarketPresentationContext
} from "./presentation/context/StarterMarketPresentationContext";
import { createPhaserGame } from "./infrastructure/phaser/createPhaserGame";

function validateProjectContracts(): void {
  const restockRuntimes = MAIN_CAMPAIGN_RUNTIME.shifts.map((entry) => (
    resolveRestockShiftRuntime(STARTER_MARKET_CONTENT, entry.shift.id)
  ));
  const presentationContexts = MAIN_CAMPAIGN_RUNTIME.shifts.map((entry) => (
    createStarterMarketPresentationContext(entry.shift.id)
  ));
  const productIds = restockRuntimes.map((runtime) => runtime.product.id);

  const errors = [
    ...validateAssetCatalogue(STARTER_ASSET_CATALOGUE),
    ...validateWorldLayout(STARTER_MARKET_LAYOUT),
    ...validateStarterMarketVisualSpec().errors,
    ...validateProductionAssetPlan(),
    ...validateCampaignRuntime(MAIN_CAMPAIGN_RUNTIME),
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
