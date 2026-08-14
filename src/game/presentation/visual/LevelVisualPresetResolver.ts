import type {
  CheckoutLevelDefinition,
  CleanLevelDefinition,
  FindItemsLevelDefinition,
  LevelDefinition,
  RestockLevelDefinition
} from "../../content/GameContent";
import {
  resolveMarketLevelVisualPreset,
  type CheckoutLevelVisualPreset,
  type CleanLevelVisualPreset,
  type FindItemsLevelVisualPreset,
  type MarketLevelVisualPreset,
  type RestockLevelVisualPreset
} from "./MarketLevelVisualPreset";

const resolveMatureCleanPreset = (level: CleanLevelDefinition): CleanLevelVisualPreset => {
  const preset = resolveMarketLevelVisualPreset(level.presentation.visualPresetId, "clean");
  return Object.freeze({
    ...preset,
    actor: Object.freeze({
      ...preset.actor,
      // Cleaning shares the same worker language as the mature restock levels.
      // Keep the character at an in-store scale instead of dominating the aisle.
      idleSize: Object.freeze({ width: 205, height: 300 })
    }),
    // Once the player has collected the cleaning cart/tools, the cart should
    // leave the world instead of lingering as a translucent ghost over the cooler.
    collectedToolsAlpha: 0
  });
};

export function resolveLevelVisualPreset(
  level: RestockLevelDefinition
): RestockLevelVisualPreset;
export function resolveLevelVisualPreset(
  level: CheckoutLevelDefinition
): CheckoutLevelVisualPreset;
export function resolveLevelVisualPreset(
  level: CleanLevelDefinition
): CleanLevelVisualPreset;
export function resolveLevelVisualPreset(
  level: FindItemsLevelDefinition
): FindItemsLevelVisualPreset;
export function resolveLevelVisualPreset(
  level: CleanLevelDefinition | FindItemsLevelDefinition
): CleanLevelVisualPreset | FindItemsLevelVisualPreset;
export function resolveLevelVisualPreset(
  level: LevelDefinition
): MarketLevelVisualPreset;
export function resolveLevelVisualPreset(level: LevelDefinition): MarketLevelVisualPreset {
  switch (level.mode) {
    case "restock":
      return resolveMarketLevelVisualPreset(level.presentation.visualPresetId, "restock");
    case "checkout":
      return resolveMarketLevelVisualPreset(level.presentation.visualPresetId, "checkout");
    case "clean":
      return resolveMatureCleanPreset(level);
    case "find-items":
      return resolveMarketLevelVisualPreset(level.presentation.visualPresetId, "find-items");
  }
}
