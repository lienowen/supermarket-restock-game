import type { LevelId } from "./domain/gameTypes";
import { StorefrontScene } from "./scenes/StorefrontScene";

const PENDING_DAY_KEY = "supermarket.pendingDay";

type StorefrontPrototype = {
  startShift: (day: LevelId) => void;
};

const prototype = StorefrontScene.prototype as unknown as StorefrontPrototype;
const originalStartShift = prototype.startShift;

prototype.startShift = function startShiftWithPendingWeekOneDay(day: LevelId): void {
  try {
    globalThis.localStorage?.setItem(PENDING_DAY_KEY, day);
    globalThis.localStorage?.setItem("supermarket.activeDay", day);
  } catch {
    // GameSession still receives the selected day from the wrapped start method.
  }
  originalStartShift.call(this, day);
};
