import { STARTER_RUNTIME_ASSET_REGISTRY } from "../../assets/RuntimeAssetRegistry";
import { STARTER_MARKET_CONTENT } from "../../content/starterMarket";

const PRODUCT_ASSET_KEY_BY_ID: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(
    STARTER_MARKET_CONTENT.products.map((product) => [product.id, product.assetKey])
  )
);

export function resolveProductAssetKey(productId: string): string {
  const assetKey = PRODUCT_ASSET_KEY_BY_ID[productId];
  if (!assetKey) throw new Error(`Missing product definition for ${productId}`);
  STARTER_RUNTIME_ASSET_REGISTRY.require(assetKey);
  return assetKey;
}

export function validateProductAssetMappings(productIds: readonly string[]): readonly string[] {
  return Object.freeze(
    productIds.flatMap((productId) => {
      const assetKey = PRODUCT_ASSET_KEY_BY_ID[productId];
      if (!assetKey) return [`Missing product definition for ${productId}`];
      return STARTER_RUNTIME_ASSET_REGISTRY.get(assetKey)
        ? []
        : [`Missing presentation asset mapping for product ${productId}: ${assetKey}`];
    })
  );
}
