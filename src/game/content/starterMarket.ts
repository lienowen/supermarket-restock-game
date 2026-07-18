import type { GameContentCatalogue, MissionDefinition } from "./GameContent";

export const RESTOCK_COLA_COOLER_MISSION: MissionDefinition = {
  id: "restock-cola-cooler",
  title: "Restock the Cola Section",
  description: "Move one cola case from the backroom to the beverage cooler.",
  objectives: [
    {
      type: "transfer-product",
      productId: "cola-bottle",
      targetFixtureId: "beverage-cooler-a",
      amount: 24
    }
  ],
  rewards: {
    coins: 100,
    stars: 1
  }
};

export const STARTER_MARKET_CONTENT: GameContentCatalogue = {
  products: [
    {
      id: "cola-bottle",
      name: "Cola",
      category: "beverage",
      unitPrice: 3,
      caseSize: 24,
      assetKey: "product-cola-bottle"
    }
  ],
  fixtures: [
    {
      id: "beverage-cooler-a",
      kind: "cooler",
      capacity: 24,
      acceptedProductCategories: ["beverage"],
      assetKey: "fixture-beverage-cooler-a"
    }
  ],
  missions: [RESTOCK_COLA_COOLER_MISSION],
  stores: [
    {
      id: "starter-market",
      name: "Freshway Market",
      worldLayoutId: "starter-market-layout",
      fixtureIds: ["beverage-cooler-a"],
      zoneIds: ["produce-zone", "staff-backroom", "beverage-zone"]
    }
  ],
  shifts: [
    {
      id: "starter-shift-001",
      storeId: "starter-market",
      startTime: "09:00",
      missionIds: ["restock-cola-cooler"],
      unlockIds: ["produce-restocking"]
    }
  ],
  campaigns: [
    {
      id: "main-campaign",
      shiftIds: ["starter-shift-001"]
    }
  ]
};
