import type {
  CleanLevelRuntimeContent,
  FindItemsLevelRuntimeContent
} from "./UtilityLevelRuntimeContent";

export type UtilityTaskAction = "COLLECT_TOOLS" | "CLEAN_SPOT" | "PICK_ITEM";
export type UtilityTaskStep = "collect-tools" | "clean" | "find" | "complete";

export interface UtilityTaskSnapshot {
  readonly step: UtilityTaskStep;
  readonly progress: number;
  readonly total: number;
  readonly coins: number;
  readonly stars: number;
  readonly reputation: number;
}

export interface UtilityTaskCopy {
  readonly objective: string;
  readonly instruction: string;
  readonly actionLabel: string;
  readonly progressUnit: "SPOTS" | "ITEMS";
}

type Listener = (snapshot: UtilityTaskSnapshot, copy: UtilityTaskCopy) => void;

export class UtilityTaskSceneController {
  private readonly listeners = new Set<Listener>();
  private step: UtilityTaskStep;
  private progress = 0;
  private coins: number;
  private stars: number;
  private reputation: number;

  constructor(
    readonly runtime: CleanLevelRuntimeContent | FindItemsLevelRuntimeContent,
    initialEconomy: {
      readonly coins: number;
      readonly stars: number;
      readonly reputation: number;
    }
  ) {
    this.step = runtime.mode === "clean" ? "collect-tools" : "find";
    this.coins = initialEconomy.coins;
    this.stars = initialEconomy.stars;
    this.reputation = initialEconomy.reputation;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot(), this.copy());
    return () => this.listeners.delete(listener);
  }

  snapshot(): UtilityTaskSnapshot {
    return Object.freeze({
      step: this.step,
      progress: this.progress,
      total: this.total(),
      coins: this.coins,
      stars: this.stars,
      reputation: this.reputation
    });
  }

  actionForCurrentStep(): UtilityTaskAction | undefined {
    switch (this.step) {
      case "collect-tools": return "COLLECT_TOOLS";
      case "clean": return "CLEAN_SPOT";
      case "find": return "PICK_ITEM";
      case "complete": return undefined;
    }
  }

  dispatch(action: UtilityTaskAction): boolean {
    if (this.step === "collect-tools" && action === "COLLECT_TOOLS") {
      this.step = "clean";
      this.emit();
      return true;
    }
    if (this.step === "clean" && action === "CLEAN_SPOT") {
      return this.advance();
    }
    if (this.step === "find" && action === "PICK_ITEM") {
      return this.advance();
    }
    return false;
  }

  private advance(): boolean {
    if (this.step === "complete") return false;
    this.progress += 1;
    const total = this.total();
    const rewardPerProgress = Math.floor(this.runtime.reward.totalCoins / total);
    this.coins += rewardPerProgress;

    if (this.progress >= total) {
      this.coins += this.runtime.reward.totalCoins - rewardPerProgress * total;
      this.stars += this.runtime.reward.totalStars;
      this.reputation += this.runtime.reward.totalReputation;
      this.step = "complete";
    }
    this.emit();
    return true;
  }

  private total(): number {
    return this.runtime.mode === "clean"
      ? this.runtime.spotCount
      : this.runtime.products.length;
  }

  private copy(): UtilityTaskCopy {
    if (this.runtime.mode === "clean") {
      if (this.step === "collect-tools") {
        return Object.freeze({
          objective: this.runtime.mission.title,
          instruction: "Pick up the mop and cleaning cart from the supplies area.",
          actionLabel: "GET CLEANING TOOLS",
          progressUnit: "SPOTS" as const
        });
      }
      if (this.step === "complete") {
        return Object.freeze({
          objective: "Store floor spotless",
          instruction: "Every marked spill has been cleaned.",
          actionLabel: "TASK COMPLETE",
          progressUnit: "SPOTS" as const
        });
      }
      return Object.freeze({
        objective: this.runtime.mission.title,
        instruction: `Mop the highlighted spill. ${this.progress}/${this.total()} cleaned.`,
        actionLabel: "MOP FLOOR",
        progressUnit: "SPOTS" as const
      });
    }

    if (this.step === "complete") {
      return Object.freeze({
        objective: "Order complete",
        instruction: "All requested products are in the basket.",
        actionLabel: "TASK COMPLETE",
        progressUnit: "ITEMS" as const
      });
    }
    return Object.freeze({
      objective: this.runtime.mission.title,
      instruction: "Use the order list, search the shelf, and tap any requested product.",
      actionLabel: "TAP A PRODUCT",
      progressUnit: "ITEMS" as const
    });
  }

  private emit(): void {
    const snapshot = this.snapshot();
    const copy = this.copy();
    this.listeners.forEach((listener) => listener(snapshot, copy));
  }
}
