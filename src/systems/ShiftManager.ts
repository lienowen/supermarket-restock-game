import type { LevelConfig, ShiftPhase } from "../domain/gameTypes";

export type ShiftTransition = {
  from: ShiftPhase;
  to: ShiftPhase;
  reason: "INITIAL_RESTOCK_COMPLETE" | "OPEN_TARGET_REACHED" | "RUSH_TARGET_REACHED" | "SHIFT_FINISHED";
};

export class ShiftManager {
  private phase: ShiftPhase = "PREPARE";
  private soldCount = 0;

  constructor(private readonly level: LevelConfig) {}

  get currentPhase(): ShiftPhase {
    return this.phase;
  }

  get sales(): number {
    return this.soldCount;
  }

  openStore(): ShiftTransition | undefined {
    if (this.phase !== "PREPARE") return undefined;
    return this.transitionTo("OPEN", "INITIAL_RESTOCK_COMPLETE");
  }

  recordSale(): ShiftTransition | undefined {
    if (this.phase !== "OPEN" && this.phase !== "RUSH") return undefined;

    this.soldCount += 1;

    if (this.phase === "OPEN" && this.soldCount >= this.level.salesTargets.openToRush) {
      return this.transitionTo("RUSH", "OPEN_TARGET_REACHED");
    }

    if (this.phase === "RUSH" && this.soldCount >= this.level.salesTargets.rushToClosing) {
      return this.transitionTo("CLOSING", "RUSH_TARGET_REACHED");
    }

    return undefined;
  }

  finishShift(): ShiftTransition | undefined {
    if (this.phase === "RESULT") return undefined;
    return this.transitionTo("RESULT", "SHIFT_FINISHED");
  }

  allowsCustomers(): boolean {
    return this.phase === "OPEN" || this.phase === "RUSH";
  }

  reset(): void {
    this.phase = "PREPARE";
    this.soldCount = 0;
  }

  private transitionTo(to: ShiftPhase, reason: ShiftTransition["reason"]): ShiftTransition {
    const from = this.phase;
    this.phase = to;
    return { from, to, reason };
  }
}
