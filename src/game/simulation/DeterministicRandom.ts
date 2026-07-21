const hashSeed = (seed: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

/** Small deterministic PRNG for repeatable levels, tests and replays. */
export class DeterministicRandom {
  private state: number;

  constructor(readonly seed: string) {
    if (!seed.trim()) throw new Error("Random seed is required");
    this.state = hashSeed(seed) || 0x6d2b79f5;
  }

  next(): number {
    let value = this.state += 0x6d2b79f5;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    const result = ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    this.state >>>= 0;
    return result;
  }

  integer(minInclusive: number, maxExclusive: number): number {
    if (!Number.isInteger(minInclusive) || !Number.isInteger(maxExclusive)) {
      throw new Error("Random integer bounds must be integers");
    }
    if (maxExclusive <= minInclusive) {
      throw new Error("Random integer max must be greater than min");
    }
    return minInclusive + Math.floor(this.next() * (maxExclusive - minInclusive));
  }

  pick<T>(values: readonly T[]): T {
    if (values.length === 0) throw new Error("Cannot pick from an empty collection");
    const value = values[this.integer(0, values.length)];
    if (value === undefined) throw new Error("Deterministic random selected an invalid index");
    return value;
  }

  snapshot(): number {
    return this.state;
  }
}
