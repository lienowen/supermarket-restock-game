import type { LevelId } from "./domain/gameTypes";
import { StorefrontScene } from "./scenes/StorefrontScene";

const ACTIVE_DAY_KEY = "supermarket.activeDay";
const WEEK_ONE_DAY_KEY = "supermarket.weekOneSelectedDay";
const PENDING_DAY_KEY = "supermarket.pendingDay";
type WeekOneDay = "day01" | "day02" | "day03" | "day04" | "day05";

type StorefrontPrototype = {
  create: (...args: unknown[]) => void;
  resolveActiveDay: () => WeekOneDay;
  setActiveDay: (day: LevelId) => void;
  startShift: (day: LevelId) => void;
};

const prototype = StorefrontScene.prototype as unknown as StorefrontPrototype;
const originalCreate = prototype.create;
const originalResolve = prototype.resolveActiveDay;
const originalSetActiveDay = prototype.setActiveDay;
const originalStartShift = prototype.startShift;

prototype.create = function createWithPersistentWeekOneSelection(...args: unknown[]): void {
  const selected = readPreferredDay();
  persistSelection(selected);
  originalCreate.apply(this, args);
  persistSelection(selected);
};

prototype.resolveActiveDay = function resolvePersistentWeekOneSelection(): WeekOneDay {
  const selected = readWeekOneDay(WEEK_ONE_DAY_KEY);
  if (selected) return selected;
  const active = readWeekOneDay(ACTIVE_DAY_KEY);
  if (active) return active;
  const resolved = originalResolve.call(this);
  return isWeekOneDay(resolved) ? resolved : "day01";
};

prototype.setActiveDay = function setPersistentWeekOneSelection(day: LevelId): void {
  const selected = isWeekOneDay(day) ? day : "day01";
  persistSelection(selected);
  originalSetActiveDay.call(this, selected);
  persistSelection(selected);
};

prototype.startShift = function startPersistentWeekOneSelection(day: LevelId): void {
  const selected = isWeekOneDay(day) ? day : readPreferredDay();
  persistSelection(selected);
  try {
    globalThis.localStorage?.setItem(PENDING_DAY_KEY, selected);
  } catch {
    // The wrapped start method still receives the selected day directly.
  }
  originalStartShift.call(this, selected);
};

function readPreferredDay(): WeekOneDay {
  return readWeekOneDay(WEEK_ONE_DAY_KEY) ?? readWeekOneDay(ACTIVE_DAY_KEY) ?? "day01";
}

function readWeekOneDay(key: string): WeekOneDay | undefined {
  try {
    const value = globalThis.localStorage?.getItem(key);
    return isWeekOneDay(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

function persistSelection(day: WeekOneDay): void {
  try {
    globalThis.localStorage?.setItem(WEEK_ONE_DAY_KEY, day);
    globalThis.localStorage?.setItem(ACTIVE_DAY_KEY, day);
  } catch {
    // Storefront methods still keep the selected day in the current session.
  }
}

function isWeekOneDay(value: unknown): value is WeekOneDay {
  return value === "day01" || value === "day02" || value === "day03" || value === "day04" || value === "day05";
}
