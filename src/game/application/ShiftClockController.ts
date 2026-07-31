export type ShiftClockStatus = "running" | "expired" | "completed";
export type ShiftClockTickEvent = "none" | "expired";

export interface ShiftClockConfig {
  readonly durationSeconds: number;
  readonly maxActiveStepMs?: number;
}

export interface ShiftClockSnapshot {
  readonly status: ShiftClockStatus;
  readonly durationMs: number;
  readonly elapsedMs: number;
  readonly remainingMs: number;
  readonly remainingSeconds: number;
  readonly remainingRatio: number;
  readonly formattedTime: string;
}

export interface ShiftClockTickResult {
  readonly event: ShiftClockTickEvent;
  readonly snapshot: ShiftClockSnapshot;
}

const DEFAULT_MAX_ACTIVE_STEP_MS = 250;

const requirePositive = (value: number, label: string): number => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive finite number`);
  }
  return value;
};

/**
 * Pure shift-level countdown state. Large frame gaps are capped so a hidden tab
 * or a temporary device stall cannot consume the player's entire shift.
 */
export class ShiftClockController {
  private readonly durationMs: number;
  private readonly maxActiveStepMs: number;
  private remainingMs: number;
  private status: ShiftClockStatus = "running";

  constructor(readonly config: ShiftClockConfig) {
    this.durationMs = requirePositive(config.durationSeconds, "Shift duration") * 1000;
    this.maxActiveStepMs = requirePositive(
      config.maxActiveStepMs ?? DEFAULT_MAX_ACTIVE_STEP_MS,
      "Maximum active clock step"
    );
    this.remainingMs = this.durationMs;
  }

  tick(deltaMs: number): ShiftClockTickResult {
    if (!Number.isFinite(deltaMs) || deltaMs < 0) {
      throw new Error("Shift clock delta time must be finite and zero or greater");
    }
    if (this.status !== "running") {
      return Object.freeze({ event: "none", snapshot: this.snapshot() });
    }

    const activeDeltaMs = Math.min(deltaMs, this.maxActiveStepMs);
    this.remainingMs = Math.max(0, this.remainingMs - activeDeltaMs);
    if (this.remainingMs > 0) {
      return Object.freeze({ event: "none", snapshot: this.snapshot() });
    }

    this.status = "expired";
    return Object.freeze({ event: "expired", snapshot: this.snapshot() });
  }

  complete(): ShiftClockSnapshot {
    if (this.status === "running") this.status = "completed";
    return this.snapshot();
  }

  snapshot(): ShiftClockSnapshot {
    const elapsedMs = this.durationMs - this.remainingMs;
    const remainingSeconds = Math.ceil(this.remainingMs / 1000);
    return Object.freeze({
      status: this.status,
      durationMs: this.durationMs,
      elapsedMs,
      remainingMs: this.remainingMs,
      remainingSeconds,
      remainingRatio: Math.max(0, Math.min(1, this.remainingMs / this.durationMs)),
      formattedTime: formatShiftTime(remainingSeconds)
    });
  }
}

export const formatShiftTime = (remainingSeconds: number): string => {
  if (!Number.isFinite(remainingSeconds) || remainingSeconds < 0) {
    throw new Error("Shift time must be finite and zero or greater");
  }
  const wholeSeconds = Math.ceil(remainingSeconds);
  const minutes = Math.floor(wholeSeconds / 60);
  const seconds = wholeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};
