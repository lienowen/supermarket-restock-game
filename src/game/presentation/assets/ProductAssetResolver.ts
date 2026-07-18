import { RETAINED_RUNTIME_ASSETS } from "./RetainedAssetManifest";

const PRODUCT_ASSET_KEY_BY_ID: Readonly<Record<string, string>> = Object.freeze({
  "cola-bottle": RETAINED_RUNTIME_ASSETS.products.colaBottle.key,
  "water-bottle": RETAINED_RUNTIME_ASSETS.products.waterBottle.key,
  "milk-bottle": RETAINED_RUNTIME_ASSETS.products.milkBottle.key
});

export function resolveProductAssetKey(productId: string): string {
  const assetKey = PRODUCT_ASSET_KEY_BY_ID[productId];
  if (!assetKey) throw new Error(`Missing presentation asset mapping for product ${productId}`);
  return assetKey;
}

export function validateProductAssetMappings(productIds: readonly string[]): readonly string[] {
  return Object.freeze(
    productIds
      .filter((productId) => !PRODUCT_ASSET_KEY_BY_ID[productId])
      .map((productId) => `Missing presentation asset mapping for product ${productId}`)
  );
}
