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
    objective: "Complete a fast first restock, serve the opening rush and close the store cleanly.",
    zones: ["backroom", "drinks"],
    shiftSeconds: 180,
    salesTargets: { openToRush: 4, rushToClosing: 8 },
    customerIntervalsMs: { open: 2600, rush: 1450 },
    customerMix: { normal: 1 },
    features: { ...baseFeatures, rushHour: true }
  },
  day02: {
    id: "day02",
    title: "Today's Hot Deal",
    objective: "Open the Promo End-Cap, split stock between two sales zones and survive the timed flash sale.",
    zones: ["backroom", "drinks", "promotion"],
    shiftSeconds: 240,
    salesTargets: { openToRush: 6, rushToClosing: 15 },
    customerIntervalsMs: { open: 2350, rush: 1300 },
    customerMix: { normal: 0.7, family: 0.15, promotion: 0.15 },
    features: { ...baseFeatures, customerWaiting: true, rushHour: true }
  },
  day03: {
    id: "day03",
    title: "Please Wait",
    objective: "Handle special requests, make service choices and keep customers satisfied.",
    zones: ["backroom", "drinks"],
    shiftSeconds: 270,
    salesTargets: { openToRush: 7, rushToClosing: 18 },
    customerIntervalsMs: { open: 2250, rush: 1200 },
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
