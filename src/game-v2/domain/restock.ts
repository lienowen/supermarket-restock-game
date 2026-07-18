import { STARTER_MARKET_CONTENT } from "../../game/content/starterMarket";
import { resolveRestockShiftRuntime } from "../../game/application/ShiftRuntimeContent";
import {
  RestockWorkflow,
  type RestockCommand,
  type RestockPhase
} from "../../game/systems/stocking/RestockWorkflow";

export type RestockAction =
  | "PICK_BOX"
  | "LOAD_CART"
  | "PUSH_CART"
  | "PARK_CART"
  | "OPEN_BOX"
  | "RESTOCK_ROW";

export type RestockStep = RestockPhase;

export type RestockSnapshot = Readonly<{
  step: RestockStep;
  stockedRows: number;
  totalRows: number;
  boxCollected: boolean;
  boxLoaded: boolean;
  cartAtCooler: boolean;
  boxOpened: boolean;
  coins: number;
  stars: number;
}>;

export type DispatchResult = Readonly<{
  accepted: boolean;
  snapshot: RestockSnapshot;
}>;

const COMMAND_BY_ACTION: Record<RestockAction, RestockCommand> = {
  PICK_BOX: "PICK_CASE",
  LOAD_CART: "LOAD_CART",
  PUSH_CART: "PUSH_CART",
  PARK_CART: "PARK_CART",
  OPEN_BOX: "OPEN_CASE",
  RESTOCK_ROW: "STOCK_SLOT"
};

export const STARTER_RESTOCK_RUNTIME = resolveRestockShiftRuntime(
  STARTER_MARKET_CONTENT,
  "starter-shift-001"
);

/**
 * Compatibility adapter for the existing Phaser scene.
 *
 * The actual state, entities, inventory, mission progress, rewards, product,
 * fixture, and shift definitions live in project-wide modules under src/game.
 * This class can be removed when the V3 scene replaces the temporary V2 scene.
 */
export class RestockSession {
  private readonly workflow: RestockWorkflow;

  constructor(totalRows = STARTER_RESTOCK_RUNTIME.slotCount) {
    if (!Number.isInteger(totalRows) || totalRows <= 0) {
      throw new Error("totalRows must be a positive integer");
    }

    const unitsPerRow = STARTER_RESTOCK_RUNTIME.unitsPerSlot;
    const totalUnits = totalRows * unitsPerRow;
    const mission = {
      ...STARTER_RESTOCK_RUNTIME.mission,
      objectives: [
        {
          type: "transfer-product" as const,
          productId: STARTER_RESTOCK_RUNTIME.product.id,
          targetFixtureId: STARTER_RESTOCK_RUNTIME.fixture.id,
          amount: totalUnits
        }
      ]
    };

    const rewardScale = totalRows / STARTER_RESTOCK_RUNTIME.slotCount;
    const completionCoins = Math.max(
      0,
      Math.round(STARTER_RESTOCK_RUNTIME.reward.completionCoins * rewardScale)
    );

    this.workflow = new RestockWorkflow({
      workerId: "worker-a",
      cartId: "restock-cart-a",
      caseId: `${STARTER_RESTOCK_RUNTIME.product.id}-case-a`,
      productId: STARTER_RESTOCK_RUNTIME.product.id,
      fixtureId: STARTER_RESTOCK_RUNTIME.fixture.id,
      sourceLocationId: "staff-backroom",
      destinationLocationId: "beverage-restock-zone",
      caseQuantity: totalUnits,
      unitsPerSlot: unitsPerRow,
      slotCount: totalRows,
      cartCapacity: totalUnits,
      initialCoins: 100,
      coinsPerSlot: STARTER_RESTOCK_RUNTIME.reward.coinsPerSlot,
      completionCoins,
      completionStars: STARTER_RESTOCK_RUNTIME.reward.completionStars,
      mission
    });
  }

  dispatch(action: RestockAction): DispatchResult {
    const result = this.workflow.dispatch(COMMAND_BY_ACTION[action]);
    return Object.freeze({
      accepted: result.accepted,
      snapshot: this.toLegacySnapshot()
    });
  }

  snapshot(): RestockSnapshot {
    return this.toLegacySnapshot();
  }

  private toLegacySnapshot(): RestockSnapshot {
    const snapshot = this.workflow.snapshot();
    return Object.freeze({
      step: snapshot.phase,
      stockedRows: snapshot.stockedSlots,
      totalRows: snapshot.totalSlots,
      boxCollected: snapshot.caseCollected,
      boxLoaded: snapshot.caseLoaded,
      cartAtCooler: snapshot.cartAtFixture,
      boxOpened: snapshot.caseOpened,
      coins: snapshot.coins,
      stars: snapshot.stars
    });
  }
}
