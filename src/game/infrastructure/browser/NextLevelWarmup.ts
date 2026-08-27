import type { GameplayMode } from "../../assets/GlobalAssetPackRegistry";

export interface NextLevelWarmupConfig {
  readonly mode: GameplayMode;
  readonly assetPaths: readonly string[];
}

const warmNextSceneCode = async (mode: GameplayMode): Promise<void> => {
  switch (mode) {
    case "checkout":
      await import("../../presentation/scenes/CheckoutMarketScene");
      return;
    case "clean":
    case "find-items":
      await import("../../presentation/scenes/UtilityTaskScene");
      return;
    case "restock":
      await import("../../presentation/scenes/StarterMarketScene");
      return;
  }
};

/** Warms only the next level after the active scene is interactive. */
export function scheduleNextLevelWarmup(config: NextLevelWarmupConfig | undefined): void {
  if (!config || config.assetPaths.length === 0) return;

  window.setTimeout(() => {
    [...new Set(config.assetPaths)].forEach((path) => {
      const image = new Image();
      image.decoding = "async";
      image.src = path;
    });
    void warmNextSceneCode(config.mode);
    document.body.dataset.nextLevelWarmup = "scheduled";
  }, 900);
}
