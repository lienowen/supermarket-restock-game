export interface WorldPoint {
  readonly x: number;
  readonly y: number;
}

export interface WorldRect extends WorldPoint {
  readonly width: number;
  readonly height: number;
}

export type StoreZoneKind =
  | "produce"
  | "beverage"
  | "backroom"
  | "checkout"
  | "frozen"
  | "household"
  | "receiving"
  | "service";

export interface StoreZoneLayout {
  readonly id: string;
  readonly kind: StoreZoneKind;
  readonly bounds: WorldRect;
  readonly label: string;
}

export interface FixturePlacement {
  readonly fixtureId: string;
  readonly position: WorldPoint;
  readonly anchor: readonly [x: number, y: number];
  readonly depth: number;
}

export interface InteractionPointLayout {
  readonly id: string;
  readonly targetId: string;
  readonly actionGroup: string;
  readonly position: WorldPoint;
  readonly radius: number;
}

export interface ActorSpawnLayout {
  readonly id: string;
  readonly actorType: "worker" | "customer";
  readonly position: WorldPoint;
  readonly facing: "left" | "right" | "forward" | "back" | "back-left" | "back-right";
}

export interface StoreWorldLayout {
  readonly id: string;
  readonly logicalSize: readonly [width: number, height: number];
  readonly camera: {
    readonly mode: "fixed-third-person";
    readonly viewport: WorldRect;
  };
  readonly zones: readonly StoreZoneLayout[];
  readonly fixtures: readonly FixturePlacement[];
  readonly interactions: readonly InteractionPointLayout[];
  readonly spawns: readonly ActorSpawnLayout[];
}

export function validateWorldLayout(layout: StoreWorldLayout): readonly string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const [worldWidth, worldHeight] = layout.logicalSize;

  const registerId = (id: string, kind: string): void => {
    if (ids.has(id)) errors.push(`Duplicate world id: ${id} (${kind})`);
    ids.add(id);
  };

  if (worldWidth <= 0 || worldHeight <= 0) {
    errors.push("World logical size must be positive");
  }

  layout.zones.forEach((zone) => {
    registerId(zone.id, "zone");
    if (zone.bounds.width <= 0 || zone.bounds.height <= 0) {
      errors.push(`Zone must have positive dimensions: ${zone.id}`);
    }
  });

  layout.fixtures.forEach((fixture) => registerId(fixture.fixtureId, "fixture"));
  layout.interactions.forEach((point) => {
    registerId(point.id, "interaction");
    if (point.radius <= 0) errors.push(`Interaction radius must be positive: ${point.id}`);
  });
  layout.spawns.forEach((spawn) => registerId(spawn.id, "spawn"));

  return errors;
}
