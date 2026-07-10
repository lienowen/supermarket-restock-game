import type { CustomerState } from "../domain/gameTypes";

const ALLOWED_TRANSITIONS: Record<CustomerState, CustomerState[]> = {
  ENTER: ["BROWSE", "SEARCH", "LEAVE"],
  BROWSE: ["SEARCH", "BUY", "LEAVE"],
  SEARCH: ["WAIT", "ASK", "BUY", "LEAVE"],
  WAIT: ["ASK", "BUY", "LEAVE"],
  ASK: ["WAIT", "BUY", "LEAVE"],
  BUY: ["QUEUE", "LEAVE"],
  QUEUE: ["LEAVE"],
  LEAVE: []
};

export class CustomerStateMachine {
  private state: CustomerState = "ENTER";
  private patienceMs: number;

  constructor(initialPatienceMs: number) {
    this.patienceMs = Math.max(0, initialPatienceMs);
  }

  get current(): CustomerState {
    return this.state;
  }

  get patienceRemainingMs(): number {
    return this.patienceMs;
  }

  canTransition(to: CustomerState): boolean {
    return ALLOWED_TRANSITIONS[this.state].includes(to);
  }

  transition(to: CustomerState): boolean {
    if (!this.canTransition(to)) return false;
    this.state = to;
    return true;
  }

  tick(deltaMs: number): boolean {
    if (this.state !== "WAIT" && this.state !== "ASK" && this.state !== "QUEUE") return false;

    this.patienceMs = Math.max(0, this.patienceMs - Math.max(0, deltaMs));
    if (this.patienceMs > 0) return false;

    if (this.canTransition("LEAVE")) this.state = "LEAVE";
    return true;
  }

  extendPatience(extraMs: number): void {
    this.patienceMs += Math.max(0, extraMs);
  }
}

export { ALLOWED_TRANSITIONS };
