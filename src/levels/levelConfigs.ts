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
    title: "Morning Restock",
    objective: "Learn the box → cart → shelf flow and finish a short shift.",
    zones: ["backroom", "drinks"],
    shiftSeconds: 180,
    salesTargets: { openToRush: 4, rushToClosing: 8 },
    customerIntervalsMs: { open: 2600, rush: 1450 },
    customerMix: { normal: 1 },
    features: { ...baseFeatures, rushHour: true }
  },
  day02: {
    id: "day02",
    title: "First Customers",
    objective: "Keep shelves available, use nearby Back Stock first, and save waiting customers.",
    zones: ["backroom", "drinks"],
    shiftSeconds: 210,
    salesTargets: { openToRush: 6, rushToClosing: 12 },
    customerIntervalsMs: { open: 2400, rush: 1350 },
    customerMix: { normal: 0.85, family: 0.15 },
    features: { ...baseFeatures, customerWaiting: true, rushHour: true }
  },
  day03: {
    id: "day03",
    title: "Please Wait",
    objective: "Serve waiting customers before their patience runs out.",
    zones: ["backroom", "drinks"],
    shiftSeconds: 240,
    salesTargets: { openToRush: 7, rushToClosing: 14 },
    customerIntervalsMs: { open: 2300, rush: 1250 },
    customerMix: { normal: 0.65, impatient: 0.35 },
    features: { ...baseFeatures, customerWaiting: true, substitutions: true, rushHour: true }
  },
  day04: {
    id: "day04",
    title: "Where Is It?",
    objective: "Answer product-location questions while maintaining shelves.",
    zones: ["backroom", "drinks", "dairy"],
    shiftSeconds: 270,
    salesTargets: { openToRush: 8, rushToClosing: 16 },
    customerIntervalsMs: { open: 2200, rush: 1200 },
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
    shiftSeconds: 300,
    salesTargets: { openToRush: 10, rushToClosing: 22 },
    customerIntervalsMs: { open: 2000, rush: 900 },
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
