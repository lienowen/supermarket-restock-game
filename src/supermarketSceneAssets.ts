export const SupermarketSceneAssets = {
  backgrounds: {
    store: {
      overview01: "scene-store-overview-01",
      overview02: "scene-store-overview-02",
      overview03: "scene-store-overview-03"
    },
    navigation: {
      aisleGeneral01: "scene-aisle-general-01",
      aisleGeneral02: "scene-aisle-general-02",
      aisleGeneral03: "scene-aisle-general-03",
      coldCorridor01: "scene-aisle-cold-corridor-01"
    },
    checkout: {
      overview01: "scene-checkout-overview-01"
    }
  },
  stockroom: {
    overview01: "scene-stockroom-overview-01",
    overview02: "scene-stockroom-overview-02"
  },
  restock: {
    drinks: {
      empty01: "scene-drinks-empty-01",
      mid01: "scene-drinks-mid-01",
      full01: "scene-drinks-full-01"
    },
    dairy: {
      zone01: "scene-dairy-zone-01",
      zone02: "scene-dairy-zone-02",
      zone03: "scene-dairy-zone-03",
      zone04: "scene-dairy-zone-04",
      zone05: "scene-dairy-zone-05"
    },
    frozen: {
      zone01: "scene-frozen-zone-01",
      zone02: "scene-frozen-zone-02"
    },
    snacks: {
      zone01: "scene-snacks-zone-01",
      zone02: "scene-snacks-zone-02"
    },
    pantry: {
      zone01: "scene-pantry-zone-01",
      zone02: "scene-pantry-zone-02"
    }
  }
} as const;

export const SupermarketSceneAssetPaths: Record<string, string> = {
  [SupermarketSceneAssets.backgrounds.store.overview01]: "assets/common/supermarket/backgrounds/store/store-overview-01.png",
  [SupermarketSceneAssets.backgrounds.store.overview02]: "assets/common/supermarket/backgrounds/store/store-overview-02.png",
  [SupermarketSceneAssets.backgrounds.store.overview03]: "assets/common/supermarket/backgrounds/store/store-overview-03.png",

  [SupermarketSceneAssets.backgrounds.navigation.aisleGeneral01]: "assets/common/supermarket/backgrounds/navigation/aisle-general-01.png",
  [SupermarketSceneAssets.backgrounds.navigation.aisleGeneral02]: "assets/common/supermarket/backgrounds/navigation/aisle-general-02.png",
  [SupermarketSceneAssets.backgrounds.navigation.aisleGeneral03]: "assets/common/supermarket/backgrounds/navigation/aisle-general-03.png",
  [SupermarketSceneAssets.backgrounds.navigation.coldCorridor01]: "assets/common/supermarket/backgrounds/navigation/aisle-cold-corridor-01.png",

  [SupermarketSceneAssets.backgrounds.checkout.overview01]: "assets/common/supermarket/backgrounds/checkout/checkout-overview-01.png",

  [SupermarketSceneAssets.stockroom.overview01]: "assets/common/supermarket/stockroom/stockroom-overview-01.png",
  [SupermarketSceneAssets.stockroom.overview02]: "assets/common/supermarket/stockroom/stockroom-overview-02.png",

  [SupermarketSceneAssets.restock.drinks.empty01]: "assets/common/supermarket/restock/drinks/drinks-empty-01.png",
  [SupermarketSceneAssets.restock.drinks.mid01]: "assets/common/supermarket/restock/drinks/drinks-mid-01.png",
  [SupermarketSceneAssets.restock.drinks.full01]: "assets/common/supermarket/restock/drinks/drinks-full-01.png",

  [SupermarketSceneAssets.restock.dairy.zone01]: "assets/common/supermarket/restock/dairy/dairy-zone-01.png",
  [SupermarketSceneAssets.restock.dairy.zone02]: "assets/common/supermarket/restock/dairy/dairy-zone-02.png",
  [SupermarketSceneAssets.restock.dairy.zone03]: "assets/common/supermarket/restock/dairy/dairy-zone-03.png",
  [SupermarketSceneAssets.restock.dairy.zone04]: "assets/common/supermarket/restock/dairy/dairy-zone-04.png",
  [SupermarketSceneAssets.restock.dairy.zone05]: "assets/common/supermarket/restock/dairy/dairy-zone-05.png",

  [SupermarketSceneAssets.restock.frozen.zone01]: "assets/common/supermarket/restock/frozen/frozen-zone-01.png",
  [SupermarketSceneAssets.restock.frozen.zone02]: "assets/common/supermarket/restock/frozen/frozen-zone-02.png",

  [SupermarketSceneAssets.restock.snacks.zone01]: "assets/common/supermarket/restock/snacks/snacks-zone-01.png",
  [SupermarketSceneAssets.restock.snacks.zone02]: "assets/common/supermarket/restock/snacks/snacks-zone-02.png",

  [SupermarketSceneAssets.restock.pantry.zone01]: "assets/common/supermarket/restock/pantry/pantry-zone-01.png",
  [SupermarketSceneAssets.restock.pantry.zone02]: "assets/common/supermarket/restock/pantry/pantry-zone-02.png"
};
