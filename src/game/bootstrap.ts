import type Phaser from "phaser";
import { PROJECT_CONFIG } from "./config/project";
import { validateAssetCatalogue } from "./assets/AssetDescriptor";
import { STARTER_ASSET_CATALOGUE } from "./assets/starterAssetCatalogue";
import { validateWorldLayout } from "./world/WorldLayout";
import { STARTER_MARKET_LAYOUT } from "./world/starterMarketLayout";
import { validateStarterMarketVisualSpec } from "./presentation/visual/StarterMarketVisualSpec";
import { validateProductionAssetPlan } from "./presentation/assets/ProductionAssetPlan";
import { STARTER_MARKET_CONTENT } from "./content/starterMarket";
import {
  resolveRestockShiftRuntime,
  validateRestockShiftRuntime
} from "./application/ShiftRuntimeContent";
import {
  STARTER_MARKET_PRESENTATION,
  validateStarterMarketPresentationContext
} from "./presentation/context/StarterMarketPresentationContext";
import { createPhaserGame } from "./infrastructure/phaser/createPhaserGame";

function validateProjectContracts(): void {
  const starterShift = resolveRestockShiftRuntime(STARTER_MARKET_CONTENT, "starter-shift-001");
  const errors = [
    ...validateAssetCatalogue(STARTER_ASSET_CATALOGUE),
    ...validateWorldLayout(STARTER_MARKET_LAYOUT),
    ...validateStarterMarketVisualSpec().errors,
    ...validateProductionAssetPlan(),
    ...validateRestockShiftRuntime(starterShift),
    ...validateStarterMarketPresentationContext()
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
  document.body.dataset.activeShift = STARTER_MARKET_PRESENTATION.runtime.shift.id;
  return createPhaserGame();
}
