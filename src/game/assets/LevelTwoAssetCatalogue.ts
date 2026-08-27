import type { AssetCatalogue, AssetDescriptor } from "./AssetDescriptor";

const asset = (descriptor: AssetDescriptor): AssetDescriptor => descriptor;

const recutWorker = (key: string, fileName: string, state: string): AssetDescriptor => asset({
  key,
  path: `assets/game/runtime-optimized/l1-l2/${fileName.replace(/\.png$/, ".webp")}`,
  category: "character",
  canvasSize: [1086, 1448],
  anchor: [0.5, 0.96],
  defaultScale: 0.42,
  depthGroup: "actors",
  preloadGroup: "starter-market",
  perspective: "fixed-third-person",
  lightDirection: "upper-left",
  state,
  status: "production"
});

const recutCart = (key: string, fileName: string, state: string): AssetDescriptor => asset({
  key,
  path: `assets/game/runtime-optimized/l1-l2/${fileName.replace(/\.png$/, ".webp")}`,
  category: "equipment",
  canvasSize: [1448, 1086],
  anchor: [0.5, 0.96],
  defaultScale: 0.44,
  depthGroup: "props",
  preloadGroup: "starter-market",
  perspective: "fixed-third-person",
  lightDirection: "upper-left",
  state,
  status: "production"
});

/**
 * L2 owns the authored water-restock art and also hosts the clean recut sprites
 * shared by L1-L2. The recut worker/cart keys are selected only for those two
 * restock levels, so checkout/clean/find-items scenes keep their existing actor
 * sets until their own art passes are approved.
 */
export const LEVEL_TWO_ASSET_CATALOGUE: AssetCatalogue = Object.freeze({
  assets: Object.freeze([
    recutWorker("worker-restock-idle-v2", "worker-idle.png", "idle"),
    recutWorker("worker-restock-push-v2", "worker-push.png", "push-cart"),
    recutCart("equipment-restock-cart-empty-v2", "cart-empty.png", "empty"),
    recutCart("equipment-restock-cart-cola-loaded-v2", "cart-cola-loaded.png", "cola-loaded"),
    recutCart("equipment-restock-cart-water-loaded-v2", "cart-water-loaded.png", "water-loaded"),
    asset({
      key: "environment-restock-water-l2-v1",
      path: "assets/game/runtime-optimized/backgrounds/l2-water.webp",
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
      path: "assets/game/runtime-optimized/l1-l2/water-case-closed.webp",
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
      path: "assets/game/runtime-optimized/l1-l2/water-case-open.webp",
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
