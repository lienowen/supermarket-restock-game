import type { FindItemsSelectionMode } from "../../application/FindItemsChallengeController";
import type { FindItemsSearchDecoySpec } from "./LevelExperienceSpec";
import type { LevelDefinition } from "../GameContent";

export interface PriorityOrderProductLayoutSpec {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface PriorityOrderExperienceSpec {
  readonly selectionMode: FindItemsSelectionMode;
  readonly numberedTicket: boolean;
  readonly actorSize: { readonly width: number; readonly height: number };
  readonly productLayouts: Readonly<Record<string, PriorityOrderProductLayoutSpec>>;
  readonly decoys: readonly FindItemsSearchDecoySpec[];
}

const PRIORITY_ORDER_BY_LEVEL_ID: ReadonlyMap<string, PriorityOrderExperienceSpec> = new Map([
  [
    "starter-level-009",
    Object.freeze({
      selectionMode: "sequence" as const,
      numberedTicket: true,
      actorSize: Object.freeze({ width: 178, height: 286 }),
      // Use the authored background's three real shopping zones instead of
      // scattering clickable products across the open floor.
      productLayouts: Object.freeze({
        apple: Object.freeze({ x: 220, y: 515, width: 84, height: 84 }),
        "cereal-box": Object.freeze({ x: 620, y: 390, width: 74, height: 102 }),
        "milk-bottle": Object.freeze({ x: 1290, y: 405, width: 76, height: 118 })
      }),
      decoys: Object.freeze([
        Object.freeze({ id: "priority-decoy-banana", assetKey: "product-banana-bunch", x: 120, y: 515, width: 76, height: 72 }),
        Object.freeze({ id: "priority-decoy-grapes", assetKey: "product-grapes-pack", x: 320, y: 515, width: 82, height: 72 }),
        Object.freeze({ id: "priority-decoy-oats", assetKey: "product-oats-canister", x: 720, y: 390, width: 72, height: 98 }),
        Object.freeze({ id: "priority-decoy-chips", assetKey: "product-chips-bag", x: 820, y: 390, width: 74, height: 96 }),
        Object.freeze({ id: "priority-decoy-yogurt", assetKey: "product-yogurt-cup", x: 1400, y: 405, width: 78, height: 84 })
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
