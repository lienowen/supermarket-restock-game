export const DAY_ONE_CONTENT = {
  id: "day01-beverage-opening",
  title: "DAY 1",
  timeLabel: "09:00 AM",
  department: "BEVERAGES",
  objective: "Restock the beverage cooler",
  totalRows: 6,
  startingCoins: 100,
  world: {
    width: 1536,
    height: 1024,
    backroomBox: { x: 695, y: 600 },
    cartStart: { x: 760, y: 760 },
    workerStart: { x: 710, y: 785 },
    cartCooler: { x: 1045, y: 735 },
    workerCooler: { x: 965, y: 760 },
    coolerTarget: { x: 1180, y: 430, width: 260, height: 375 }
  },
  palette: {
    hud: 0x0a0f0c,
    hudBorder: 0x2e4e2b,
    green: 0x365c2c,
    greenBright: 0x6e9e43,
    gold: 0xf5c64d,
    cream: 0xf4eddb,
    floor: 0xa79f91,
    aisle: 0xd7d0c3,
    cooler: 0x343b3e,
    coolerLight: 0xe8f5f2,
    backroom: 0x5f5446,
    shadow: 0x000000
  }
} as const;

export type DayOneContent = typeof DAY_ONE_CONTENT;
