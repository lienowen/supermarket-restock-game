import type { AssetCatalogue, AssetDescriptor } from "./AssetDescriptor";

const backgroundPath = new URL(
  "../../../asset-source/L2_restock_assets/bg-restock-water-l2.png",
  import.meta.url
).href;
const closedCasePath = new URL(
  "../../../asset-source/L2_restock_assets/water-case-closed.png",
  import.meta.url
).href;
const openCasePath = new URL(
  "../../../asset-source/L2_restock_assets/water-case-open.png",
  import.meta.url
).href;

const asset = (descriptor: AssetDescriptor): AssetDescriptor => descriptor;

/**
 * L2 adds only art that does not already exist in the shared L1 production
 * pack. Worker poses, cart art and the water bottle remain shared assets.
 * Water-case states use reusable production keys so later water-restock levels
 * can share them without overriding legacy catalogue entries.
 */
export const LEVEL_TWO_ASSET_CATALOGUE: AssetCatalogue = Object.freeze({
  assets: Object.freeze([
    asset({
      key: "environment-restock-water-l2-v1",
      path: backgroundPath,
      category: "environment",
      canvasSize: [1672, 941],
      anchor: [0.5, 0.5],
      defaultScale: 1,
      depthGroup: "far-environment",
      preloadGroup: "starter-market",
      perspective: "fixed-third-person",
      lightDirection: "upper-left",
      state: "water-restock-l2",
      status: "production"
    }),
    asset({
      key: "prop-water-case-closed-v2",
      path: closedCasePath,
      category: "prop",
      canvasSize: [1536, 1024],
      anchor: [0.5, 0.96],
      defaultScale: 0.42,
      depthGroup: "props",
      preloadGroup: "starter-market",
      perspective: "fixed-third-person",
      lightDirection: "upper-left",
      state: "closed",
      status: "production"
    }),
    asset({
      key: "prop-water-case-open-v2",
      path: openCasePath,
      category: "prop",
      canvasSize: [1536, 1024],
      anchor: [0.5, 0.96],
      defaultScale: 0.42,
      depthGroup: "props",
      preloadGroup: "starter-market",
      perspective: "fixed-third-person",
      lightDirection: "upper-left",
      state: "open",
      status: "production"
    })
  ])
});
