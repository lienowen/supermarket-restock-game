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
      return resolveMarketLevelVisualPreset(level.presentation.visualPresetId, "clean");
    case "find-items":
      return resolveMarketLevelVisualPreset(level.presentation.visualPresetId, "find-items");
  }
}
