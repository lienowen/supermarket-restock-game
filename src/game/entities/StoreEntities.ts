export interface InventoryStack {
  readonly productId: string;
  quantity: number;
}

export class Inventory {
  private readonly stacks = new Map<string, number>();

  constructor(readonly capacity: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error("Inventory capacity must be a positive integer");
    }
  }

  get totalQuantity(): number {
    return [...this.stacks.values()].reduce((total, quantity) => total + quantity, 0);
  }

  quantityOf(productId: string): number {
    return this.stacks.get(productId) ?? 0;
  }

  add(productId: string, quantity: number): void {
    this.assertQuantity(quantity);
    if (this.totalQuantity + quantity > this.capacity) {
      throw new Error(`Inventory capacity exceeded for ${productId}`);
    }
    this.stacks.set(productId, this.quantityOf(productId) + quantity);
  }

  remove(productId: string, quantity: number): void {
    this.assertQuantity(quantity);
    const current = this.quantityOf(productId);
    if (current < quantity) {
      throw new Error(`Insufficient inventory for ${productId}`);
    }
    const next = current - quantity;
    if (next === 0) this.stacks.delete(productId);
    else this.stacks.set(productId, next);
  }

  snapshot(): readonly InventoryStack[] {
    return [...this.stacks.entries()].map(([productId, quantity]) => ({ productId, quantity }));
  }

  private assertQuantity(quantity: number): void {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error("Inventory quantity must be a positive integer");
    }
  }
}

export type WorkerAction =
  | "idle"
  | "walk"
  | "carry-medium"
  | "push-cart"
  | "load-cart"
  | "open-case"
  | "place-low"
  | "place-middle"
  | "place-high";

export class Worker {
  heldCaseId?: string;
  action: WorkerAction = "idle";

  constructor(readonly id: string) {}
}

export type CartMovementState = "idle" | "moving" | "parked";

export class RestockCart {
  readonly inventory: Inventory;
  movementState: CartMovementState = "idle";
  locationId: string;
  loadedCaseId?: string;

  constructor(
    readonly id: string,
    capacity: number,
    initialLocationId: string
  ) {
    this.inventory = new Inventory(capacity);
    this.locationId = initialLocationId;
  }
}

export type ProductCaseState = "stored" | "carried" | "loaded" | "open" | "empty";

export class ProductCase {
  state: ProductCaseState = "stored";

  constructor(
    readonly id: string,
    readonly productId: string,
    public quantity: number
  ) {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error("Product case quantity must be a positive integer");
    }
  }
}

export class StockFixture {
  readonly inventory: Inventory;

  constructor(
    readonly id: string,
    readonly acceptedProductIds: readonly string[],
    capacity: number,
    readonly slotCount: number
  ) {
    if (!Number.isInteger(slotCount) || slotCount <= 0) {
      throw new Error("Fixture slot count must be a positive integer");
    }
    this.inventory = new Inventory(capacity);
  }

  accepts(productId: string): boolean {
    return this.acceptedProductIds.includes(productId);
  }
}

export class Wallet {
  coins: number;
  stars: number;

  constructor(coins = 0, stars = 0) {
    this.coins = coins;
    this.stars = stars;
  }

  grant(coins: number, stars: number): void {
    if (coins < 0 || stars < 0) throw new Error("Rewards cannot be negative");
    this.coins += coins;
    this.stars += stars;
  }
}
