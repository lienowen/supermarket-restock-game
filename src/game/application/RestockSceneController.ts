import type { RestockShiftRuntimeContent } from "./ShiftRuntimeContent";
import {
  RestockWorkflow,
  type RestockCommand,
  type RestockPhase
} from "../systems/stocking/RestockWorkflow";

export type RestockSceneAction =
  | "PICK_BOX"
  | "LOAD_CART"
  | "PUSH_CART"
  | "PARK_CART"
  | "OPEN_BOX"
  | "RESTOCK_ROW";

export type RestockSceneStep = RestockPhase;

export interface RestockSceneSnapshot {
  readonly step: RestockSceneStep;
  readonly stockedRows: number;
  readonly totalRows: number;
  readonly boxCollected: boolean;
  readonly boxLoaded: boolean;
  readonly cartAtCooler: boolean;
  readonly boxOpened: boolean;
  readonly coins: number;
  readonly stars: number;
}

export interface RestockSceneCopy {
  readonly objective: string;
  readonly instruction: string;
  readonly actionLabel: string;
}

export interface RestockSceneControllerConfig {
  readonly runtime: RestockShiftRuntimeContent;
  readonly workerId?: string;
  readonly cartId?: string;
  readonly caseId?: string;
  readonly sourceLocationId?: string;
  readonly destinationLocationId?: string;
  readonly initialCoins?: number;
  readonly initialStars?: number;
  readonly itemsPerRow?: number;
  readonly restockInstruction?: string;
}

type SnapshotListener = (snapshot: RestockSceneSnapshot, copy: RestockSceneCopy) => void;

const COMMAND_BY_ACTION: Record<RestockSceneAction, RestockCommand> = {
  PICK_BOX: "PICK_CASE",
  LOAD_CART: "LOAD_CART",
  PUSH_CART: "PUSH_CART",
  PARK_CART: "PARK_CART",
  OPEN_BOX: "OPEN_CASE",
  RESTOCK_ROW: "STOCK_SLOT"
};

export class RestockSceneController {
  private readonly workflow: RestockWorkflow;
  private readonly listeners = new Set<SnapshotListener>();
  private readonly copyByStep: Record<RestockSceneStep, RestockSceneCopy>;

  constructor(readonly config: RestockSceneControllerConfig) {
    const { runtime } = config;
    this.workflow = new RestockWorkflow({
      workerId: config.workerId ?? "worker-a",
      cartId: config.cartId ?? "restock-cart-a",
      caseId: config.caseId ?? `${runtime.product.id}-case-a`,
      productId: runtime.product.id,
      fixtureId: runtime.fixture.id,
      sourceLocationId: config.sourceLocationId ?? "staff-backroom",
      destinationLocationId: config.destinationLocationId ?? "beverage-restock-zone",
      caseQuantity: runtime.totalUnits,
      unitsPerSlot: runtime.unitsPerSlot,
      slotCount: runtime.slotCount,
      cartCapacity: runtime.totalUnits,
      initialCoins: config.initialCoins ?? 100,
      coinsPerSlot: runtime.reward.coinsPerSlot,
      completionCoins: runtime.reward.completionCoins,
      completionStars: runtime.reward.completionStars,
      mission: runtime.mission
    });
    const initialStars = config.initialStars ?? 0;
    if (initialStars > 0) this.workflow.wallet.grant(0, initialStars);
    this.copyByStep = createCopy(runtime, config.itemsPerRow, config.restockInstruction);
  }

  subscribe(listener: SnapshotListener): () => void {
    this.listeners.add(listener);
    const snapshot = this.snapshot();
    listener(snapshot, this.copyFor(snapshot.step));
    return () => this.listeners.delete(listener);
  }

  dispatch(action: RestockSceneAction): boolean {
    const result = this.workflow.dispatch(COMMAND_BY_ACTION[action]);
    if (!result.accepted) return false;
    const snapshot = this.snapshot();
    const copy = this.copyFor(snapshot.step);
    this.listeners.forEach((listener) => listener(snapshot, copy));
    return true;
  }

  snapshot(): RestockSceneSnapshot {
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

  actionForCurrentStep(): RestockSceneAction | undefined {
    switch (this.workflow.snapshot().phase) {
      case "collect": return "PICK_BOX";
      case "load": return "LOAD_CART";
      case "push": return "PUSH_CART";
      case "park": return "PARK_CART";
      case "open": return "OPEN_BOX";
      case "restock": return "RESTOCK_ROW";
      case "complete": return undefined;
    }
  }

  private copyFor(step: RestockSceneStep): RestockSceneCopy {
    return this.copyByStep[step];
  }
}

function createCopy(
  runtime: RestockShiftRuntimeContent,
  interactionsPerShelf?: number,
  restockInstruction?: string
): Record<RestockSceneStep, RestockSceneCopy> {
  const product = runtime.product.name;
  const fixture = runtime.fixture.kind === "cooler" ? "cooler" : "fixture";
  const objective = runtime.mission.title;

  return {
    collect: {
      objective,
      instruction: `Step 1: tap the glowing ${product.toLowerCase()} case.`,
      actionLabel: "PICK UP CASE"
    },
    load: {
      objective,
      instruction: "Step 2: drag the case into the empty restock cart.",
      actionLabel: "LOAD CART"
    },
    push: {
      objective,
      instruction: `Step 3: deliver the loaded cart to the ${fixture}.`,
      actionLabel: "DELIVER CART"
    },
    park: {
      objective,
      instruction: `The cart is at the ${fixture}. Tap once to park it.`,
      actionLabel: "PARK CART"
    },
    open: {
      objective,
      instruction: "Open the case, then follow the shelf order shown for this level.",
      actionLabel: "OPEN CASE"
    },
    restock: {
      objective,
      instruction: restockInstruction ?? (
        interactionsPerShelf === 1
          ? "Tap the highlighted shelf once. The worker places all 3 bottles."
          : "Tap the highlighted shelf to stock it. Keep going until the shelf is full."
      ),
      actionLabel: "TAP A SHELF"
    },
    complete: {
      objective: `${product} section ready`,
      instruction: "All six shelves are stocked. The delivery is complete.",
      actionLabel: "TASK COMPLETE"
    }
  };
}
