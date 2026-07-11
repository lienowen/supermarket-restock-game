import type { LevelConfig, LevelId } from "../domain/gameTypes";

const baseFeatures = {
  customerWaiting: false,
  customerQuestions: false,
  substitutions: false,
  rushHour: false,
  shelfCorrection: false,
  deliverySorting: false,
  expiryCheck: false,
  queueManagement: false,
  incidents: false
} as const;

export const LEVELS: Record<LevelId, LevelConfig> = {
  day01: {
    id: "day01",
    title: "First Shift",
    objective: "Clock in, stock the drinks shelf, serve four customers and close the store cleanly.",
    zones: ["backroom", "drinks"],
    shiftSeconds: 210,
    salesTargets: { openToRush: 2, rushToClosing: 4 },
    customerIntervalsMs: { open: 6000, rush: 4300 },
    customerMix: { normal: 1 },
    features: { ...baseFeatures, rushHour: true }
  },
  day02: {
    id: "day02",
    title: "Promotion Shift",
    objective: "Prepare the store, run the promotion room, serve six customers and complete two store duties.",
    zones: ["backroom", "drinks", "promotion"],
    shiftSeconds: 300,
    salesTargets: { openToRush: 3, rushToClosing: 6 },
    customerIntervalsMs: { open: 6500, rush: 4600 },
    customerMix: { normal: 0.7, family: 0.15, promotion: 0.15 },
    features: { ...baseFeatures, customerWaiting: true, rushHour: true }
  },
  day03: {
    id: "day03",
    title: "Please Wait",
    objective: "Handle special requests, make service choices and keep customers satisfied.",
    zones: ["backroom", "drinks"],
    shiftSeconds: 300,
    salesTargets: { openToRush: 7, rushToClosing: 18 },
    customerIntervalsMs: { open: 6400, rush: 4500 },
    customerMix: { normal: 0.65, impatient: 0.35 },
    features: { ...baseFeatures, customerWaiting: true, substitutions: true, rushHour: true }
  },
  day04: {
    id: "day04",
    title: "Where Is It?",
    objective: "Answer product-location questions while maintaining shelves.",
    zones: ["backroom", "drinks", "dairy"],
    shiftSeconds: 300,
    salesTargets: { openToRush: 8, rushToClosing: 16 },
    customerIntervalsMs: { open: 5200, rush: 3600 },
    customerMix: { normal: 0.55, impatient: 0.2, senior: 0.25 },
    features: {
      ...baseFeatures,
      customerWaiting: true,
      customerQuestions: true,
      substitutions: true,
      rushHour: true
    }
  },
  day05: {
    id: "day05",
    title: "Lunch Rush",
    objective: "Prioritize customers, stock and service during a busy rush.",
    zones: ["backroom", "drinks", "dairy", "checkout"],
    shiftSeconds: 330,
    salesTargets: { openToRush: 10, rushToClosing: 22 },
    customerIntervalsMs: { open: 4400, rush: 3000 },
    customerMix: { normal: 0.4, impatient: 0.25, family: 0.2, picky: 0.15 },
    features: {
      ...baseFeatures,
      customerWaiting: true,
      customerQuestions: true,
      substitutions: true,
      rushHour: true,
      queueManagement: true,
      incidents: true
    }
  }
};

export const ACTIVE_LEVEL_ID: LevelId = "day01";
export const ACTIVE_LEVEL = LEVELS[ACTIVE_LEVEL_ID];
