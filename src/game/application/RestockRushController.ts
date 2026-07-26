import {
  RestockPaceTracker,
  type RestockPaceGrade
} from "./RestockPaceTracker";

export type RestockSequenceMode = "fixed" | "shuffled";

export interface RestockRushConfig {
  readonly rowCount: number;
  readonly randomSeed: string;
  readonly itemsPerRow?: number;
  readonly sequenceMode?: RestockSequenceMode;
  readonly timeoutEnabled?: boolean;
  readonly keepTargetOnFailure?: boolean;
  readonly targetDurationMs?: number;
  readonly minimumTargetDurationMs?: number;
  readonly speedUpPerSuccessMs?: number;
  readonly introGraceMs?: number;
  readonly streakWindowMs?: number;
  readonly goldTimeMs?: number;
  readonly silverTimeMs?: number;
  readonly timingScale?: number;
}

export interface RestockRushSnapshot {
  readonly started: boolean;
  readonly complete: boolean;
  readonly activeRowIndex?: number;
  readonly activeRowItemCount: number;
  readonly filledRowIndexes: readonly number[];
  readonly rowItemCounts: readonly number[];
  readonly itemsPerRow: number;
  readonly totalItemsStocked: number;
  readonly remainingMs: number;
  readonly targetDurationMs: number;
  readonly remainingRatio: number;
  readonly currentStreak: number;
  readonly bestStreak: number;
  readonly mistakes: number;
  readonly elapsedMs: number;
  readonly grade?: RestockPaceGrade;
}

export type RestockRushTickEvent = "none" | "timeout";

export interface RestockRushTickResult {
  readonly event: RestockRushTickEvent;
  readonly snapshot: RestockRushSnapshot;
}

export interface RestockRushSelectionResult {
  readonly correct: boolean;
  readonly selectedRowIndex: number;
  readonly expectedRowIndex?: number;
  readonly stockedItemCount: number;
  readonly rowCompleted: boolean;
  readonly snapshot: RestockRushSnapshot;
}

const MAX_ACTIVE_CLOCK_STEP_MS = 250;

const requirePositive = (value: number, label: string): number => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive finite number`);
  }
  return value;
};

const requirePositiveInteger = (value: number, label: string): number => {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
  return value;
};

const requireNonNegative = (value: number, label: string): number => {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a finite number zero or greater`);
  }
  return value;
};

const requireTimestamp = (value: number): number => {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Restock rush timestamps must be finite and zero or greater");
  }
  return value;
};

const seedHash = (seed: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const createRandom = (seed: string): (() => number) => {
  let state = seedHash(seed) || 0x9e3779b9;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
};

const fixedRows = (rowCount: number): number[] => (
  Array.from({ length: rowCount }, (_, index) => index)
);

const shuffledRows = (rowCount: number, seed: string): number[] => {
  const result = fixedRows(rowCount);
  const random = createRandom(seed);
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
};

export class RestockRushController {
  private readonly baseTargetDurationMs: number;
  private readonly minimumTargetDurationMs: number;
  private readonly speedUpPerSuccessMs: number;
  private readonly introGraceMs: number;
  private readonly pace: RestockPaceTracker;
  private readonly queue: number[];
  private readonly initialQueue: readonly number[];
  private readonly filledRows = new Set<number>();
  private readonly rowItemCounts: number[];
  private readonly itemsPerRow: number;
  private readonly sequenceMode: RestockSequenceMode;
  private readonly timeoutEnabled: boolean;
  private readonly keepTargetOnFailure: boolean;
  private deadlineMs?: number;
  private currentTargetDurationMs: number;
  private introWindowActive = true;
  private mistakes = 0;
  private logicalNowMs?: number;
  private lastExternalTimestampMs?: number;
  private stallProtectionArmed = false;
  private started = false;

  constructor(readonly config: RestockRushConfig) {
    if (!Number.isInteger(config.rowCount) || config.rowCount <= 0) {
      throw new Error("Restock rush row count must be a positive integer");
    }
    if (!config.randomSeed.trim()) {
      throw new Error("Restock rush requires a random seed");
    }

    this.itemsPerRow = requirePositiveInteger(config.itemsPerRow ?? 1, "Items per restock row");
    this.rowItemCounts = Array.from({ length: config.rowCount }, () => 0);
    this.sequenceMode = config.sequenceMode ?? "shuffled";
    this.timeoutEnabled = config.timeoutEnabled ?? true;
    this.keepTargetOnFailure = config.keepTargetOnFailure ?? false;
    const timingScale = requirePositive(config.timingScale ?? 1, "Timing scale");
    this.baseTargetDurationMs = requirePositive(config.targetDurationMs ?? 3000, "Target duration") * timingScale;
    this.minimumTargetDurationMs = requirePositive(
      config.minimumTargetDurationMs ?? 1350,
      "Minimum target duration"
    ) * timingScale;
    this.speedUpPerSuccessMs = requirePositive(
      config.speedUpPerSuccessMs ?? 220,
      "Speed-up per success"
    ) * timingScale;
    this.introGraceMs = requireNonNegative(config.introGraceMs ?? 0, "Intro grace") * timingScale;
    if (this.minimumTargetDurationMs > this.baseTargetDurationMs) {
      throw new Error("Minimum target duration cannot exceed the starting target duration");
    }

    this.currentTargetDurationMs = this.baseTargetDurationMs + this.introGraceMs;
    this.queue = this.sequenceMode === "fixed"
      ? fixedRows(config.rowCount)
      : shuffledRows(config.rowCount, config.randomSeed);
    this.initialQueue = Object.freeze([...this.queue]);
    this.pace = new RestockPaceTracker({
      streakWindowMs: (config.streakWindowMs ?? 1450) * timingScale,
      goldTimeMs: (config.goldTimeMs ?? 30000) * timingScale,
      silverTimeMs: (config.silverTimeMs ?? 45000) * timingScale
    });
  }

  plannedRowIndexes(): readonly number[] {
    return this.initialQueue;
  }

  start(nowMs: number): RestockRushSnapshot {
    const now = this.advanceClock(nowMs, this.stallProtectionArmed);
    this.ensureStarted(now);
    return this.createSnapshot(now);
  }

  tick(nowMs: number): RestockRushTickResult {
    const now = this.advanceClock(nowMs, this.stallProtectionArmed);
    this.stallProtectionArmed = true;
    if (this.queue.length === 0) {
      return Object.freeze({ event: "none", snapshot: this.createSnapshot(now) });
    }
    this.ensureStarted(now);
    if (!this.timeoutEnabled || this.deadlineMs === undefined || now < this.deadlineMs) {
      return Object.freeze({ event: "none", snapshot: this.createSnapshot(now) });
    }

    this.mistakes += 1;
    this.pace.breakStreak(now);
    this.consumeIntroWindow();
    if (this.sequenceMode === "shuffled" && !this.keepTargetOnFailure) this.rotateTarget();
    this.resetDeadline(now);
    return Object.freeze({ event: "timeout", snapshot: this.createSnapshot(now) });
  }

  selectRow(rowIndex: number, nowMs: number): RestockRushSelectionResult {
    const now = this.advanceClock(nowMs, this.stallProtectionArmed);
    if (!Number.isInteger(rowIndex) || rowIndex < 0 || rowIndex >= this.config.rowCount) {
      throw new Error("Selected restock row is outside the configured shelf");
    }
    this.ensureStarted(now);

    const expectedRowIndex = this.queue[0];
    if (expectedRowIndex === undefined) {
      return Object.freeze({
        correct: false,
        selectedRowIndex: rowIndex,
        expectedRowIndex: undefined,
        stockedItemCount: this.rowItemCounts[rowIndex] ?? 0,
        rowCompleted: false,
        snapshot: this.createSnapshot(now)
      });
    }

    if (rowIndex !== expectedRowIndex) {
      this.mistakes += 1;
      this.pace.breakStreak(now);
      this.consumeIntroWindow();
      if (this.sequenceMode === "shuffled" && !this.keepTargetOnFailure) this.rotateTarget();
      if (this.timeoutEnabled) this.resetDeadline(now);
      return Object.freeze({
        correct: false,
        selectedRowIndex: rowIndex,
        expectedRowIndex,
        stockedItemCount: this.rowItemCounts[rowIndex] ?? 0,
        rowCompleted: false,
        snapshot: this.createSnapshot(now)
      });
    }

    const nextCount = Math.min(
      this.itemsPerRow,
      (this.rowItemCounts[rowIndex] ?? 0) + 1
    );
    this.rowItemCounts[rowIndex] = nextCount;
    this.pace.recordStock(now);
    this.introWindowActive = false;

    const rowCompleted = nextCount >= this.itemsPerRow;
    if (rowCompleted) {
      this.queue.shift();
      this.filledRows.add(rowIndex);
    }

    if (this.queue.length === 0) {
      this.deadlineMs = undefined;
      this.pace.complete(now);
    } else if (this.timeoutEnabled) {
      this.updateNormalTargetDuration();
      this.resetDeadline(now);
    }

    return Object.freeze({
      correct: true,
      selectedRowIndex: rowIndex,
      expectedRowIndex,
      stockedItemCount: nextCount,
      rowCompleted,
      snapshot: this.createSnapshot(now)
    });
  }

  snapshot(nowMs: number): RestockRushSnapshot {
    return this.createSnapshot(this.projectClock(nowMs));
  }

  private ensureStarted(nowMs: number): void {
    if (this.started || this.queue.length === 0) return;
    this.started = true;
    this.pace.start(nowMs);
    if (this.timeoutEnabled) this.deadlineMs = nowMs + this.currentTargetDurationMs;
  }

  private createSnapshot(nowMs: number): RestockRushSnapshot {
    const pace = this.pace.snapshot(nowMs);
    const remainingMs = !this.timeoutEnabled || this.deadlineMs === undefined
      ? 0
      : Math.max(0, this.deadlineMs - nowMs);
    const remainingRatio = this.queue.length === 0
      ? 0
      : !this.timeoutEnabled
        ? 1
        : this.deadlineMs === undefined
          ? 0
          : Math.max(0, Math.min(1, remainingMs / this.currentTargetDurationMs));
    const activeRowIndex = this.queue[0];
    const frozenCounts = Object.freeze([...this.rowItemCounts]);

    return Object.freeze({
      started: pace.started,
      complete: this.queue.length === 0,
      activeRowIndex,
      activeRowItemCount: activeRowIndex === undefined ? 0 : frozenCounts[activeRowIndex] ?? 0,
      filledRowIndexes: Object.freeze([...this.filledRows].sort((left, right) => left - right)),
      rowItemCounts: frozenCounts,
      itemsPerRow: this.itemsPerRow,
      totalItemsStocked: frozenCounts.reduce((sum, count) => sum + count, 0),
      remainingMs,
      targetDurationMs: this.currentTargetDurationMs,
      remainingRatio,
      currentStreak: pace.currentStreak,
      bestStreak: pace.bestStreak,
      mistakes: this.mistakes,
      elapsedMs: pace.elapsedMs,
      grade: pace.grade
    });
  }

  private advanceClock(nowMs: number, protectFromStall: boolean): number {
    const externalNow = requireTimestamp(nowMs);
    if (this.logicalNowMs === undefined || this.lastExternalTimestampMs === undefined) {
      this.logicalNowMs = externalNow;
      this.lastExternalTimestampMs = externalNow;
      return externalNow;
    }

    const elapsed = Math.max(0, externalNow - this.lastExternalTimestampMs);
    const activeElapsed = protectFromStall
      ? Math.min(elapsed, MAX_ACTIVE_CLOCK_STEP_MS)
      : elapsed;
    this.logicalNowMs += activeElapsed;
    this.lastExternalTimestampMs = externalNow;
    return this.logicalNowMs;
  }

  private projectClock(nowMs: number): number {
    const externalNow = requireTimestamp(nowMs);
    if (this.logicalNowMs === undefined || this.lastExternalTimestampMs === undefined) {
      return externalNow;
    }
    const elapsed = Math.max(0, externalNow - this.lastExternalTimestampMs);
    return this.logicalNowMs + (
      this.stallProtectionArmed
        ? Math.min(elapsed, MAX_ACTIVE_CLOCK_STEP_MS)
        : elapsed
    );
  }

  private consumeIntroWindow(): void {
    if (!this.introWindowActive) return;
    this.introWindowActive = false;
    this.updateNormalTargetDuration();
  }

  private updateNormalTargetDuration(): void {
    this.currentTargetDurationMs = Math.max(
      this.minimumTargetDurationMs,
      this.baseTargetDurationMs - this.filledRows.size * this.speedUpPerSuccessMs
    );
  }

  private rotateTarget(): void {
    if (this.queue.length <= 1) return;
    const current = this.queue.shift();
    if (current !== undefined) this.queue.push(current);
  }

  private resetDeadline(nowMs: number): void {
    if (!this.timeoutEnabled) {
      this.deadlineMs = undefined;
      return;
    }
    this.deadlineMs = nowMs + this.currentTargetDurationMs;
  }
}
