export type StoreZone = {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  shelfCount: number;
};

export const DAY_ONE_STORE_LAYOUT: StoreZone[] = [
  { id: "fruit", name: "Fruit Market", x: 220, y: 360, width: 260, height: 220, shelfCount: 3 },
  { id: "vegetable", name: "Fresh Vegetables", x: 620, y: 360, width: 260, height: 220, shelfCount: 3 },
  { id: "drinks", name: "Drinks", x: 220, y: 700, width: 260, height: 220, shelfCount: 3 },
  { id: "grains", name: "Rice & Grains", x: 620, y: 700, width: 260, height: 220, shelfCount: 3 }
];

export function getZoneById(id: string): StoreZone | undefined {
  return DAY_ONE_STORE_LAYOUT.find((zone) => zone.id === id);
}
