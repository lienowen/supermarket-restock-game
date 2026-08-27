import type { AssetCatalogue, AssetDescriptor } from "./AssetDescriptor";

const asset = (descriptor: AssetDescriptor): AssetDescriptor => descriptor;

const matureSpill = (
  key: string,
  fileName: string,
  state: string
): AssetDescriptor => asset({
  key,
  path: `assets/game/production-v2/mature-clean/${fileName}`,
  category: "effect",
  canvasSize: [768, 512],
  anchor: [0.5, 0.5],
  defaultScale: 1,
  depthGroup: "world-effects",
  preloadGroup: "starter-market",
  perspective: "fixed-third-person",
  lightDirection: "upper-left",
  state,
  status: "production"
});

const matureDeliveryProp = (
  key: string,
  fileName: string,
  category: "prop" | "equipment",
  state: string
): AssetDescriptor => asset({
  key,
  path: `assets/game/missing-assets-batch-01/${fileName}`,
  category,
  canvasSize: [1536, 1024],
  anchor: [0.5, 0.96],
  defaultScale: 1,
  depthGroup: category === "equipment" ? "fixtures" : "props",
  preloadGroup: "starter-market",
  perspective: "fixed-third-person",
  lightDirection: "upper-left",
  state,
  status: "production"
});

const matureCustomer = (
  key: string,
  fileName: string,
  state: string
): AssetDescriptor => asset({
  key,
  path: `assets/game/missing-assets-batch-01/${fileName}`,
  category: "character",
  canvasSize: [1024, 1536],
  anchor: [0.5, 0.98],
  defaultScale: 0.36,
  depthGroup: "actors",
  preloadGroup: "starter-market",
  perspective: "fixed-third-person",
  lightDirection: "upper-left",
  state,
  status: "production"
});

const projectBackground = (
  key: string,
  fileName: string,
  state: string
): AssetDescriptor => asset({
  key,
  path: `assets/game/production-v4/project-backgrounds/${fileName}`,
  category: "environment",
  canvasSize: [1672, 941],
  anchor: [0.5, 0.5],
  defaultScale: 1,
  depthGroup: "far-environment",
  preloadGroup: "starter-market",
  perspective: "fixed-third-person",
  lightDirection: "upper-left",
  state,
  status: "production"
});

const l8Background = (): AssetDescriptor => asset({
  key: "environment-project-cleaning-closing-l8",
  // The uploaded L8 plate is currently truncated in the repository. Keep the
  // stable key but bind it to the validated cleaning plate until the binary is
  // replaced; shipping a known-good supermarket scene is preferable to black.
  path: "assets/game/production-v4/project-backgrounds/bg-cleaning-zone-v2.png",
  category: "environment",
  canvasSize: [1672, 941],
  anchor: [0.5, 0.5],
  defaultScale: 1,
  depthGroup: "far-environment",
  preloadGroup: "starter-market",
  perspective: "fixed-third-person",
  lightDirection: "upper-left",
  state: "closing-cleanup-l8-safe-fallback",
  status: "production"
});

const dispatchBackground = (): AssetDescriptor => asset({
  key: "environment-dispatch-loading-l6",
  path: "assets/game/production-v8/l6-l10-rework-assets/bg-dispatch-loading-l6.png",
  category: "environment",
  canvasSize: [1536, 1024],
  anchor: [0.5, 0.5],
  defaultScale: 1,
  depthGroup: "far-environment",
  preloadGroup: "starter-market",
  perspective: "fixed-third-person",
  lightDirection: "upper-left",
  state: "dispatch-loading-l6",
  status: "production"
});

const finalShiftBackground = (): AssetDescriptor => asset({
  key: "environment-final-shift-l10",
  path: "assets/game/production-v8/l6-l10-rework-assets/bg-final-shift-l10-empty-cooler-v3.webp",
  category: "environment",
  canvasSize: [1672, 941],
  anchor: [0.5, 0.5],
  defaultScale: 1,
  depthGroup: "far-environment",
  preloadGroup: "starter-market",
  perspective: "fixed-third-person",
  lightDirection: "upper-left",
  state: "final-night-shift-l10",
  status: "production"
});

const finalShiftCoolerCloseup = (): AssetDescriptor => asset({
  key: "fixture-final-shift-cooler-closeup-l10",
  path: "assets/game/production-v9/l10-final-redesign/bg-l10-cooler-closeup-v1.png",
  category: "fixture",
  canvasSize: [1672, 941],
  anchor: [0.5, 0.5],
  defaultScale: 1,
  depthGroup: "fixtures",
  preloadGroup: "starter-market",
  perspective: "fixed-third-person",
  lightDirection: "upper-left",
  state: "final-night-cooler-closeup-l10",
  status: "production"
});

const l8Spill = (
  key: string,
  fileName: string,
  state: string
): AssetDescriptor => asset({
  key,
  path: `assets/game/production-v7/l8-l10-adapted-assets/L8/${fileName}`,
  category: "effect",
  canvasSize: [768, 512],
  anchor: [0.5, 0.5],
  defaultScale: 1,
  depthGroup: "world-effects",
  preloadGroup: "starter-market",
  perspective: "fixed-third-person",
  lightDirection: "upper-left",
  state,
  status: "production"
});

const l5OrderIcon = (
  key: string,
  fileName: string,
  state: string
): AssetDescriptor => asset({
  key,
  path: `assets/game/production-v6/find-items-l5/${fileName}`,
  category: "ui",
  canvasSize: [512, 512],
  anchor: [0.5, 0.5],
  defaultScale: 1,
  depthGroup: "ui",
  preloadGroup: "starter-market",
  perspective: "screen-space",
  lightDirection: "neutral",
  state,
  status: "production"
});

/**
 * Project-wide production assets belong here only after their files are present
 * in the repository and pass the release bundle checks. Asset ideas and gap
 * plans must stay in design documentation instead of being registered as live
 * runtime resources.
 */
export const GLOBAL_PROJECT_ASSET_CATALOGUE: AssetCatalogue = Object.freeze({
  assets: Object.freeze([
    asset({
      key: "environment-starter-market-restock-hd-v3",
      path: "assets/game/production-v3/cooler-restock/market_bg_hd.png",
      category: "environment",
      canvasSize: [1672, 941],
      anchor: [0.5, 0.5],
      defaultScale: 1,
      depthGroup: "far-environment",
      preloadGroup: "starter-market",
      perspective: "fixed-third-person",
      lightDirection: "upper-left",
      state: "restock-hd-v3",
      status: "production"
    }),
    projectBackground(
      "environment-project-restock-v2",
      "bg-restock-zone-v2.png",
      "restock-zone-v2"
    ),
    projectBackground(
      "environment-project-checkout-v2",
      "bg-checkout-zone-v2.png",
      "checkout-zone-v2"
    ),
    projectBackground(
      "environment-project-cleaning-v2",
      "bg-cleaning-zone-v2.png",
      "cleaning-zone-v2"
    ),
    projectBackground(
      "environment-project-order-hunt-v2",
      "bg-order-hunt-zone-v2.png",
      "order-hunt-zone-v2"
    ),
    l8Background(),
    dispatchBackground(),
    finalShiftBackground(),
    finalShiftCoolerCloseup(),
    l5OrderIcon("ui-l5-order-milk", "order-milk-clean.png", "milk"),
    l5OrderIcon("ui-l5-order-cereal", "order-cereal-clean.png", "cereal"),
    asset({
      key: "fixture-beverage-cooler-glass-hd-v3",
      path: "assets/game/production-v3/cooler-restock/cooler_front_glass_hd.png",
      category: "effect",
      canvasSize: [1536, 1024],
      anchor: [0.5, 0.5],
      defaultScale: 1,
      depthGroup: "world-effects",
      preloadGroup: "starter-market",
      perspective: "screen-space",
      lightDirection: "upper-left",
      state: "glass-overlay",
      status: "production"
    }),
    matureSpill("spill-water-large", "spill-water-large.png", "water"),
    matureSpill("spill-juice-large", "spill-juice-large.png", "juice"),
    matureSpill("spill-dirt-smear-large", "spill-dirt-smear-large.png", "dirt"),
    l8Spill("spill-oil-large", "spill-oil-large.png", "oil"),
    l8Spill("spill-footprint-large", "spill-footprint-large.png", "footprint"),
    l8Spill("spill-trash-smear-large", "spill-trash-smear-large.png", "trash-smear"),
    matureDeliveryProp("delivery-box-small", "delivery-box-small.png", "prop", "small"),
    matureDeliveryProp("delivery-box-medium", "delivery-box-medium.png", "prop", "medium"),
    matureDeliveryProp("delivery-box-large", "delivery-box-large.png", "prop", "large"),
    matureDeliveryProp("equipment-capacity-cart-empty", "equipment-capacity-cart-empty.png", "equipment", "empty"),
    matureDeliveryProp("equipment-capacity-cart-loaded", "equipment-capacity-cart-loaded.png", "equipment", "loaded"),
    matureDeliveryProp("equipment-produce-scale", "equipment-produce-scale.png", "equipment", "ready"),
    matureCustomer("customer-evening-happy", "customer-happy.png", "happy"),
    matureCustomer("customer-evening-impatient", "customer-impatient.png", "impatient")
  ])
});
