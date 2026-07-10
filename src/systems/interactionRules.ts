export type CartLoadState = "EMPTY" | "LOADING" | "READY" | "FULL";

export type BoxDragContext = {
  paused: boolean;
  shiftEnded: boolean;
  movingCart: boolean;
  restockBusy: boolean;
  cartAtShelf: boolean;
  boxLoaded: boolean;
  cartCount: number;
  cartCapacity: number;
};

export type CartMoveContext = {
  paused: boolean;
  shiftEnded: boolean;
  movingCart: boolean;
  restockBusy: boolean;
  fromSalesFloor: boolean;
  cartCount: number;
  departureRequirement: number;
};

export type RestockContext = {
  paused: boolean;
  shiftEnded: boolean;
  movingCart: boolean;
  restockBusy: boolean;
  cartAtShelf: boolean;
  slotOccupied: boolean;
  slotReserved: boolean;
  hasMatchingStock: boolean;
};

export function getCartLoadState(
  count: number,
  capacity: number,
  departureRequirement: number
): CartLoadState {
  const safeCapacity = Math.max(1, Math.floor(capacity));
  const safeCount = Math.max(0, Math.min(safeCapacity, Math.floor(count)));
  const safeRequirement = Math.max(1, Math.min(safeCapacity, Math.floor(departureRequirement)));

  if (safeCount === 0) return "EMPTY";
  if (safeCount >= safeCapacity) return "FULL";
  if (safeCount >= safeRequirement) return "READY";
  return "LOADING";
}

export function canDragBox(context: BoxDragContext): boolean {
  return !context.paused
    && !context.shiftEnded
    && !context.movingCart
    && !context.restockBusy
    && !context.cartAtShelf
    && !context.boxLoaded
    && context.cartCount < context.cartCapacity;
}

export function canMoveCart(context: CartMoveContext): boolean {
  if (context.paused || context.shiftEnded || context.movingCart || context.restockBusy) return false;
  if (context.fromSalesFloor) return true;
  return context.cartCount >= context.departureRequirement;
}

export function canRestock(context: RestockContext): boolean {
  return !context.paused
    && !context.shiftEnded
    && !context.movingCart
    && !context.restockBusy
    && context.cartAtShelf
    && !context.slotOccupied
    && !context.slotReserved
    && context.hasMatchingStock;
}
