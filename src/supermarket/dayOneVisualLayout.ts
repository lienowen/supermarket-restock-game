export type DayOneZoneId = "fruit" | "vegetable" | "grains" | "drinks";

export type DayOneFixtureStyle = "produce" | "pantry" | "beverage";

export type StoreZone = {
  id: DayOneZoneId;
  name: string;
  subtitle: string;
  x: number;
  y: number;
  width: number;
  height: number;
  shelfCount: number;
  fixtureStyle: DayOneFixtureStyle;
  accent: number;
  productColors: readonly number[];
};

/**
 * Day 1 uses one continuous supermarket floor. These coordinates deliberately
 * leave the lower centre aisle open for the worker, cart and tutorial route.
 */
export const DAY_ONE_STORE_LAYOUT: readonly StoreZone[] = [
  {
    id: "fruit",
    name: "FRUIT MARKET",
    subtitle: "APPLES · CITRUS · BANANAS",
    x: 392,
    y: 435,
    width: 196,
    height: 320,
    shelfCount: 2,
    fixtureStyle: "produce",
    accent: 0xf1a64a,
    productColors: [0xe85d4a, 0xf2c14e, 0x7fbf4d]
  },
  {
    id: "vegetable",
    name: "FRESH VEGETABLES",
    subtitle: "GREENS · ROOTS · HERBS",
    x: 612,
    y: 435,
    width: 196,
    height: 320,
    shelfCount: 2,
    fixtureStyle: "produce",
    accent: 0x79bd62,
    productColors: [0x5fa64b, 0x8ecf68, 0xd48a43]
  },
  {
    id: "grains",
    name: "RICE & NOODLES",
    subtitle: "GRAINS · FLOUR · PANTRY",
    x: 832,
    y: 435,
    width: 196,
    height: 320,
    shelfCount: 3,
    fixtureStyle: "pantry",
    accent: 0xd8b978,
    productColors: [0xe6d5a9, 0xc99e55, 0xf0e5c2]
  },
  {
    id: "drinks",
    name: "DRINKS & DAIRY",
    subtitle: "WATER · COLA · MILK",
    x: 1052,
    y: 435,
    width: 196,
    height: 320,
    shelfCount: 3,
    fixtureStyle: "beverage",
    accent: 0x72b8df,
    productColors: [0x4aa7d8, 0xd6534d, 0xf3f0d7]
  }
];

export function getZoneById(id: DayOneZoneId): StoreZone {
  const zone = DAY_ONE_STORE_LAYOUT.find((candidate) => candidate.id === id);
  if (!zone) throw new Error(`Unknown Day 1 store zone: ${id}`);
  return zone;
}
