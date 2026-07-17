import { DAY_ONE_LAYOUT } from "./supermarket/dayOneLayout";

/**
 * Day 1 immersion data bridge.
 * Keeps the first supermarket experience driven by layout data
 * so later scenes can add customers, shelves and expansion zones.
 */
export function getDayOneImmersionLayout() {
  return DAY_ONE_LAYOUT;
}
