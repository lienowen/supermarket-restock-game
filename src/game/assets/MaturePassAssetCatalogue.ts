import type { AssetCatalogue, AssetDescriptor } from "./AssetDescriptor";
import { PRODUCTION_V1_ASSETS } from "./ProductionV1AssetPaths";

const productionProduct = (
  key: string,
  path: string,
  state = "single-unit"
): AssetDescriptor => ({
  key,
  path,
  category: "product",
  canvasSize: [512, 768],
  anchor: [0.5, 0.96],
  defaultScale: 0.18,
  depthGroup: "fixture-contents",
  preloadGroup: "starter-market",
  perspective: "fixed-third-person",
  lightDirection: "upper-left",
  state,
  status: "production"
});

/**
 * Assets introduced by the mature-pass vertical slice. Keep this catalogue
 * small and production-only so the golden level can reuse verified repository
 * art without changing the legacy starter catalogue in-place.
 */
export const MATURE_PASS_ASSET_CATALOGUE: AssetCatalogue = Object.freeze({
  assets: Object.freeze([
    productionProduct("product-banana-bunch", PRODUCTION_V1_ASSETS.product_banana_bunch),
    productionProduct("product-grapes-pack", PRODUCTION_V1_ASSETS.product_grapes_pack),
    productionProduct("product-peanut-butter", PRODUCTION_V1_ASSETS.product_peanut_butter)
  ])
});
