import type {
  CheckoutLevelDefinition,
  CleanLevelDefinition,
  FindItemsLevelDefinition,
  LevelDefinition,
  RestockLevelDefinition
} from "../../content/GameContent";
import { resolvePriorityOrderExperienceSpec } from "../../content/experience/PriorityOrderExperienceSpec";
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

const resolveMatureFindItemsPreset = (
  level: FindItemsLevelDefinition
): FindItemsLevelVisualPreset => {
  const basePreset = resolveMarketLevelVisualPreset(level.presentation.visualPresetId, "find-items");
  const preset = basePreset.id === "find-items-golden-standard-v1"
    ? Object.freeze({
        ...basePreset,
        orderTicket: Object.freeze({
          ...basePreset.orderTicket,
          // A tall bottle was landing at ~27 physical pixels wide on the
          // Android audit. Give all three order icons a little more room
          // while preserving their aspect ratios.
          iconMaxSize: Object.freeze({ width: 48, height: 52 })
        })
      })
    : basePreset;
  const priority = resolvePriorityOrderExperienceSpec(level);
  if (!priority) return preset;

  const itemSizes = Object.fromEntries(
    Object.entries(priority.productLayouts).map(([productId, layout]) => [
      productId,
      Object.freeze({ width: layout.width, height: layout.height })
    ])
  );
  const itemPositions = Object.fromEntries(
    Object.entries(priority.productLayouts).map(([productId, layout]) => [
      productId,
      Object.freeze({ x: layout.x, y: layout.y })
    ])
  );

  return Object.freeze({
    ...preset,
    actor: Object.freeze({
      ...preset.actor,
      idleSize: priority.actorSize
    }),
    basket: priority.basket,
    itemSizes: Object.freeze(itemSizes),
    itemPositions: Object.freeze(itemPositions)
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
      return resolveMatureFindItemsPreset(level);
  }
}
