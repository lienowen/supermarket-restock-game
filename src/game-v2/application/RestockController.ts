import {
  RestockSession,
  STARTER_RESTOCK_RUNTIME,
  type RestockAction,
  type RestockSnapshot,
  type RestockStep
} from "../domain/restock";

export type RestockViewCopy = Readonly<{
  objective: string;
  instruction: string;
  actionLabel: string;
}>;

type SnapshotListener = (snapshot: RestockSnapshot, copy: RestockViewCopy) => void;

const productName = STARTER_RESTOCK_RUNTIME.product.name;
const fixtureName = STARTER_RESTOCK_RUNTIME.fixture.kind === "cooler" ? "cooler" : "fixture";
const missionObjective = STARTER_RESTOCK_RUNTIME.mission.title;

const COPY_BY_STEP: Record<RestockStep, RestockViewCopy> = {
  collect: {
    objective: missionObjective,
    instruction: `Pick up the ${productName.toLowerCase()} case from the backroom pallet.`,
    actionLabel: "PICK UP CASE"
  },
  load: {
    objective: missionObjective,
    instruction: "Load the case onto the restock cart.",
    actionLabel: "LOAD CART"
  },
  push: {
    objective: missionObjective,
    instruction: "Push the cart through the staff aisle.",
    actionLabel: "PUSH CART"
  },
  park: {
    objective: missionObjective,
    instruction: `Park the cart beside the highlighted ${fixtureName} bay.`,
    actionLabel: "PARK CART"
  },
  open: {
    objective: missionObjective,
    instruction: "Open the case before stocking the shelf.",
    actionLabel: "OPEN CASE"
  },
  restock: {
    objective: missionObjective,
    instruction: `Fill the highlighted ${fixtureName} row from left to right.`,
    actionLabel: "RESTOCK ROW"
  },
  complete: {
    objective: `${productName} section ready`,
    instruction: `Great work. The ${fixtureName} display is fully stocked.`,
    actionLabel: "TASK COMPLETE"
  }
};

export class RestockController {
  private readonly session: RestockSession;
  private readonly listeners = new Set<SnapshotListener>();

  constructor(totalRows = STARTER_RESTOCK_RUNTIME.slotCount) {
    this.session = new RestockSession(totalRows);
  }

  subscribe(listener: SnapshotListener): () => void {
    this.listeners.add(listener);
    const snapshot = this.session.snapshot();
    listener(snapshot, this.copyFor(snapshot.step));
    return () => this.listeners.delete(listener);
  }

  dispatch(action: RestockAction): boolean {
    const result = this.session.dispatch(action);
    if (!result.accepted) return false;
    const copy = this.copyFor(result.snapshot.step);
    this.listeners.forEach((listener) => listener(result.snapshot, copy));
    return true;
  }

  snapshot(): RestockSnapshot {
    return this.session.snapshot();
  }

  actionForCurrentStep(): RestockAction | undefined {
    switch (this.session.snapshot().step) {
      case "collect": return "PICK_BOX";
      case "load": return "LOAD_CART";
      case "push": return "PUSH_CART";
      case "park": return "PARK_CART";
      case "open": return "OPEN_BOX";
      case "restock": return "RESTOCK_ROW";
      case "complete": return undefined;
    }
  }

  private copyFor(step: RestockStep): RestockViewCopy {
    return COPY_BY_STEP[step];
  }
}
