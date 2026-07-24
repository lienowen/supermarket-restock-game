export type FindItemsChallengeStatus = "active" | "complete" | "failed";

export interface FindItemsChallengeConfig {
  readonly productIds: readonly string[];
  readonly timeLimitSeconds: number;
  readonly mistakePenaltySeconds: number;
}

export interface FindItemsChallengeSnapshot {
  readonly status: FindItemsChallengeStatus;
  readonly collectedProductIds: readonly string[];
  readonly remainingProductIds: readonly string[];
  readonly remainingMs: number;
  readonly remainingSeconds: number;
  readonly mistakes: number;
}

export interface FindItemsSelectionResult {
  readonly accepted: boolean;
  readonly reason: "collected" | "already-collected" | "not-requested" | "inactive";
  readonly snapshot: FindItemsChallengeSnapshot;
}

const requirePositive = (value: number, label: string): number => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive finite number`);
  }
  return value;
};

const requireNonNegative = (value: number, label: string): number => {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be zero or greater`);
  }
  return value;
};

/** Pure gameplay state for a timed order hunt. Presentation owns movement and feedback. */
export class FindItemsChallengeController {
  private readonly productIds: readonly string[];
  private readonly requested = new Set<string>();
  private readonly collected = new Set<string>();
  private remainingMs: number;
  private mistakes = 0;
  private status: FindItemsChallengeStatus = "active";

  constructor(readonly config: FindItemsChallengeConfig) {
    if (config.productIds.length === 0) {
      throw new Error("Find-items challenge requires at least one product");
    }
    const normalized = config.productIds.map((productId) => productId.trim());
    if (normalized.some((productId) => productId.length === 0)) {
      throw new Error("Find-items product IDs cannot be empty");
    }
    if (new Set(normalized).size !== normalized.length) {
      throw new Error("Find-items product IDs must be unique");
    }
    requirePositive(config.timeLimitSeconds, "Find-items time limit");
    requireNonNegative(config.mistakePenaltySeconds, "Find-items mistake penalty");

    this.productIds = Object.freeze([...normalized]);
    this.productIds.forEach((productId) => this.requested.add(productId));
    this.remainingMs = config.timeLimitSeconds * 1000;
  }

  tick(deltaMs: number): FindItemsChallengeSnapshot {
    if (!Number.isFinite(deltaMs) || deltaMs < 0) {
      throw new Error("Find-items delta time must be finite and zero or greater");
    }
    if (this.status !== "active") return this.snapshot();

    this.remainingMs = Math.max(0, this.remainingMs - deltaMs);
    if (this.remainingMs === 0) this.status = "failed";
    return this.snapshot();
  }

  selectProduct(productId: string): FindItemsSelectionResult {
    const normalized = productId.trim();
    if (this.status !== "active") {
      return Object.freeze({ accepted: false, reason: "inactive", snapshot: this.snapshot() });
    }
    if (!this.requested.has(normalized)) {
      this.applyMistake();
      return Object.freeze({ accepted: false, reason: "not-requested", snapshot: this.snapshot() });
    }
    if (this.collected.has(normalized)) {
      this.applyMistake();
      return Object.freeze({ accepted: false, reason: "already-collected", snapshot: this.snapshot() });
    }

    this.collected.add(normalized);
    if (this.collected.size === this.productIds.length) this.status = "complete";
    return Object.freeze({ accepted: true, reason: "collected", snapshot: this.snapshot() });
  }

  recordMistake(): FindItemsChallengeSnapshot {
    if (this.status === "active") this.applyMistake();
    return this.snapshot();
  }

  snapshot(): FindItemsChallengeSnapshot {
    const collectedProductIds = this.productIds.filter((productId) => this.collected.has(productId));
    const remainingProductIds = this.productIds.filter((productId) => !this.collected.has(productId));
    return Object.freeze({
      status: this.status,
      collectedProductIds: Object.freeze(collectedProductIds),
      remainingProductIds: Object.freeze(remainingProductIds),
      remainingMs: this.remainingMs,
      remainingSeconds: Math.ceil(this.remainingMs / 1000),
      mistakes: this.mistakes
    });
  }

  private applyMistake(): void {
    this.mistakes += 1;
    this.remainingMs = Math.max(0, this.remainingMs - this.config.mistakePenaltySeconds * 1000);
    if (this.remainingMs === 0) this.status = "failed";
  }
}
