import { RESTOCK_COLA_COOLER_MISSION } from "../../game/content/starterMarket";
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

/**
 * Compatibility adapter for the existing Phaser scene.
 *
 * The actual state, entities, inventory, mission progress, and rewards now live
 * in the project-wide RestockWorkflow under src/game. This class can be removed
 * when the V3 presentation layer replaces the temporary V2 scene.
 */
export class RestockSession {
  private readonly workflow: RestockWorkflow;

  constructor(totalRows = 6) {
    if (!Number.isInteger(totalRows) || totalRows <= 0) {
      throw new Error("totalRows must be a positive integer");
    }

    const unitsPerRow = 4;
    const totalUnits = totalRows * unitsPerRow;
    const mission = {
      ...RESTOCK_COLA_COOLER_MISSION,
      objectives: [
        {
          type: "transfer-product" as const,
          productId: "cola-bottle",
          targetFixtureId: "beverage-cooler-a",
          amount: totalUnits
        }
      ]
    };

    this.workflow = new RestockWorkflow({
      workerId: "worker-a",
      cartId: "restock-cart-a",
      caseId: "cola-case-a",
      productId: "cola-bottle",
      fixtureId: "beverage-cooler-a",
      sourceLocationId: "staff-backroom",
      destinationLocationId: "beverage-restock-zone",
      caseQuantity: totalUnits,
      unitsPerSlot: unitsPerRow,
      slotCount: totalRows,
      cartCapacity: totalUnits,
      initialCoins: 100,
      coinsPerSlot: 10,
      completionCoins: 40,
      completionStars: 1,
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
