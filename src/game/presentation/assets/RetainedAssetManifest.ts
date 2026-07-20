import type { AssetDescriptor } from "../../assets/AssetDescriptor";
import { STARTER_RUNTIME_ASSET_REGISTRY } from "../../assets/RuntimeAssetRegistry";

export type RuntimeAssetStatus = "production" | "prototype";

export type RuntimeAssetDefinition = Readonly<
  Omit<AssetDescriptor, "status"> & { readonly status: RuntimeAssetStatus }
>;

const retained = (assetKey: string): RuntimeAssetDefinition => {
  const asset = STARTER_RUNTIME_ASSET_REGISTRY.require(assetKey);
  if (asset.status !== "prototype" && asset.status !== "production") {
    throw new Error(`Compatibility runtime asset must be playable: ${assetKey}`);
  }
  return asset as RuntimeAssetDefinition;
};

/**
 * Compatibility semantic aliases for legacy game-v2 imports.
 *
 * Keys, paths, dimensions, and status all come from STARTER_ASSET_CATALOGUE.
 * New code should use RuntimeAssetRegistry and level asset bindings directly.
 */
export const RETAINED_RUNTIME_ASSETS = {
  environment: {
    salesFloor: retained("environment-starter-market-salesfloor-prototype")
  },
  fixtures: {
    beverageCooler: retained("fixture-beverage-cooler-a")
  },
  characters: {
    workerPush: retained("worker-a-push-cart"),
    workerCarry: retained("worker-a-carry-medium")
  },
  products: {
    colaBottle: retained("product-cola-bottle"),
    milkBottle: retained("product-milk-bottle"),
    waterBottle: retained("product-water-bottle")
  },
  props: {
    cart: retained("equipment-restock-cart-a-empty"),
    cartLoaded: retained("equipment-restock-cart-a-loaded"),
    colaCase: retained("prop-cola-case-closed")
  }
} as const satisfies Record<string, Record<string, RuntimeAssetDefinition>>;

export const RETAINED_RUNTIME_ASSET_LIST: readonly RuntimeAssetDefinition[] = Object.freeze(
  Object.values(RETAINED_RUNTIME_ASSETS).flatMap((group) => Object.values(group))
);
