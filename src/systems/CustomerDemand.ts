import type { ProductId } from "../gameConfig";

export type CustomerDemandSnapshot = {
  productId?: ProductId;
  patienceRatio: number;
};

class CustomerDemand {
  private productId?: ProductId;
  private patienceRatio = 1;

  get snapshot(): CustomerDemandSnapshot {
    return {
      productId: this.productId,
      patienceRatio: this.patienceRatio
    };
  }

  set(productId: ProductId, patienceRatio = 1): void {
    this.productId = productId;
    this.patienceRatio = Math.max(0, Math.min(1, patienceRatio));
  }

  updatePatience(patienceRatio: number): void {
    if (!this.productId) return;
    this.patienceRatio = Math.max(0, Math.min(1, patienceRatio));
  }

  clear(productId?: ProductId): void {
    if (productId && this.productId !== productId) return;
    this.productId = undefined;
    this.patienceRatio = 1;
  }
}

export const customerDemand = new CustomerDemand();
