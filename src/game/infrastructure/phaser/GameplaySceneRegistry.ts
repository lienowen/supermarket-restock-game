import Phaser from "phaser";
import type { LevelDefinition } from "../../content/GameContent";
import type {
  CheckoutStarterMarketPresentationContext,
  CleanStarterMarketPresentationContext,
  FindItemsStarterMarketPresentationContext,
  RestockStarterMarketPresentationContext,
  StarterMarketPresentationContext
} from "../../presentation/context/StarterMarketPresentationContext";
import { CheckoutMarketScene } from "../../presentation/scenes/CheckoutMarketScene";
import {
  StarterMarketScene,
  type SceneCampaignSessionContext
} from "../../presentation/scenes/StarterMarketScene";
import { UtilityTaskScene } from "../../presentation/scenes/UtilityTaskScene";

export type GameplaySceneFactory = (
  presentation: StarterMarketPresentationContext,
  campaignSession: SceneCampaignSessionContext
) => Phaser.Scene;

const requireMode = <T extends StarterMarketPresentationContext["mode"]>(
  presentation: StarterMarketPresentationContext,
  mode: T
): Extract<StarterMarketPresentationContext, { readonly mode: T }> => {
  if (presentation.mode !== mode) {
    throw new Error(`Gameplay scene factory expected ${mode}, received ${presentation.mode}`);
  }
  return presentation as Extract<StarterMarketPresentationContext, { readonly mode: T }>;
};

const GAMEPLAY_SCENE_FACTORIES: Readonly<Record<LevelDefinition["mode"], GameplaySceneFactory>> = Object.freeze({
  restock: (presentation, session) => new StarterMarketScene(
    requireMode(presentation, "restock") as RestockStarterMarketPresentationContext,
    session
  ),
  checkout: (presentation, session) => new CheckoutMarketScene(
    requireMode(presentation, "checkout") as CheckoutStarterMarketPresentationContext,
    session
  ),
  clean: (presentation, session) => new UtilityTaskScene(
    requireMode(presentation, "clean") as CleanStarterMarketPresentationContext,
    session
  ),
  "find-items": (presentation, session) => new UtilityTaskScene(
    requireMode(presentation, "find-items") as FindItemsStarterMarketPresentationContext,
    session
  )
});

export function createGameplayScene(
  presentation: StarterMarketPresentationContext,
  campaignSession: SceneCampaignSessionContext
): Phaser.Scene {
  const factory = GAMEPLAY_SCENE_FACTORIES[presentation.mode];
  if (!factory) throw new Error(`No gameplay scene factory registered for ${presentation.mode}`);
  return factory(presentation, campaignSession);
}

export function registeredGameplaySceneModes(): readonly LevelDefinition["mode"][] {
  return Object.freeze(Object.keys(GAMEPLAY_SCENE_FACTORIES) as LevelDefinition["mode"][]);
}
