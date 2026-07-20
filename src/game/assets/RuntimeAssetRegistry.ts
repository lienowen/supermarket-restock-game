import type { AssetCatalogue, AssetDescriptor } from "./AssetDescriptor";
import { STARTER_ASSET_CATALOGUE } from "./starterAssetCatalogue";

export interface RuntimeAssetRegistry {
  readonly list: readonly AssetDescriptor[];
  readonly byKey: Readonly<Record<string, AssetDescriptor>>;
  get(assetKey: string): AssetDescriptor | undefined;
  require(assetKey: string): AssetDescriptor;
  resolve(assetKeys: readonly string[]): readonly AssetDescriptor[];
  validateKeys(assetKeys: readonly string[]): readonly string[];
}

export function createRuntimeAssetRegistry(
  catalogue: AssetCatalogue
): RuntimeAssetRegistry {
  const byKey = Object.freeze(
    Object.fromEntries(catalogue.assets.map((asset) => [asset.key, asset]))
  ) as Readonly<Record<string, AssetDescriptor>>;
  const list = Object.freeze([...catalogue.assets]);

  return Object.freeze({
    list,
    byKey,
    get(assetKey: string): AssetDescriptor | undefined {
      return byKey[assetKey];
    },
    require(assetKey: string): AssetDescriptor {
      const asset = byKey[assetKey];
      if (!asset) throw new Error(`Missing runtime asset: ${assetKey}`);
      return asset;
    },
    resolve(assetKeys: readonly string[]): readonly AssetDescriptor[] {
      return Object.freeze(
        [...new Set(assetKeys)].map((assetKey) => {
          const asset = byKey[assetKey];
          if (!asset) throw new Error(`Missing runtime asset: ${assetKey}`);
          return asset;
        })
      );
    },
    validateKeys(assetKeys: readonly string[]): readonly string[] {
      return Object.freeze(
        [...new Set(assetKeys)]
          .filter((assetKey) => !byKey[assetKey])
          .map((assetKey) => `Missing runtime asset: ${assetKey}`)
      );
    }
  });
}

export const STARTER_RUNTIME_ASSET_REGISTRY = createRuntimeAssetRegistry(
  STARTER_ASSET_CATALOGUE
);
