export type DomainEventMap = {
  "case.picked-up": { caseId: string; workerId: string };
  "case.loaded": { caseId: string; cartId: string };
  "cart.moved": { cartId: string; destinationId: string };
  "case.opened": { caseId: string };
  "product.transferred": {
    productId: string;
    sourceId: string;
    targetId: string;
    amount: number;
  };
  "mission.completed": { missionId: string };
  "reward.granted": { coins: number; stars: number };
};

export type DomainEventName = keyof DomainEventMap;
export type DomainEventListener<K extends DomainEventName> = (payload: DomainEventMap[K]) => void;

export class DomainEventBus {
  private readonly listeners = new Map<DomainEventName, Set<(payload: never) => void>>();

  on<K extends DomainEventName>(name: K, listener: DomainEventListener<K>): () => void {
    const listeners = this.listeners.get(name) ?? new Set<(payload: never) => void>();
    listeners.add(listener as (payload: never) => void);
    this.listeners.set(name, listeners);
    return () => listeners.delete(listener as (payload: never) => void);
  }

  emit<K extends DomainEventName>(name: K, payload: DomainEventMap[K]): void {
    this.listeners.get(name)?.forEach((listener) => listener(payload as never));
  }

  clear(): void {
    this.listeners.clear();
  }
}
