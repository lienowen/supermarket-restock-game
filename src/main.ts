import "./styles.css";
import "./visual-comfort.css";
import "./mature-clean.css";
import "./mobile-playability.css";
import "./mobile-landscape-fit.css";
import { installMobileLandscapeController } from "./game/infrastructure/browser/MobileLandscapeController";
import { installStaffCareerHud } from "./game/presentation/ui/installStaffCareerHud";

const requestedLevel = (): string => {
  const parameters = new URLSearchParams(window.location.search);
  return parameters.get("level")?.trim() || parameters.get("shift")?.trim() || "starter-level-001";
};

const installPresentationPatches = async (levelId: string): Promise<void> => {
  const imports: Array<Promise<unknown>> = [];

  if (levelId === "starter-level-001") {
    imports.push(
      import("./game/presentation/actors/installRestockCartCombo"),
      import("./game/presentation/actors/installLevelOnePolish"),
      import("./game/presentation/actors/installLevelOneWorkerMatteCleanup"),
      import("./game/presentation/actors/installLevelOneCompletionPolish"),
      import("./game/presentation/ui/installMatureRestockHud")
    );
  }

  if (levelId === "starter-level-002") {
    imports.push(
      import("./game/presentation/actors/installLevelTwoPolish"),
      import("./game/presentation/actors/installLevelTwoCoolerLayout"),
      import("./game/presentation/actors/installLevelTwoCartInventoryVisual"),
      import("./game/presentation/actors/installLevelTwoMemoryFeedback"),
      import("./game/presentation/ui/installMatureRestockHud")
    );
  }

  if (levelId === "starter-level-003" || levelId === "starter-level-007") {
    imports.push(
      import("./game/infrastructure/browser/CheckoutSoftwareLandscapeDrag").then(({ installCheckoutSoftwareLandscapeDrag }) => {
        installCheckoutSoftwareLandscapeDrag();
      })
    );
  }

  if (levelId === "starter-level-006") {
    imports.push(import("./game/presentation/ui/installLevelSixCapacityPolish"));
  }

  await Promise.all(imports);
};

const recoverFromBootstrapFailure = (levelId: string, message: string): boolean => {
  const retryKey = `supermarket-bootstrap-retry:${levelId}`;
  try {
    if (window.sessionStorage.getItem(retryKey) === "1") {
      window.sessionStorage.removeItem(retryKey);
      return false;
    }
    window.sessionStorage.setItem(retryKey, "1");
    const url = new URL(window.location.href);
    url.searchParams.set("bootRetry", String(Date.now()));
    document.body.dataset.bootstrapRecovery = "reloading";
    document.body.dataset.bootstrapError = message;
    window.location.replace(url.toString());
    return true;
  } catch {
    return false;
  }
};

installMobileLandscapeController();
installStaffCareerHud();

void (async () => {
  const levelId = requestedLevel();
  try {
    const [bootstrapModule] = await Promise.all([
      import("./game/bootstrap"),
      installPresentationPatches(levelId)
    ]);
    await bootstrapModule.bootstrapGame();
    try {
      window.sessionStorage.removeItem(`supermarket-bootstrap-retry:${levelId}`);
    } catch {
      // Storage can be unavailable in embedded/private contexts; gameplay is already running.
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (recoverFromBootstrapFailure(levelId, message)) return;
    document.body.dataset.bootstrapError = message;
    document.body.dataset.bootstrapRecovery = "failed";
    console.error("Game bootstrap failed.", error);
  }
})();
