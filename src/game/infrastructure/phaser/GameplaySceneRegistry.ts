import type Phaser from "phaser";
import type { LevelDefinition } from "../../content/GameContent";
import type {
  CheckoutStarterMarketPresentationContext,
  CleanStarterMarketPresentationContext,
  FindItemsStarterMarketPresentationContext,
  RestockStarterMarketPresentationContext,
  StarterMarketPresentationContext
} from "../../presentation/context/StarterMarketPresentationContext";
import type { SceneCampaignSessionContext } from "../../presentation/scenes/StarterMarketScene";

export type GameplaySceneFactory = (
  presentation: StarterMarketPresentationContext,
  campaignSession: SceneCampaignSessionContext
) => Promise<Phaser.Scene>;

const requireMode = <T extends StarterMarketPresentationContext["mode"]>(
  presentation: StarterMarketPresentationContext,
  mode: T
): Extract<StarterMarketPresentationContext, { readonly mode: T }> => {
  if (presentation.mode !== mode) {
    throw new Error(`Gameplay scene factory expected ${mode}, received ${presentation.mode}`);
  }
  return presentation as Extract<StarterMarketPresentationContext, { readonly mode: T }>;
};

/**
 * Keep the mode registry as the single gameplay-scene routing boundary, but
 * load only the active mode implementation. Level 1 should not download and
 * parse checkout, cleaning and order-hunt scene code before the player needs it.
 */
const GAMEPLAY_SCENE_FACTORIES: Readonly<Record<LevelDefinition["mode"], GameplaySceneFactory>> = Object.freeze({
  restock: async (presentation, session) => {
    const context = requireMode(
      presentation,
      "restock"
    ) as RestockStarterMarketPresentationContext;

    if (context.levelAssets.environment.key === "environment-restock-water-l2-v1") {
      const { LevelTwoRestockScene } = await import("../../presentation/scenes/LevelTwoRestockScene");
      return new LevelTwoRestockScene(context, session);
    }

    const { StarterMarketScene } = await import("../../presentation/scenes/StarterMarketScene");
    return new StarterMarketScene(context, session);
  },
  checkout: async (presentation, session) => {
    const { CheckoutMarketScene } = await import("../../presentation/scenes/CheckoutMarketScene");
    return new CheckoutMarketScene(
      requireMode(presentation, "checkout") as CheckoutStarterMarketPresentationContext,
      session
    );
  },
  clean: async (presentation, session) => {
    const { UtilityTaskScene } = await import("../../presentation/scenes/UtilityTaskScene");
    return new UtilityTaskScene(
      requireMode(presentation, "clean") as CleanStarterMarketPresentationContext,
      session
    );
  },
  "find-items": async (presentation, session) => {
    const context = requireMode(
      presentation,
      "find-items"
    ) as FindItemsStarterMarketPresentationContext;
    if (context.campaignLevel.level.presentation.visualPresetId === "find-items-golden-standard-v1") {
      const { GoldenOrderHuntScene } = await import("../../presentation/scenes/GoldenOrderHuntScene");
      return new GoldenOrderHuntScene(context, session);
    }
    const { UtilityTaskScene } = await import("../../presentation/scenes/UtilityTaskScene");
    return new UtilityTaskScene(context, session);
  }
});

export async function createGameplayScene(
  presentation: StarterMarketPresentationContext,
  campaignSession: SceneCampaignSessionContext
): Promise<Phaser.Scene> {
  const factory = GAMEPLAY_SCENE_FACTORIES[presentation.mode];
  if (!factory) throw new Error(`No gameplay scene factory registered for ${presentation.mode}`);
  return factory(presentation, campaignSession);
}

export function registeredGameplaySceneModes(): readonly LevelDefinition["mode"][] {
  return Object.freeze(Object.keys(GAMEPLAY_SCENE_FACTORIES) as LevelDefinition["mode"][]);
}
