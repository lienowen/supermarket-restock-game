import { DomainEventBus } from "../../core/DomainEventBus";
import {
  ProductCase,
  RestockCart,
  StockFixture,
  Wallet,
  Worker
} from "../../entities/StoreEntities";
import { MissionTracker } from "../../missions/MissionTracker";
import type { MissionDefinition } from "../../content/GameContent";

export type RestockCommand =
  | "PICK_CASE"
  | "LOAD_CART"
  | "PUSH_CART"
  | "PARK_CART"
  | "OPEN_CASE"
  | "STOCK_SLOT";

export type RestockPhase =
  | "collect"
  | "load"
  | "push"
  | "park"
  | "open"
  | "restock"
  | "complete";

export interface RestockWorkflowConfig {
  readonly workerId: string;
  readonly cartId: string;
  readonly caseId: string;
  readonly productId: string;
  readonly fixtureId: string;
  readonly sourceLocationId: string;
  readonly destinationLocationId: string;
  readonly caseQuantity: number;
  readonly unitsPerSlot: number;
  readonly slotCount: number;
  readonly cartCapacity: number;
  readonly initialCoins: number;
  readonly coinsPerSlot: number;
  readonly completionCoins: number;
  readonly completionStars: number;
  readonly mission: MissionDefinition;
}

export interface RestockWorkflowSnapshot {
  readonly phase: RestockPhase;
  readonly stockedSlots: number;
  readonly totalSlots: number;
  readonly caseCollected: boolean;
  readonly caseLoaded: boolean;
  readonly cartAtFixture: boolean;
  readonly caseOpened: boolean;
  readonly caseQuantity: number;
  readonly fixtureQuantity: number;
  readonly missionComplete: boolean;
  readonly coins: number;
  readonly stars: number;
}

export interface RestockDispatchResult {
  readonly accepted: boolean;
  readonly snapshot: RestockWorkflowSnapshot;
}

export class RestockWorkflow {
  readonly events = new DomainEventBus();
  readonly worker: Worker;
  readonly cart: RestockCart;
  readonly productCase: ProductCase;
  readonly fixture: StockFixture;
  readonly wallet: Wallet;
  readonly mission: MissionTracker;

  private phase: RestockPhase = "collect";
  private stockedSlots = 0;
  private rewardsGranted = false;

  constructor(readonly config: RestockWorkflowConfig) {
    this.validateConfig(config);
    this.worker = new Worker(config.workerId);
    this.cart = new RestockCart(config.cartId, config.cartCapacity, config.sourceLocationId);
    this.productCase = new ProductCase(config.caseId, config.productId, config.caseQuantity);
    this.fixture = new StockFixture(
      config.fixtureId,
      [config.productId],
      config.caseQuantity,
      config.slotCount
    );
    this.wallet = new Wallet(config.initialCoins, 0);
    this.mission = new MissionTracker(config.mission, this.events);
  }

  dispatch(command: RestockCommand): RestockDispatchResult {
    const accepted = this.apply(command);
    return Object.freeze({ accepted, snapshot: this.snapshot() });
  }

  snapshot(): RestockWorkflowSnapshot {
    return Object.freeze({
      phase: this.phase,
      stockedSlots: this.stockedSlots,
      totalSlots: this.config.slotCount,
      caseCollected: this.productCase.state !== "stored",
      caseLoaded: ["loaded", "open", "empty"].includes(this.productCase.state),
      cartAtFixture: this.cart.locationId === this.config.destinationLocationId,
      caseOpened: ["open", "empty"].includes(this.productCase.state),
      caseQuantity: this.productCase.quantity,
      fixtureQuantity: this.fixture.inventory.quantityOf(this.config.productId),
      missionComplete: this.mission.snapshot().complete,
      coins: this.wallet.coins,
      stars: this.wallet.stars
    });
  }

  commandForCurrentPhase(): RestockCommand | undefined {
    switch (this.phase) {
      case "collect": return "PICK_CASE";
      case "load": return "LOAD_CART";
      case "push": return "PUSH_CART";
      case "park": return "PARK_CART";
      case "open": return "OPEN_CASE";
      case "restock": return "STOCK_SLOT";
      case "complete": return undefined;
    }
  }

  private apply(command: RestockCommand): boolean {
    switch (command) {
      case "PICK_CASE": return this.pickCase();
      case "LOAD_CART": return this.loadCart();
      case "PUSH_CART": return this.pushCart();
      case "PARK_CART": return this.parkCart();
      case "OPEN_CASE": return this.openCase();
      case "STOCK_SLOT": return this.stockSlot();
    }
  }

  private pickCase(): boolean {
    if (this.phase !== "collect" || this.productCase.state !== "stored") return false;
    this.productCase.state = "carried";
    this.worker.heldCaseId = this.productCase.id;
    this.worker.action = "carry-medium";
    this.phase = "load";
    this.events.emit("case.picked-up", { caseId: this.productCase.id, workerId: this.worker.id });
    return true;
  }

  private loadCart(): boolean {
    if (this.phase !== "load" || this.worker.heldCaseId !== this.productCase.id) return false;
    this.worker.action = "load-cart";
    this.worker.heldCaseId = undefined;
    this.productCase.state = "loaded";
    this.cart.loadedCaseId = this.productCase.id;
    this.phase = "push";
    this.events.emit("case.loaded", { caseId: this.productCase.id, cartId: this.cart.id });
    return true;
  }

  private pushCart(): boolean {
    if (this.phase !== "push" || this.cart.loadedCaseId !== this.productCase.id) return false;
    this.worker.action = "push-cart";
    this.cart.movementState = "moving";
    this.phase = "park";
    return true;
  }

  private parkCart(): boolean {
    if (this.phase !== "park" || this.cart.movementState !== "moving") return false;
    this.cart.locationId = this.config.destinationLocationId;
    this.cart.movementState = "parked";
    this.phase = "open";
    this.events.emit("cart.moved", {
      cartId: this.cart.id,
      destinationId: this.config.destinationLocationId
    });
    return true;
  }

  private openCase(): boolean {
    if (
      this.phase !== "open" ||
      this.cart.locationId !== this.config.destinationLocationId ||
      this.productCase.state !== "loaded"
    ) return false;
    this.productCase.state = "open";
    this.worker.action = "open-case";
    this.phase = "restock";
    this.events.emit("case.opened", { caseId: this.productCase.id });
    return true;
  }

  private stockSlot(): boolean {
    if (this.phase !== "restock" || this.productCase.state !== "open") return false;
    if (!this.fixture.accepts(this.config.productId)) return false;
    if (this.productCase.quantity < this.config.unitsPerSlot) return false;

    this.productCase.quantity -= this.config.unitsPerSlot;
    this.fixture.inventory.add(this.config.productId, this.config.unitsPerSlot);
    this.stockedSlots += 1;
    this.worker.action = this.actionForSlot(this.stockedSlots - 1);
    this.wallet.grant(this.config.coinsPerSlot, 0);
    this.mission.recordProductTransfer(
      this.config.productId,
      this.config.fixtureId,
      this.config.unitsPerSlot
    );
    this.events.emit("product.transferred", {
      productId: this.config.productId,
      sourceId: this.productCase.id,
      targetId: this.fixture.id,
      amount: this.config.unitsPerSlot
    });

    if (this.stockedSlots >= this.config.slotCount) {
      this.productCase.state = this.productCase.quantity === 0 ? "empty" : "open";
      this.complete();
    }
    return true;
  }

  private complete(): void {
    if (!this.mission.snapshot().complete) {
      throw new Error("Restock workflow cannot complete before its mission objective");
    }
    this.phase = "complete";
    this.worker.action = "idle";
    if (this.rewardsGranted) return;
    this.rewardsGranted = true;
    this.wallet.grant(this.config.completionCoins, this.config.completionStars);
    this.events.emit("reward.granted", {
      coins: this.config.completionCoins,
      stars: this.config.completionStars
    });
  }

  private actionForSlot(slotIndex: number): "place-low" | "place-middle" | "place-high" {
    const normalized = slotIndex / Math.max(1, this.config.slotCount - 1);
    if (normalized < 0.34) return "place-high";
    if (normalized < 0.67) return "place-middle";
    return "place-low";
  }

  private validateConfig(config: RestockWorkflowConfig): void {
    const positiveIntegers = [
      config.caseQuantity,
      config.unitsPerSlot,
      config.slotCount,
      config.cartCapacity
    ];
    if (positiveIntegers.some((value) => !Number.isInteger(value) || value <= 0)) {
      throw new Error("Restock quantities and capacities must be positive integers");
    }
    if (config.unitsPerSlot * config.slotCount > config.caseQuantity) {
      throw new Error("Product case does not contain enough units for all fixture slots");
    }
    if (config.mission.objectives.length === 0) {
      throw new Error("Restock workflow requires at least one mission objective");
    }
  }
}
