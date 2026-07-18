import { STARTER_MARKET_LAYOUT } from "../../game/world/starterMarketLayout";

const [worldWidth, worldHeight] = STARTER_MARKET_LAYOUT.logicalSize;
const interaction = (id: string) => {
  const point = STARTER_MARKET_LAYOUT.interactions.find((entry) => entry.id === id);
  if (!point) throw new Error(`Missing starter market interaction point: ${id}`);
  return point.position;
};
const workerSpawn = STARTER_MARKET_LAYOUT.spawns.find((entry) => entry.id === "worker-a-spawn");
if (!workerSpawn) throw new Error("Missing worker-a-spawn in starter market layout");

export const DAY_ONE_CONTENT = {
  id: "day01-beverage-opening",
  title: "DAY 1",
  timeLabel: "09:00 AM",
  department: "BEVERAGES",
  objective: "Restock the beverage cooler",
  totalRows: 6,
  startingCoins: 100,
  world: {
    width: worldWidth,
    height: worldHeight,
    backroomBox: interaction("cola-case-pickup-point"),
    cartStart: interaction("restock-cart-load-point"),
    workerStart: workerSpawn.position,
    cartCooler: interaction("beverage-restock-zone"),
    workerCooler: { x: 1055, y: 665 },
    coolerTarget: { x: 1325, y: 490, width: 300, height: 465 }
  },
  palette: {
    hud: 0x09100c,
    hudBorder: 0x31583a,
    green: 0x315f38,
    greenBright: 0x56894d,
    gold: 0xf1c441,
    cream: 0xf4eddb,
    floor: 0xaaa295,
    aisle: 0xd8d0c2,
    cooler: 0x2f393d,
    coolerLight: 0xeaf6f5,
    backroom: 0x5f5446,
    shadow: 0x000000
  }
} as const;

export type DayOneContent = typeof DAY_ONE_CONTENT;
