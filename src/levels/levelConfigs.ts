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
  day01: { id: "day01", title: "Opening Routine", objective: "Work a complete stock-associate shift: receive stock, prepare the floor, serve four customers, refill one live gap and close correctly.", zones: ["backroom", "drinks"], shiftSeconds: 240, salesTargets: { openToRush: 2, rushToClosing: 4 }, customerIntervalsMs: { open: 6200, rush: 4600 }, customerMix: { normal: 1 }, features: { ...baseFeatures, rushHour: true, deliverySorting: true } },
  day02: { id: "day02", title: "Promotion & Checkout", objective: "Allocate promotion stock, operate checkout, process one return, remove damaged goods and complete six customer sales.", zones: ["backroom", "drinks", "promotion", "checkout", "service"], shiftSeconds: 300, salesTargets: { openToRush: 3, rushToClosing: 6 }, customerIntervalsMs: { open: 6800, rush: 5000 }, customerMix: { normal: 0.7, family: 0.15, promotion: 0.15 }, features: { ...baseFeatures, customerWaiting: true, rushHour: true, queueManagement: true, shelfCorrection: true } },
  day03: { id: "day03", title: "Floor Control", objective: "Take control of the sales floor.", zones: ["backroom", "drinks", "dairy", "snacks", "checkout", "service"], shiftSeconds: 360, salesTargets: { openToRush: 4, rushToClosing: 8 }, customerIntervalsMs: { open: 6500, rush: 4700 }, customerMix: { normal: 0.55, impatient: 0.25, senior: 0.2 }, features: { ...baseFeatures, customerWaiting: true, customerQuestions: true, substitutions: true, rushHour: true, queueManagement: true, incidents: true } },
  day04: { id: "day04", title: "Promotion Pressure", objective: "Keep sales-floor displays ready.", zones: ["backroom", "drinks", "snacks", "dairy", "promotion", "checkout"], shiftSeconds: 420, salesTargets: { openToRush: 6, rushToClosing: 12 }, customerIntervalsMs: { open: 5600, rush: 3600 }, customerMix: { normal: 0.45, impatient: 0.2, family: 0.15, promotion: 0.2 }, features: { ...baseFeatures, customerWaiting: true, substitutions: true, rushHour: true, shelfCorrection: true, queueManagement: true } },
  day05: { id: "day05", title: "Weekend Rush", objective: "Run the whole store through two demand surges.", zones: ["backroom", "drinks", "dairy", "snacks", "produce", "promotion", "checkout", "service"], shiftSeconds: 540, salesTargets: { openToRush: 8, rushToClosing: 18 }, customerIntervalsMs: { open: 4600, rush: 2800 }, customerMix: { normal: 0.35, impatient: 0.25, family: 0.2, picky: 0.1, bulk: 0.1 }, features: { ...baseFeatures, customerWaiting: true, customerQuestions: true, substitutions: true, rushHour: true, queueManagement: true, incidents: true, shelfCorrection: true } },
  day09: { id: "day09", title: "Priority Order", objective: "Complete the priority customer order with apple, cereal and milk before the deadline.", zones: ["backroom", "salesfloor", "priority"], shiftSeconds: 300, salesTargets: { openToRush: 3, rushToClosing: 3 }, customerIntervalsMs: { open: 7000, rush: 4500 }, customerMix: { priority: 1 }, features: { ...baseFeatures, customerWaiting: true, rushHour: true, shelfCorrection: true } }
};

export const ACTIVE_LEVEL_ID: LevelId = "day01";
export const ACTIVE_LEVEL = LEVELS[ACTIVE_LEVEL_ID];
