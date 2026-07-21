export interface DomainEventEnvelope<Type extends string = string, Payload = unknown> {
  readonly type: Type;
  readonly payload: Payload;
  readonly occurredAtMs: number;
}

export type DomainEventMap = Readonly<Record<string, unknown>>;

type DomainEventHandler<Payload> = (
  event: DomainEventEnvelope<string, Payload>
) => void;

export class DomainEventBus<Events extends DomainEventMap> {
  private readonly handlers = new Map<keyof Events, Set<DomainEventHandler<unknown>>>();

  emit<Type extends keyof Events & string>(
    type: Type,
    payload: Events[Type],
    occurredAtMs = Date.now()
  ): void {
    const event = Object.freeze({ type, payload, occurredAtMs });
    this.handlers.get(type)?.forEach((handler) => handler(event));
  }

  subscribe<Type extends keyof Events & string>(
    type: Type,
    handler: (event: DomainEventEnvelope<Type, Events[Type]>) => void
  ): () => void {
    const handlers = this.handlers.get(type) ?? new Set<DomainEventHandler<unknown>>();
    handlers.add(handler as DomainEventHandler<unknown>);
    this.handlers.set(type, handlers);
    return () => {
      handlers.delete(handler as DomainEventHandler<unknown>);
      if (handlers.size === 0) this.handlers.delete(type);
    };
  }

  clear(): void {
    this.handlers.clear();
  }
}
