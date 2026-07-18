import type { DomainEventBus } from "../core/DomainEventBus";
import type { MissionDefinition, MissionObjectiveDefinition } from "../content/GameContent";

export interface MissionObjectiveProgress {
  readonly objective: MissionObjectiveDefinition;
  readonly current: number;
  readonly required: number;
  readonly complete: boolean;
}

export interface MissionProgressSnapshot {
  readonly missionId: string;
  readonly objectives: readonly MissionObjectiveProgress[];
  readonly complete: boolean;
}

function requiredAmount(objective: MissionObjectiveDefinition): number {
  switch (objective.type) {
    case "transfer-product": return objective.amount;
    case "operate-checkout": return objective.customerCount;
    case "clean-zone": return objective.amount;
  }
}

export class MissionTracker {
  private readonly progress: number[];
  private completed = false;

  constructor(
    readonly mission: MissionDefinition,
    private readonly events: DomainEventBus
  ) {
    this.progress = mission.objectives.map(() => 0);
  }

  recordProductTransfer(productId: string, targetFixtureId: string, amount: number): void {
    this.mission.objectives.forEach((objective, index) => {
      if (
        objective.type === "transfer-product" &&
        objective.productId === productId &&
        objective.targetFixtureId === targetFixtureId
      ) {
        this.progress[index] = Math.min(requiredAmount(objective), this.progress[index] + amount);
      }
    });
    this.checkCompletion();
  }

  snapshot(): MissionProgressSnapshot {
    const objectives = this.mission.objectives.map((objective, index) => {
      const required = requiredAmount(objective);
      const current = this.progress[index];
      return Object.freeze({ objective, current, required, complete: current >= required });
    });
    return Object.freeze({
      missionId: this.mission.id,
      objectives,
      complete: objectives.every((objective) => objective.complete)
    });
  }

  private checkCompletion(): void {
    if (this.completed || !this.snapshot().complete) return;
    this.completed = true;
    this.events.emit("mission.completed", { missionId: this.mission.id });
  }
}
