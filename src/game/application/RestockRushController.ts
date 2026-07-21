import {
  RestockPaceTracker,
  type RestockPaceGrade
} from "./RestockPaceTracker";

export interface RestockRushConfig {
  readonly rowCount: number;
  readonly randomSeed: string;
  readonly targetDurationMs?: number;
  readonly minimumTargetDurationMs?: number;
  readonly speedUpPerSuccessMs?: number;
  readonly streakWindowMs?: number;
  readonly goldTimeMs?: number;
  readonly silverTimeMs?: number;
}

export interface RestockRushSnapshot {
  readonly started: boolean;
  readonly complete: boolean;
  readonly activeRowIndex?: number;
  readonly filledRowIndexes: readonly number[];
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
  readonly snapshot: RestockRushSnapshot;
}

const requirePositive = (value: number, label: string): number => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive finite number`);
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

const shuffledRows = (rowCount: number, seed: string): number[] => {
  const result = Array.from({ length: rowCount }, (_, index) => index);
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
  private readonly pace: RestockPaceTracker;
  private readonly queue: number[];
  private readonly filledRows = new Set<number>();
  private deadlineMs?: number;
  private currentTargetDurationMs: number;
  private mistakes = 0;

  constructor(readonly config: RestockRushConfig) {
    if (!Number.isInteger(config.rowCount) || config.rowCount <= 0) {
      throw new Error("Restock rush row count must be a positive integer");
    }
    if (!config.randomSeed.trim()) {
      throw new Error("Restock rush requires a random seed");
    }

    this.baseTargetDurationMs = requirePositive(config.targetDurationMs ?? 3000, "Target duration");
    this.minimumTargetDurationMs = requirePositive(
      config.minimumTargetDurationMs ?? 1350,
      "Minimum target duration"
    );
    this.speedUpPerSuccessMs = requirePositive(config.speedUpPerSuccessMs ?? 220, "Speed-up per success");
    if (this.minimumTargetDurationMs > this.baseTargetDurationMs) {
      throw new Error("Minimum target duration cannot exceed the starting target duration");
    }

    this.currentTargetDurationMs = this.baseTargetDurationMs;
    this.queue = shuffledRows(config.rowCount, config.randomSeed);
    this.pace = new RestockPaceTracker({
      streakWindowMs: config.streakWindowMs,
      goldTimeMs: config.goldTimeMs,
      silverTimeMs: config.silverTimeMs
    });
  }

  start(nowMs: number): RestockRushSnapshot {
    const now = requireTimestamp(nowMs);
    if (this.deadlineMs === undefined && this.queue.length > 0) {
      this.pace.start(now);
      this.deadlineMs = now + this.currentTargetDurationMs;
    }
    return this.snapshot(now);
  }

  tick(nowMs: number): RestockRushTickResult {
    const now = requireTimestamp(nowMs);
    if (this.queue.length === 0) {
      return Object.freeze({ event: "none", snapshot: this.snapshot(now) });
    }
    this.start(now);
    if (this.deadlineMs === undefined || now < this.deadlineMs) {
      return Object.freeze({ event: "none", snapshot: this.snapshot(now) });
    }

    this.mistakes += 1;
    this.pace.breakStreak(now);
    this.rotateTarget();
    this.resetDeadline(now);
    return Object.freeze({ event: "timeout", snapshot: this.snapshot(now) });
  }

  selectRow(rowIndex: number, nowMs: number): RestockRushSelectionResult {
    const now = requireTimestamp(nowMs);
    if (!Number.isInteger(rowIndex) || rowIndex < 0 || rowIndex >= this.config.rowCount) {
      throw new Error("Selected restock row is outside the configured shelf");
    }
    this.start(now);

    const expectedRowIndex = this.queue[0];
    if (expectedRowIndex === undefined) {
      return Object.freeze({
        correct: false,
        selectedRowIndex: rowIndex,
        expectedRowIndex: undefined,
        snapshot: this.snapshot(now)
      });
    }

    if (rowIndex !== expectedRowIndex) {
      this.mistakes += 1;
      this.pace.breakStreak(now);
      this.rotateTarget();
      this.resetDeadline(now);
      return Object.freeze({
        correct: false,
        selectedRowIndex: rowIndex,
        expectedRowIndex,
        snapshot: this.snapshot(now)
      });
    }

    this.queue.shift();
    this.filledRows.add(rowIndex);
    this.pace.recordStock(now);

    if (this.queue.length === 0) {
      this.deadlineMs = undefined;
      this.pace.complete(now);
    } else {
      this.currentTargetDurationMs = Math.max(
        this.minimumTargetDurationMs,
        this.baseTargetDurationMs - this.filledRows.size * this.speedUpPerSuccessMs
      );
      this.resetDeadline(now);
    }

    return Object.freeze({
      correct: true,
      selectedRowIndex: rowIndex,
      expectedRowIndex,
      snapshot: this.snapshot(now)
    });
  }

  snapshot(nowMs: number): RestockRushSnapshot {
    const now = requireTimestamp(nowMs);
    const pace = this.pace.snapshot(now);
    const remainingMs = this.deadlineMs === undefined
      ? 0
      : Math.max(0, this.deadlineMs - now);
    const remainingRatio = this.deadlineMs === undefined
      ? 0
      : Math.max(0, Math.min(1, remainingMs / this.currentTargetDurationMs));

    return Object.freeze({
      started: pace.started,
      complete: this.queue.length === 0,
      activeRowIndex: this.queue[0],
      filledRowIndexes: Object.freeze([...this.filledRows].sort((left, right) => left - right)),
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

  private rotateTarget(): void {
    if (this.queue.length <= 1) return;
    const current = this.queue.shift();
    if (current !== undefined) this.queue.push(current);
  }

  private resetDeadline(nowMs: number): void {
    this.deadlineMs = nowMs + this.currentTargetDurationMs;
  }
}
