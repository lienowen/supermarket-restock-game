import type Phaser from "phaser";
import { PROJECT_CONFIG } from "./config/project";
import { MAIN_CAMPAIGN_RUNTIME } from "./presentation/context/StarterMarketPresentationContext";
import { createPhaserGame } from "./infrastructure/phaser/createPhaserGame";

const runtimeValidationRequired = (): boolean => {
  const parameters = new URLSearchParams(window.location.search);
  if (parameters.get("test") === "1") return true;

  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
};

/** Project-wide startup boundary. Heavy contract validation is code-split away
 * from the normal production path; release:check remains the production gate. */
export async function bootstrapGame(): Promise<Phaser.Game> {
  if (runtimeValidationRequired()) {
    const { validateProjectContracts } = await import("./validation/ProjectContracts");
    validateProjectContracts();
    document.body.dataset.runtimeValidation = "checked";
  } else {
    document.body.dataset.runtimeValidation = "release-prevalidated";
  }

  document.body.dataset.uiLanguage = PROJECT_CONFIG.language;
  document.body.dataset.gameArchitecture = PROJECT_CONFIG.version;
  document.body.dataset.gameVersion = PROJECT_CONFIG.version;
  document.body.dataset.visualTarget = "production-v1-five-mode-campaign";
  document.body.dataset.experienceTarget = "ten-level-gameplay-polish-v1";
  document.body.dataset.activeCampaign = MAIN_CAMPAIGN_RUNTIME.campaign.id;
  return createPhaserGame();
}
