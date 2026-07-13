import { GameScene } from "./scenes/GameScene";
import { gameSession } from "./systems/GameSession";

const PENDING_DAY_KEY = "supermarket.pendingDay";
type WeekOneDay = "day01" | "day02" | "day03" | "day04" | "day05";

type GamePrototype = {
  create: () => void;
};

const prototype = GameScene.prototype as unknown as GamePrototype;
const originalCreate = prototype.create;

prototype.create = function createWithWeekOneDayGuard(): void {
  const requestedDay = readRequestedDay();
  document.body.dataset.requestedGameDay = requestedDay;

  try {
    globalThis.localStorage?.setItem("supermarket.activeDay", requestedDay);
  } catch {
    // The canonical in-memory session below is enough for the current run.
  }

  if (gameSession.day !== requestedDay) gameSession.reset(requestedDay);
  originalCreate.call(this);

  document.body.dataset.runtimeGameDay = gameSession.day;
  document.body.dataset.weekOneDayMatch = gameSession.day === requestedDay ? "ready" : "mismatch";

  try {
    globalThis.localStorage?.removeItem(PENDING_DAY_KEY);
  } catch {
    // A stale pending value is harmless because activeDay now matches the running scene.
  }
};

function readRequestedDay(): WeekOneDay {
  try {
    const pending = globalThis.localStorage?.getItem(PENDING_DAY_KEY);
    if (isWeekOneDay(pending)) return pending;
    const active = globalThis.localStorage?.getItem("supermarket.activeDay");
    return isWeekOneDay(active) ? active : "day01";
  } catch {
    return "day01";
  }
}

function isWeekOneDay(value: unknown): value is WeekOneDay {
  return value === "day01" || value === "day02" || value === "day03" || value === "day04" || value === "day05";
}
