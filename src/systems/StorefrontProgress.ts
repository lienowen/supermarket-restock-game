import type { LevelId } from "../domain/gameTypes";
import type { GameSessionSnapshot } from "./GameSession";

const LAST_RESULT_KEY = "supermarket.lastShiftResult";
const BEST_STARS_KEY = "supermarket.bestStars";

export type ShiftResult = {
  day: LevelId;
  title: string;
  stars: number;
  soldCount: number;
  salesTarget: number;
  missedSales: number;
  wrongStock: number;
  bestCombo: number;
  satisfiedCustomers: number;
  walletCoins: number;
  completedAt: number;
};

type BestStars = Partial<Record<LevelId, number>>;

let lastResult = readJson<ShiftResult>(LAST_RESULT_KEY);
let bestStars = readJson<BestStars>(BEST_STARS_KEY) ?? {};

export function saveShiftResult(
  snapshot: GameSessionSnapshot,
  title: string,
  salesTarget: number
): ShiftResult {
  const result: ShiftResult = {
    day: snapshot.activeDay,
    title,
    stars: clampStars(snapshot.stars),
    soldCount: Math.max(0, Math.floor(snapshot.soldCount)),
    salesTarget: Math.max(1, Math.floor(salesTarget)),
    missedSales: Math.max(0, Math.floor(snapshot.missedSales)),
    wrongStock: Math.max(0, Math.floor(snapshot.wrongStock)),
    bestCombo: Math.max(0, Math.floor(snapshot.bestCombo)),
    satisfiedCustomers: Math.max(0, Math.floor(snapshot.satisfiedCustomers)),
    walletCoins: Math.max(0, Math.floor(snapshot.money)),
    completedAt: Date.now()
  };

  lastResult = result;
  bestStars[result.day] = Math.max(bestStars[result.day] ?? 0, result.stars);
  writeJson(LAST_RESULT_KEY, result);
  writeJson(BEST_STARS_KEY, bestStars);
  return result;
}

export function peekLastShiftResult(): ShiftResult | undefined {
  return lastResult;
}

export function clearLastShiftResult(): void {
  lastResult = undefined;
  try {
    globalThis.localStorage?.removeItem(LAST_RESULT_KEY);
  } catch {
    // The current session still works when browser storage is unavailable.
  }
}

export function bestStarsFor(day: LevelId): number {
  return clampStars(bestStars[day] ?? 0);
}

export function totalBestStars(): number {
  return Object.values(bestStars).reduce((sum, stars) => sum + clampStars(stars ?? 0), 0);
}

function clampStars(value: number): number {
  return Math.max(0, Math.min(3, Math.floor(value)));
}

function readJson<T>(key: string): T | undefined {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    return raw ? JSON.parse(raw) as T : undefined;
  } catch {
    return undefined;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
  } catch {
    // Persistence is optional; in-memory progress remains available.
  }
}
