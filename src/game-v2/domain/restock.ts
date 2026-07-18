export type RestockAction =
  | "PICK_BOX"
  | "LOAD_CART"
  | "PUSH_CART"
  | "PARK_CART"
  | "OPEN_BOX"
  | "RESTOCK_ROW";

export type RestockStep =
  | "collect"
  | "load"
  | "push"
  | "park"
  | "open"
  | "restock"
  | "complete";

export type RestockSnapshot = Readonly<{
  step: RestockStep;
  stockedRows: number;
  totalRows: number;
  boxCollected: boolean;
  boxLoaded: boolean;
  cartAtCooler: boolean;
  boxOpened: boolean;
  coins: number;
  stars: number;
}>;

export type DispatchResult = Readonly<{
  accepted: boolean;
  snapshot: RestockSnapshot;
}>;

export class RestockSession {
  private step: RestockStep = "collect";
  private stockedRows = 0;
  private readonly totalRows: number;
  private boxCollected = false;
  private boxLoaded = false;
  private cartAtCooler = false;
  private boxOpened = false;
  private coins = 100;
  private stars = 0;

  constructor(totalRows = 6) {
    if (!Number.isInteger(totalRows) || totalRows <= 0) {
      throw new Error("totalRows must be a positive integer");
    }
    this.totalRows = totalRows;
  }

  dispatch(action: RestockAction): DispatchResult {
    const accepted = this.apply(action);
    return { accepted, snapshot: this.snapshot() };
  }

  snapshot(): RestockSnapshot {
    return Object.freeze({
      step: this.step,
      stockedRows: this.stockedRows,
      totalRows: this.totalRows,
      boxCollected: this.boxCollected,
      boxLoaded: this.boxLoaded,
      cartAtCooler: this.cartAtCooler,
      boxOpened: this.boxOpened,
      coins: this.coins,
      stars: this.stars
    });
  }

  private apply(action: RestockAction): boolean {
    switch (action) {
      case "PICK_BOX":
        if (this.step !== "collect") return false;
        this.boxCollected = true;
        this.step = "load";
        return true;
      case "LOAD_CART":
        if (this.step !== "load" || !this.boxCollected) return false;
        this.boxLoaded = true;
        this.step = "push";
        return true;
      case "PUSH_CART":
        if (this.step !== "push" || !this.boxLoaded) return false;
        this.step = "park";
        return true;
      case "PARK_CART":
        if (this.step !== "park") return false;
        this.cartAtCooler = true;
        this.step = "open";
        return true;
      case "OPEN_BOX":
        if (this.step !== "open" || !this.cartAtCooler) return false;
        this.boxOpened = true;
        this.step = "restock";
        return true;
      case "RESTOCK_ROW":
        if (this.step !== "restock" || !this.boxOpened) return false;
        this.stockedRows += 1;
        this.coins += 10;
        if (this.stockedRows >= this.totalRows) {
          this.stockedRows = this.totalRows;
          this.stars = 1;
          this.coins += 40;
          this.step = "complete";
        }
        return true;
    }
  }
}
