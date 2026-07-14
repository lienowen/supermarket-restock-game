export const SupermarketAssets = {
  backgrounds: {
    mainFloor: "supermarket-main-floor-bg",
    promotionWing: "supermarket-promotion-wing-bg",
    backroom: "supermarket-backroom-bg",
    coldCase: "supermarket-cold-case-bg"
  },
  fixtures: {
    beveragesFull: "supermarket-shelf-beverages-full",
    beveragesLow: "supermarket-shelf-beverages-low",
    beveragesEmpty: "supermarket-shelf-beverages-empty",
    pantryFull: "supermarket-shelf-pantry-full",
    pantryLow: "supermarket-shelf-pantry-low",
    pantryEmpty: "supermarket-shelf-pantry-empty",
    householdFull: "supermarket-shelf-household-full",
    householdLow: "supermarket-shelf-household-low",
    householdEmpty: "supermarket-shelf-household-empty",
    promoFull: "supermarket-promo-endcap-full",
    promoLow: "supermarket-promo-endcap-low",
    promoEmpty: "supermarket-promo-endcap-empty",
    dairyFull: "supermarket-shelf-dairy-full",
    snacksFull: "supermarket-shelf-snacks-full"
  },
  foreground: {
    aisleLeft: "supermarket-foreground-aisle-left",
    aisleRight: "supermarket-foreground-aisle-right"
  }
} as const;

export const SupermarketBackgroundPaths = {
  [SupermarketAssets.backgrounds.mainFloor]: "assets/common/supermarket/backgrounds/main_floor_bg.png",
  [SupermarketAssets.backgrounds.promotionWing]: "assets/common/supermarket/backgrounds/promotion_wing_bg.png",
  [SupermarketAssets.backgrounds.backroom]: "assets/common/supermarket/backgrounds/backroom_bg.png",
  [SupermarketAssets.backgrounds.coldCase]: "assets/common/supermarket/backgrounds/cold_case_bg.png"
} as const;

// These paths are registered for the next visual pass. The current uploaded fixture
// PNGs have baked checkerboard backgrounds, so runtime code deliberately does not
// render them until true-alpha replacements are uploaded.
export const SupermarketFixturePaths = {
  [SupermarketAssets.fixtures.beveragesFull]: "assets/common/supermarket/fixtures/shelf_beverages_full.png",
  [SupermarketAssets.fixtures.beveragesLow]: "assets/common/supermarket/fixtures/shelf_beverages_low.png",
  [SupermarketAssets.fixtures.beveragesEmpty]: "assets/common/supermarket/fixtures/shelf_beverages_empty.png",
  [SupermarketAssets.fixtures.pantryFull]: "assets/common/supermarket/fixtures/shelf_pantry_full.png",
  [SupermarketAssets.fixtures.pantryLow]: "assets/common/supermarket/fixtures/shelf_pantry_low.png",
  [SupermarketAssets.fixtures.pantryEmpty]: "assets/common/supermarket/fixtures/shelf_pantry_empty.png",
  [SupermarketAssets.fixtures.householdFull]: "assets/common/supermarket/fixtures/shelf_household_full.png",
  [SupermarketAssets.fixtures.householdLow]: "assets/common/supermarket/fixtures/shelf_household_low.png",
  [SupermarketAssets.fixtures.householdEmpty]: "assets/common/supermarket/fixtures/shelf_household_empty.png",
  [SupermarketAssets.fixtures.promoFull]: "assets/common/supermarket/fixtures/promo_endcap_full.png",
  [SupermarketAssets.fixtures.promoLow]: "assets/common/supermarket/fixtures/promo_endcap_low.png",
  [SupermarketAssets.fixtures.promoEmpty]: "assets/common/supermarket/fixtures/promo_endcap_empty.png",
  [SupermarketAssets.fixtures.dairyFull]: "assets/common/supermarket/fixtures/shelf_dairy_full.png",
  [SupermarketAssets.fixtures.snacksFull]: "assets/common/supermarket/fixtures/shelf_snacks_full.png",
  [SupermarketAssets.foreground.aisleLeft]: "assets/common/supermarket/foreground/foreground_aisle_left.png",
  [SupermarketAssets.foreground.aisleRight]: "assets/common/supermarket/foreground/foreground_aisle_right.png"
} as const;
