import type { MissionDefinition } from "../../content/GameContent";

export type CheckoutCommand = "OPEN_REGISTER" | "SERVE_CUSTOMER";
export type CheckoutPhase = "open" | "serve" | "complete";

export interface CheckoutWorkflowConfig {
  readonly checkoutId: string;
  readonly customerCount: number;
  readonly initialCoins: number;
  readonly initialStars?: number;
  readonly initialReputation?: number;
  readonly coinsPerCustomer: number;
  readonly completionCoins: number;
  readonly completionStars: number;
  readonly completionReputation: number;
  readonly mission: MissionDefinition;
}

export interface CheckoutWorkflowSnapshot {
  readonly phase: CheckoutPhase;
  readonly checkoutId: string;
  readonly customersServed: number;
  readonly totalCustomers: number;
  readonly coins: number;
  readonly stars: number;
  readonly reputation: number;
  readonly missionComplete: boolean;
}

export interface CheckoutCommandResult {
  readonly accepted: boolean;
  readonly snapshot: CheckoutWorkflowSnapshot;
}

export class CheckoutWorkflow {
  private phase: CheckoutPhase = "open";
  private customersServed = 0;
  private coins: number;
  private stars: number;
  private reputation: number;
  private rewarded = false;

  constructor(readonly config: CheckoutWorkflowConfig) {
    if (!Number.isInteger(config.customerCount) || config.customerCount <= 0) {
      throw new Error("Checkout customer count must be a positive integer");
    }
    const initialValues = [
      config.initialCoins,
      config.initialStars ?? 0,
      config.initialReputation ?? 0
    ];
    if (initialValues.some((value) => !Number.isFinite(value) || value < 0)) {
      throw new Error("Checkout initial economy cannot be negative");
    }
    this.coins = Math.floor(config.initialCoins);
    this.stars = Math.floor(config.initialStars ?? 0);
    this.reputation = Math.floor(config.initialReputation ?? 0);
  }

  dispatch(command: CheckoutCommand): CheckoutCommandResult {
    let accepted = false;

    if (command === "OPEN_REGISTER" && this.phase === "open") {
      this.phase = "serve";
      accepted = true;
    } else if (command === "SERVE_CUSTOMER" && this.phase === "serve") {
      this.customersServed += 1;
      this.coins += this.config.coinsPerCustomer;
      accepted = true;

      if (this.customersServed >= this.config.customerCount) {
        this.completeMission();
      }
    }

    return Object.freeze({ accepted, snapshot: this.snapshot() });
  }

  snapshot(): CheckoutWorkflowSnapshot {
    return Object.freeze({
      phase: this.phase,
      checkoutId: this.config.checkoutId,
      customersServed: this.customersServed,
      totalCustomers: this.config.customerCount,
      coins: this.coins,
      stars: this.stars,
      reputation: this.reputation,
      missionComplete: this.phase === "complete"
    });
  }

  private completeMission(): void {
    if (this.rewarded) return;
    this.rewarded = true;
    this.coins += this.config.completionCoins;
    this.stars += this.config.completionStars;
    this.reputation += this.config.completionReputation;
    this.phase = "complete";
  }
}
