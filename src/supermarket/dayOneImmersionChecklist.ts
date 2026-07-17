export const DAY_ONE_IMMERSION_CHECKLIST = {
  opening: true,
  showStoreZones: true,
  highlightMissingShelf: true,
  guideCartMovement: true,
  restockFeedback: true,
  welcomeCustomerAfterRestock: true
} as const;

export type DayOneImmersionStep = keyof typeof DAY_ONE_IMMERSION_CHECKLIST;
