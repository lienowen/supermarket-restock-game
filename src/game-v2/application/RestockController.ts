import {
  RestockSession,
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

const COPY_BY_STEP: Record<RestockStep, RestockViewCopy> = {
  collect: {
    objective: "Restock the beverage cooler",
    instruction: "Pick up the cola case from the backroom pallet.",
    actionLabel: "PICK UP CASE"
  },
  load: {
    objective: "Restock the beverage cooler",
    instruction: "Load the case onto the restock cart.",
    actionLabel: "LOAD CART"
  },
  push: {
    objective: "Restock the beverage cooler",
    instruction: "Push the cart through the staff aisle.",
    actionLabel: "PUSH CART"
  },
  park: {
    objective: "Restock the beverage cooler",
    instruction: "Park the cart beside the highlighted cooler bay.",
    actionLabel: "PARK CART"
  },
  open: {
    objective: "Restock the beverage cooler",
    instruction: "Open the case before stocking the shelf.",
    actionLabel: "OPEN CASE"
  },
  restock: {
    objective: "Restock the beverage cooler",
    instruction: "Fill the highlighted cooler row from left to right.",
    actionLabel: "RESTOCK ROW"
  },
  complete: {
    objective: "Beverage cooler ready",
    instruction: "Great work. The opening display is fully stocked.",
    actionLabel: "TASK COMPLETE"
  }
};

export class RestockController {
  private readonly session: RestockSession;
  private readonly listeners = new Set<SnapshotListener>();

  constructor(totalRows = 6) {
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
