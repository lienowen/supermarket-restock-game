import { DAY_ONE_STORE_MAP } from "./immersiveStoreMap";

export type SceneZoneMarker = {
  id: string;
  title: string;
  x: number;
  y: number;
};

/**
 * GameScene bridge for the Day1 immersive supermarket layout.
 * Keeps scene placement data outside the Phaser scene so the first level
 * can evolve into multiple supermarket days without rewriting coordinates.
 */
export function getDayOneSceneZones(): SceneZoneMarker[] {
  return DAY_ONE_STORE_MAP.map((zone) => ({
    id: zone.id,
    title: zone.title,
    x: zone.x,
    y: zone.y,
  }));
}

export function getRestockTargetZone() {
  return getDayOneSceneZones()[0];
}
