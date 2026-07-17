export type StoreZoneVisual = {
  id: string;
  title: string;
  x: number;
  y: number;
  color: number;
};

/**
 * Day 1 immersive supermarket map.
 * This keeps the visual layout separate from gameplay logic so GameScene
 * can render a larger supermarket instead of a single shelf.
 */
export const DAY_ONE_IMMERSIVE_MAP: StoreZoneVisual[] = [
  { id: "fruit", title: "FRUIT MARKET", x: 260, y: 360, color: 0xf4b942 },
  { id: "vegetable", title: "FRESH VEGETABLES", x: 760, y: 360, color: 0x6fcf63 },
  { id: "drinks", title: "DRINKS", x: 260, y: 720, color: 0x5aa9ff },
  { id: "grains", title: "GRAINS", x: 760, y: 720, color: 0xffd166 }
];

export function getDayOneZone(id: string) {
  return DAY_ONE_IMMERSIVE_MAP.find((zone) => zone.id === id);
}
