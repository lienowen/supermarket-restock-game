import type Phaser from "phaser";
import { bootstrapImmersiveGame } from "../game-v2/bootstrap";
import { PROJECT_CONFIG } from "./config/project";
import { validateAssetCatalogue } from "./assets/AssetDescriptor";
import { STARTER_ASSET_CATALOGUE } from "./assets/starterAssetCatalogue";
import { validateWorldLayout } from "./world/WorldLayout";
import { STARTER_MARKET_LAYOUT } from "./world/starterMarketLayout";
import { validateStarterMarketVisualSpec } from "./presentation/visual/StarterMarketVisualSpec";
import { validateProductionAssetPlan } from "./presentation/assets/ProductionAssetPlan";

function validateProjectContracts(): void {
  const errors = [
    ...validateAssetCatalogue(STARTER_ASSET_CATALOGUE),
    ...validateWorldLayout(STARTER_MARKET_LAYOUT),
    ...validateStarterMarketVisualSpec().errors,
    ...validateProductionAssetPlan()
  ];

  if (errors.length > 0) {
    throw new Error(`Project contract validation failed:\n${errors.map((error) => `- ${error}`).join("\n")}`);
  }
}

/**
 * Project-wide startup boundary.
 *
 * The V2 bootstrap remains behind this adapter while domain systems, content,
 * presentation, and assets are migrated into src/game. New features must not
 * import game-v2 directly.
 */
export async function bootstrapGame(): Promise<Phaser.Game> {
  validateProjectContracts();
  document.body.dataset.uiLanguage = PROJECT_CONFIG.language;
  document.body.dataset.gameArchitecture = PROJECT_CONFIG.version;
  document.body.dataset.visualTarget = "locked-starter-market";
  return bootstrapImmersiveGame();
}
