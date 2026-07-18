import type Phaser from "phaser";
import { bootstrapImmersiveGame } from "../game-v2/bootstrap";
import { PROJECT_CONFIG } from "./config/project";

/**
 * Project-wide startup boundary.
 *
 * The V2 bootstrap remains behind this adapter while domain systems, content,
 * presentation, and assets are migrated into src/game. New features must not
 * import game-v2 directly.
 */
export async function bootstrapGame(): Promise<Phaser.Game> {
  document.body.dataset.uiLanguage = PROJECT_CONFIG.language;
  document.body.dataset.gameArchitecture = PROJECT_CONFIG.version;
  return bootstrapImmersiveGame();
}
