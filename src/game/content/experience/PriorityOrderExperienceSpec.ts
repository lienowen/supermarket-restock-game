import type { FindItemsSelectionMode } from "../../application/FindItemsChallengeController";
import type { FindItemsSearchDecoySpec } from "./LevelExperienceSpec";
import type { LevelDefinition } from "../GameContent";

export interface PriorityOrderExperienceSpec {
  readonly selectionMode: FindItemsSelectionMode;
  readonly numberedTicket: boolean;
  readonly decoys: readonly FindItemsSearchDecoySpec[];
}

const PRIORITY_ORDER_BY_LEVEL_ID: ReadonlyMap<string, PriorityOrderExperienceSpec> = new Map([
  [
    "starter-level-009",
    Object.freeze({
      selectionMode: "sequence" as const,
      numberedTicket: true,
      decoys: Object.freeze([
        Object.freeze({ id: "priority-decoy-oats", assetKey: "product-oats-canister", x: 520, y: 535, width: 60, height: 84 }),
        Object.freeze({ id: "priority-decoy-yogurt", assetKey: "product-yogurt-cup", x: 430, y: 612, width: 60, height: 60 }),
        Object.freeze({ id: "priority-decoy-chips", assetKey: "product-chips-bag", x: 930, y: 535, width: 70, height: 84 }),
        Object.freeze({ id: "priority-decoy-detergent", assetKey: "product-detergent-bottle", x: 1110, y: 610, width: 64, height: 96 }),
        Object.freeze({ id: "priority-decoy-paper", assetKey: "product-paper-towels", x: 1280, y: 665, width: 84, height: 78 })
      ])
    })
  ]
]);

/**
 * Optional late-game find-items modifiers. Keeping these in content data means
 * the reusable scene/controller never branches on a concrete level id.
 */
export function resolvePriorityOrderExperienceSpec(
  level: LevelDefinition
): PriorityOrderExperienceSpec | undefined {
  if (level.mode !== "find-items") return undefined;
  return PRIORITY_ORDER_BY_LEVEL_ID.get(level.id);
}
