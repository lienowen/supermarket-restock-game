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
    matureSpill("spill-dirt-smear-large", "spill-dirt-smear-large.png", "dirt")
  ])
});
