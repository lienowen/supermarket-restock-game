import type {
  RestockCommand,
  RestockPhase,
  RestockWorkflowSnapshot
} from "../systems/stocking/RestockWorkflow";

export interface InteractionOption {
  readonly id: string;
  readonly label: string;
  readonly command: RestockCommand;
  readonly targetType: "case" | "cart" | "parking-zone" | "fixture-slot";
}

const INTERACTION_BY_PHASE: Record<Exclude<RestockPhase, "complete">, InteractionOption> = {
  collect: {
    id: "pick-case",
    label: "PICK UP CASE",
    command: "PICK_CASE",
    targetType: "case"
  },
  load: {
    id: "load-cart",
    label: "LOAD CART",
    command: "LOAD_CART",
    targetType: "cart"
  },
  push: {
    id: "push-cart",
    label: "PUSH CART",
    command: "PUSH_CART",
    targetType: "cart"
  },
  park: {
    id: "park-cart",
    label: "PARK CART",
    command: "PARK_CART",
    targetType: "parking-zone"
  },
  open: {
    id: "open-case",
    label: "OPEN CASE",
    command: "OPEN_CASE",
    targetType: "case"
  },
  restock: {
    id: "stock-slot",
    label: "RESTOCK ROW",
    command: "STOCK_SLOT",
    targetType: "fixture-slot"
  }
};

export class RestockInteractionResolver {
  resolve(snapshot: RestockWorkflowSnapshot): readonly InteractionOption[] {
    if (snapshot.phase === "complete") return [];
    return [INTERACTION_BY_PHASE[snapshot.phase]];
  }
}
