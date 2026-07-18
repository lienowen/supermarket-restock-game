export type InteractionGateListener = (ready: boolean) => void;

export class InteractionGate {
  private locked = false;
  private timeoutHandle?: number;
  private readonly listeners = new Set<InteractionGateListener>();

  isReady(): boolean {
    return !this.locked;
  }

  subscribe(listener: InteractionGateListener): () => void {
    this.listeners.add(listener);
    listener(this.isReady());
    return () => this.listeners.delete(listener);
  }

  lockFor(maxDurationMs: number): void {
    if (!Number.isFinite(maxDurationMs) || maxDurationMs <= 0) {
      throw new Error("Interaction gate duration must be a positive number");
    }

    this.clearTimeout();
    this.locked = true;
    this.emit();
    this.timeoutHandle = window.setTimeout(() => this.unlock(), maxDurationMs);
  }

  unlock(): void {
    const changed = this.locked || this.timeoutHandle !== undefined;
    this.clearTimeout();
    this.locked = false;
    if (changed) this.emit();
  }

  destroy(): void {
    this.clearTimeout();
    this.listeners.clear();
    this.locked = false;
  }

  private clearTimeout(): void {
    if (this.timeoutHandle === undefined) return;
    window.clearTimeout(this.timeoutHandle);
    this.timeoutHandle = undefined;
  }

  private emit(): void {
    const ready = this.isReady();
    this.listeners.forEach((listener) => listener(ready));
  }
}
