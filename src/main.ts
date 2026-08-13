import "./styles.css";
import "./visual-comfort.css";
import "./mature-clean.css";
import "./mobile-playability.css";
import "./mobile-landscape-fit.css";
import { installMobileLandscapeController } from "./game/infrastructure/browser/MobileLandscapeController";

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

  await Promise.all(imports);
};

installMobileLandscapeController();

void (async () => {
  try {
    await installPresentationPatches(requestedLevel());
    const { bootstrapGame } = await import("./game/bootstrap");
    await bootstrapGame();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    document.body.dataset.bootstrapError = message;
    console.error("Game bootstrap failed.", error);
  }
})();
