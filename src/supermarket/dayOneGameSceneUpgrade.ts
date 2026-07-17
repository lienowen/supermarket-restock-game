export type DayOneUpgradeStage =
  | "LAYOUT_CONNECTED"
  | "FOUR_ZONES"
  | "EMPTY_SHELF_GUIDE"
  | "RESTOCK_TARGET"
  | "INTRO_FLOW";

export const DAY_ONE_GAMEPLAY_UPGRADE: Record<DayOneUpgradeStage, boolean> = {
  LAYOUT_CONNECTED: true,
  FOUR_ZONES: true,
  EMPTY_SHELF_GUIDE: true,
  RESTOCK_TARGET: true,
  INTRO_FLOW: true
};

export const DAY_ONE_PLAYER_JOURNEY = [
  "ENTER_STORE",
  "SEE_MISSING_SHELF",
  "FOLLOW_GUIDE",
  "MOVE_CART_TO_STOCKROOM",
  "RESTOCK_PRODUCT",
  "WELCOME_CUSTOMER"
] as const;
