import { GameScene } from "./scenes/GameScene";
import { gameSession } from "./systems/GameSession";

type WeekOneDay = "day01" | "day02" | "day03" | "day04" | "day05";

type GamePrototype = {
  create: () => void;
};

const prototype = GameScene.prototype as unknown as GamePrototype;
const originalCreate = prototype.create;

prototype.create = function createWithWeekOneDayGuard(): void {
  const requestedDay = readStoredDay();
  document.body.dataset.requestedGameDay = requestedDay;

  if (gameSession.day !== requestedDay) gameSession.reset(requestedDay);
  originalCreate.call(this);

  document.body.dataset.runtimeGameDay = gameSession.day;
  document.body.dataset.weekOneDayMatch = gameSession.day === requestedDay ? "ready" : "mismatch";

  if (
    new URLSearchParams(globalThis.location?.search ?? "").get("test") === "1" &&
    (requestedDay === "day04" || requestedDay === "day05") &&
    document.body.dataset.weekOneBatchFloor !== requestedDay
  ) {
    console.error([
      "[week-one-runtime]",
      `stored=${globalThis.localStorage?.getItem("supermarket.activeDay") ?? "none"}`,
      `requested=${requestedDay}`,
      `runtime=${gameSession.day}`,
      `batch=${document.body.dataset.weekOneBatchFloor ?? "none"}`,
      `scene=${document.body.dataset.gameScene ?? "none"}`
    ].join(" "));
  }
};

function readStoredDay(): WeekOneDay {
  try {
    const stored = globalThis.localStorage?.getItem("supermarket.activeDay");
    return isWeekOneDay(stored) ? stored : "day01";
  } catch {
    return "day01";
  }
}

function isWeekOneDay(value: unknown): value is WeekOneDay {
  return value === "day01" || value === "day02" || value === "day03" || value === "day04" || value === "day05";
}
