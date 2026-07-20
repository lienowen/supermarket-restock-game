export interface NavigationPoint {
  readonly x: number;
  readonly y: number;
}

export interface NavigationBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface PlayerNavigationConfig {
  readonly start: NavigationPoint;
  readonly bounds: NavigationBounds;
  readonly speed: number;
}

export interface PlayerNavigationSnapshot {
  readonly position: NavigationPoint;
  readonly destination?: NavigationPoint;
  readonly moving: boolean;
}

const clamp = (value: number, minimum: number, maximum: number): number => (
  Math.max(minimum, Math.min(maximum, value))
);

export class PlayerNavigationController {
  private x: number;
  private y: number;
  private destination?: NavigationPoint;

  constructor(readonly config: PlayerNavigationConfig) {
    if (!Number.isFinite(config.speed) || config.speed <= 0) {
      throw new Error("Player navigation speed must be positive");
    }
    if (config.bounds.width <= 0 || config.bounds.height <= 0) {
      throw new Error("Player navigation bounds must be positive");
    }
    const start = this.clampPoint(config.start);
    this.x = start.x;
    this.y = start.y;
  }

  snapshot(): PlayerNavigationSnapshot {
    return Object.freeze({
      position: Object.freeze({ x: this.x, y: this.y }),
      destination: this.destination,
      moving: Boolean(this.destination)
    });
  }

  setPosition(point: NavigationPoint): void {
    const next = this.clampPoint(point);
    this.x = next.x;
    this.y = next.y;
    this.destination = undefined;
  }

  setDestination(point: NavigationPoint): void {
    this.destination = Object.freeze(this.clampPoint(point));
  }

  clearDestination(): void {
    this.destination = undefined;
  }

  moveDirection(directionX: number, directionY: number, deltaMs: number): boolean {
    if (!Number.isFinite(deltaMs) || deltaMs <= 0) return false;
    const magnitude = Math.hypot(directionX, directionY);
    if (magnitude <= 0) return false;

    this.destination = undefined;
    const distance = this.config.speed * (deltaMs / 1000);
    const next = this.clampPoint({
      x: this.x + (directionX / magnitude) * distance,
      y: this.y + (directionY / magnitude) * distance
    });
    const moved = next.x !== this.x || next.y !== this.y;
    this.x = next.x;
    this.y = next.y;
    return moved;
  }

  update(deltaMs: number): boolean {
    const destination = this.destination;
    if (!destination || !Number.isFinite(deltaMs) || deltaMs <= 0) return false;

    const dx = destination.x - this.x;
    const dy = destination.y - this.y;
    const remaining = Math.hypot(dx, dy);
    const step = this.config.speed * (deltaMs / 1000);

    if (remaining <= Math.max(2, step)) {
      this.x = destination.x;
      this.y = destination.y;
      this.destination = undefined;
      return true;
    }

    this.x += (dx / remaining) * step;
    this.y += (dy / remaining) * step;
    return true;
  }

  distanceTo(point: NavigationPoint): number {
    return Math.hypot(point.x - this.x, point.y - this.y);
  }

  isNear(point: NavigationPoint, radius: number): boolean {
    if (!Number.isFinite(radius) || radius < 0) {
      throw new Error("Interaction radius cannot be negative");
    }
    return this.distanceTo(point) <= radius;
  }

  private clampPoint(point: NavigationPoint): NavigationPoint {
    const { bounds } = this.config;
    return {
      x: clamp(point.x, bounds.x, bounds.x + bounds.width),
      y: clamp(point.y, bounds.y, bounds.y + bounds.height)
    };
  }
}
