import "./styles.css";
import "./visual-comfort.css";
import "./mature-clean.css";
import "./mobile-playability.css";
import "./game/presentation/actors/installRestockCartCombo";
import "./game/presentation/actors/installLevelOnePolish";
import "./game/presentation/actors/installLevelOneWorkerMatteCleanup";
import "./game/presentation/actors/installLevelTwoPolish";
import "./game/presentation/actors/installLevelTwoCoolerLayout";
import "./game/presentation/actors/installLevelTwoCartInventoryVisual";
import "./game/presentation/actors/installLevelTwoMemoryFeedback";
import "./game/presentation/actors/installLevelOneCompletionPolish";
import "./game/presentation/ui/installMatureRestockHud";
import { bootstrapGame } from "./game/bootstrap";
import { installMobileLandscapeController } from "./game/infrastructure/browser/MobileLandscapeController";

installMobileLandscapeController();

void bootstrapGame().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  document.body.dataset.bootstrapError = message;
  console.error("Game bootstrap failed.", error);
});
