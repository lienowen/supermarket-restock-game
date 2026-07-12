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
    title: "Opening Routine",
    objective: "Work a complete stock-associate shift: receive stock, prepare the floor, serve four customers, refill one live gap and close correctly.",
    zones: ["backroom", "drinks"],
    shiftSeconds: 240,
    salesTargets: { openToRush: 2, rushToClosing: 4 },
    customerIntervalsMs: { open: 6200, rush: 4600 },
    customerMix: { normal: 1 },
    features: { ...baseFeatures, rushHour: true, deliverySorting: true }
  },
  day02: {
    id: "day02",
    title: "Promotion & Checkout",
    objective: "Allocate promotion stock, operate checkout, process one return, remove damaged goods and complete six customer sales.",
    zones: ["backroom", "drinks", "promotion", "checkout", "service"],
    shiftSeconds: 300,
    salesTargets: { openToRush: 3, rushToClosing: 6 },
    customerIntervalsMs: { open: 6800, rush: 5000 },
    customerMix: { normal: 0.7, family: 0.15, promotion: 0.15 },
    features: {
      ...baseFeatures,
      customerWaiting: true,
      rushHour: true,
      queueManagement: true,
      shelfCorrection: true
    }
  },
  day03: {
    id: "day03",
    title: "Shift Supervisor",
    objective: "Inspect the store, manage service decisions, keep the rush under control, restore a failed register and close the floor professionally.",
    zones: ["backroom", "drinks", "checkout", "service"],
    shiftSeconds: 330,
    salesTargets: { openToRush: 4, rushToClosing: 8 },
    customerIntervalsMs: { open: 6500, rush: 4700 },
    customerMix: { normal: 0.55, impatient: 0.25, senior: 0.2 },
    features: {
      ...baseFeatures,
      customerWaiting: true,
      customerQuestions: true,
      substitutions: true,
      rushHour: true,
      queueManagement: true,
      incidents: true
    }
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
