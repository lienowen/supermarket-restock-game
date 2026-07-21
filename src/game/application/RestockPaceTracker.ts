export type RestockPaceGrade = "GOLD" | "SILVER" | "BRONZE";

export interface RestockPaceTrackerConfig {
  readonly streakWindowMs?: number;
  readonly goldTimeMs?: number;
  readonly silverTimeMs?: number;
}

export interface RestockPaceSnapshot {
  readonly started: boolean;
  readonly completed: boolean;
  readonly elapsedMs: number;
  readonly currentStreak: number;
  readonly bestStreak: number;
  readonly grade?: RestockPaceGrade;
}

const requirePositive = (value: number, label: string): number => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive finite number`);
  }
  return value;
};

const requireTimestamp = (value: number): number => {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Restock pace timestamps must be finite and zero or greater");
  }
  return value;
};

export class RestockPaceTracker {
  private readonly streakWindowMs: number;
  private readonly goldTimeMs: number;
  private readonly silverTimeMs: number;
  private startedAtMs?: number;
  private completedAtMs?: number;
  private lastStockAtMs?: number;
  private currentStreak = 0;
  private bestStreak = 0;

  constructor(config: RestockPaceTrackerConfig = {}) {
    this.streakWindowMs = requirePositive(config.streakWindowMs ?? 1450, "Streak window");
    this.goldTimeMs = requirePositive(config.goldTimeMs ?? 30000, "Gold time");
    this.silverTimeMs = requirePositive(config.silverTimeMs ?? 45000, "Silver time");
    if (this.goldTimeMs >= this.silverTimeMs) {
      throw new Error("Gold time must be lower than silver time");
    }
  }

  start(nowMs: number): RestockPaceSnapshot {
    const now = requireTimestamp(nowMs);
    this.startedAtMs ??= now;
    return this.snapshot(now);
  }

  recordStock(nowMs: number): RestockPaceSnapshot {
    const now = requireTimestamp(nowMs);
    if (this.completedAtMs !== undefined) {
      throw new Error("Cannot record restock progress after completion");
    }
    this.startedAtMs ??= now;
    this.currentStreak = this.lastStockAtMs !== undefined && now - this.lastStockAtMs <= this.streakWindowMs
      ? this.currentStreak + 1
      : 1;
    this.bestStreak = Math.max(this.bestStreak, this.currentStreak);
    this.lastStockAtMs = now;
    return this.snapshot(now);
  }

  complete(nowMs: number): RestockPaceSnapshot {
    const now = requireTimestamp(nowMs);
    this.startedAtMs ??= now;
    this.completedAtMs ??= Math.max(now, this.startedAtMs);
    return this.snapshot(this.completedAtMs);
  }

  snapshot(nowMs: number): RestockPaceSnapshot {
    const now = requireTimestamp(nowMs);
    const startedAt = this.startedAtMs;
    const completedAt = this.completedAtMs;
    const elapsedMs = startedAt === undefined
      ? 0
      : Math.max(0, (completedAt ?? now) - startedAt);
    const grade = completedAt === undefined ? undefined : this.gradeFor(elapsedMs);
    return Object.freeze({
      started: startedAt !== undefined,
      completed: completedAt !== undefined,
      elapsedMs,
      currentStreak: this.currentStreak,
      bestStreak: this.bestStreak,
      grade
    });
  }

  private gradeFor(elapsedMs: number): RestockPaceGrade {
    if (elapsedMs <= this.goldTimeMs) return "GOLD";
    if (elapsedMs <= this.silverTimeMs) return "SILVER";
    return "BRONZE";
  }
}
