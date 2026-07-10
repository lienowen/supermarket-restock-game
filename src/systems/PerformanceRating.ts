import type { ShiftPhase } from "../domain/gameTypes";

export type PerformanceRatingInput = {
  phase: ShiftPhase;
  soldCount: number;
  openSalesTarget: number;
  closingSalesTarget: number;
  missedSales: number;
  wrongStock: number;
  bestCombo: number;
};

export function calculatePerformanceStars(input: PerformanceRatingInput): number {
  const storeOpened = input.phase !== "PREPARE";
  if (!storeOpened) return 0;

  let stars = 1;

  if (input.soldCount >= input.openSalesTarget && input.missedSales <= 2) {
    stars = 2;
  }

  if (
    input.soldCount >= input.closingSalesTarget &&
    input.missedSales === 0 &&
    input.wrongStock === 0 &&
    input.bestCombo >= 2
  ) {
    stars = 3;
  }

  return stars;
}
