export const ProductionAssets = {
  backgrounds: {
    stockDock: "production-stock-dock-bg"
  },
  fixtures: {
    rackBackroomFull: "production-rack-backroom-full",
    rackBackroomLow: "production-rack-backroom-low",
    rackBackroomEmpty: "production-rack-backroom-empty",
    produceFull: "production-shelf-produce-full",
    produceLow: "production-shelf-produce-low",
    produceEmpty: "production-shelf-produce-empty",
    frozenFull: "production-shelf-frozen-full",
    frozenLow: "production-shelf-frozen-low",
    frozenEmpty: "production-shelf-frozen-empty",
    checkoutFull: "production-shelf-checkout-full",
    checkoutLow: "production-shelf-checkout-low",
    checkoutEmpty: "production-shelf-checkout-empty",
    bakeryFull: "production-shelf-bakery-full",
    bakeryLow: "production-shelf-bakery-low",
    bakeryEmpty: "production-shelf-bakery-empty",
    healthBeautyFull: "production-shelf-healthbeauty-full",
    healthBeautyLow: "production-shelf-healthbeauty-low",
    healthBeautyEmpty: "production-shelf-healthbeauty-empty"
  },
  foreground: {
    aisleLeft: "production-foreground-aisle-left",
    aisleRight: "production-foreground-aisle-right",
    coldLeft: "production-foreground-cold-left",
    coldRight: "production-foreground-cold-right",
    promotionLeft: "production-foreground-promotion-left"
  },
  effects: {
    lowStock: "production-tag-low-stock",
    outOfStock: "production-tag-out-of-stock",
    restocked: "production-tag-restocked",
    highlight: "production-highlight-frame",
    clickRing: "production-click-ring"
  }
} as const;

export const ProductionAssetPaths = {
  [ProductionAssets.backgrounds.stockDock]: "assets/common/supermarket/backgrounds/common-stock-dock.png",

  [ProductionAssets.fixtures.rackBackroomFull]: "assets/common/supermarket/fixtures/rack-backroom-full.png",
  [ProductionAssets.fixtures.rackBackroomLow]: "assets/common/supermarket/fixtures/rack-backroom-low.png",
  [ProductionAssets.fixtures.rackBackroomEmpty]: "assets/common/supermarket/fixtures/rack-backroom-empty.png",

  [ProductionAssets.fixtures.produceFull]: "assets/common/supermarket/fixtures/shelf-produce-full.png",
  [ProductionAssets.fixtures.produceLow]: "assets/common/supermarket/fixtures/shelf-produce-low.png",
  [ProductionAssets.fixtures.produceEmpty]: "assets/common/supermarket/fixtures/shelf-produce-empty.png",

  [ProductionAssets.fixtures.frozenFull]: "assets/common/supermarket/fixtures/shelf-frozen-full.png",
  [ProductionAssets.fixtures.frozenLow]: "assets/common/supermarket/fixtures/shelf-frozen-low.png",
  [ProductionAssets.fixtures.frozenEmpty]: "assets/common/supermarket/fixtures/shelf-frozen-empty.png",

  [ProductionAssets.fixtures.checkoutFull]: "assets/common/supermarket/fixtures/shelf-checkout-full.png",
  [ProductionAssets.fixtures.checkoutLow]: "assets/common/supermarket/fixtures/shelf-checkout-low.png",
  [ProductionAssets.fixtures.checkoutEmpty]: "assets/common/supermarket/fixtures/shelf-checkout-empty.png",

  [ProductionAssets.fixtures.bakeryFull]: "assets/common/supermarket/fixtures/shelf-bakery-full.png",
  [ProductionAssets.fixtures.bakeryLow]: "assets/common/supermarket/fixtures/shelf-bakery-low.png",
  [ProductionAssets.fixtures.bakeryEmpty]: "assets/common/supermarket/fixtures/shelf-bakery-empty.png",

  [ProductionAssets.fixtures.healthBeautyFull]: "assets/common/supermarket/fixtures/shelf-healthbeauty-full.png",
  [ProductionAssets.fixtures.healthBeautyLow]: "assets/common/supermarket/fixtures/shelf-healthbeauty-low.png",
  [ProductionAssets.fixtures.healthBeautyEmpty]: "assets/common/supermarket/fixtures/shelf-healthbeauty-empty.png",

  [ProductionAssets.foreground.aisleLeft]: "assets/common/supermarket/foreground/foreground-aisle-left.png",
  [ProductionAssets.foreground.aisleRight]: "assets/common/supermarket/foreground/foreground-aisle-right.png",
  [ProductionAssets.foreground.coldLeft]: "assets/common/supermarket/foreground/foreground-coldcase-left.png",
  [ProductionAssets.foreground.coldRight]: "assets/common/supermarket/foreground/foreground-coldcase-right.png",
  [ProductionAssets.foreground.promotionLeft]: "assets/common/supermarket/foreground/foreground-promo-left.png",

  [ProductionAssets.effects.lowStock]: "assets/common/supermarket/effects/tag-low-stock.png",
  [ProductionAssets.effects.outOfStock]: "assets/common/supermarket/effects/tag-out-of-stock.png",
  [ProductionAssets.effects.restocked]: "assets/common/supermarket/effects/tag-restocked.png",
  [ProductionAssets.effects.highlight]: "assets/common/supermarket/effects/highlight-frame-yellow.png",
  [ProductionAssets.effects.clickRing]: "assets/common/supermarket/effects/click-ring.png"
} as const;

export type ProductionAssetKey = keyof typeof ProductionAssetPaths;
