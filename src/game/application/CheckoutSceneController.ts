import type { CheckoutLevelRuntimeContent } from "./CheckoutLevelRuntimeContent";
import {
  CheckoutWorkflow,
  type CheckoutPhase,
  type CheckoutWorkflowSnapshot
} from "../systems/checkout/CheckoutWorkflow";

export type CheckoutSceneAction = "OPEN_REGISTER" | "SCAN_CUSTOMER";
export type CheckoutSceneStep = CheckoutPhase;

export interface CheckoutSceneSnapshot {
  readonly step: CheckoutSceneStep;
  readonly customersServed: number;
  readonly totalCustomers: number;
  readonly coins: number;
  readonly stars: number;
  readonly reputation: number;
}

export interface CheckoutSceneCopy {
  readonly objective: string;
  readonly instruction: string;
  readonly actionLabel: string;
}

export interface CheckoutSceneControllerConfig {
  readonly runtime: CheckoutLevelRuntimeContent;
  readonly initialCoins: number;
  readonly initialStars?: number;
  readonly initialReputation?: number;
}

type SnapshotListener = (
  snapshot: CheckoutSceneSnapshot,
  copy: CheckoutSceneCopy
) => void;

export class CheckoutSceneController {
  private readonly workflow: CheckoutWorkflow;
  private readonly listeners = new Set<SnapshotListener>();
  private readonly copyByStep: Record<CheckoutSceneStep, CheckoutSceneCopy>;

  constructor(readonly config: CheckoutSceneControllerConfig) {
    const { runtime } = config;
    this.workflow = new CheckoutWorkflow({
      checkoutId: runtime.fixture.id,
      customerCount: runtime.customerCount,
      initialCoins: config.initialCoins,
      initialStars: config.initialStars,
      initialReputation: config.initialReputation,
      coinsPerCustomer: runtime.reward.coinsPerCustomer,
      completionCoins: runtime.reward.completionCoins,
      completionStars: runtime.reward.totalStars,
      completionReputation: runtime.reward.totalReputation,
      mission: runtime.mission
    });
    this.copyByStep = createCopy(runtime);
  }

  subscribe(listener: SnapshotListener): () => void {
    this.listeners.add(listener);
    const snapshot = this.snapshot();
    listener(snapshot, this.copyByStep[snapshot.step]);
    return () => this.listeners.delete(listener);
  }

  dispatch(action: CheckoutSceneAction): boolean {
    const result = this.workflow.dispatch(
      action === "OPEN_REGISTER" ? "OPEN_REGISTER" : "SERVE_CUSTOMER"
    );
    if (!result.accepted) return false;
    const snapshot = this.toSceneSnapshot(result.snapshot);
    const copy = this.copyByStep[snapshot.step];
    this.listeners.forEach((listener) => listener(snapshot, copy));
    return true;
  }

  snapshot(): CheckoutSceneSnapshot {
    return this.toSceneSnapshot(this.workflow.snapshot());
  }

  actionForCurrentStep(): CheckoutSceneAction | undefined {
    switch (this.workflow.snapshot().phase) {
      case "open": return "OPEN_REGISTER";
      case "serve": return "SCAN_CUSTOMER";
      case "complete": return undefined;
    }
  }

  private toSceneSnapshot(snapshot: CheckoutWorkflowSnapshot): CheckoutSceneSnapshot {
    return Object.freeze({
      step: snapshot.phase,
      customersServed: snapshot.customersServed,
      totalCustomers: snapshot.totalCustomers,
      coins: snapshot.coins,
      stars: snapshot.stars,
      reputation: snapshot.reputation
    });
  }
}

function createCopy(
  runtime: CheckoutLevelRuntimeContent
): Record<CheckoutSceneStep, CheckoutSceneCopy> {
  return {
    open: {
      objective: runtime.mission.title,
      instruction: "Open the register before the rush starts.",
      actionLabel: "OPEN REGISTER"
    },
    serve: {
      objective: runtime.mission.title,
      instruction: `Scan all ${runtime.customerCount} waiting baskets.`,
      actionLabel: "SCAN BASKET"
    },
    complete: {
      objective: "Checkout orders cleared",
      instruction: "Every waiting basket has been processed.",
      actionLabel: "TASK COMPLETE"
    }
  };
}
