import { PRODUCTION_V1_ASSETS } from "../../assets/ProductionV1AssetPaths";
import type { ShelfSortLevelDefinition } from "../../systems/shelfSort/ShelfSortEngine";

export interface CommercialProductAsset {
  readonly productId: string;
  readonly textureKey: string;
  readonly path: string;
  readonly displayName: string;
}

const product = (
  productId: string,
  path: string,
  displayName: string
): CommercialProductAsset => Object.freeze({
  productId,
  textureKey: `commercial-product-${productId}`,
  path,
  displayName
});

export const COMMERCIAL_PRODUCT_ASSETS: Readonly<Record<string, CommercialProductAsset>> = Object.freeze({
  // The legacy apple PNG contains a disconnected generation fragment. Keep the
  // gameplay product ID stable for save/level compatibility while presenting
  // the approved grapes pack until a clean apple sprite is delivered.
  apple: product("apple", PRODUCTION_V1_ASSETS.product_grapes_pack, "Grapes"),
  "banana-bunch": product("banana-bunch", PRODUCTION_V1_ASSETS.product_banana_bunch, "Bananas"),
  "cereal-box": product("cereal-box", PRODUCTION_V1_ASSETS.product_cereal_box, "Cereal"),
  "chips-bag": product("chips-bag", PRODUCTION_V1_ASSETS.product_chips_bag, "Chips"),
  "cola-bottle": product("cola-bottle", PRODUCTION_V1_ASSETS.product_cola_bottle, "Cola"),
  "detergent-bottle": product("detergent-bottle", PRODUCTION_V1_ASSETS.product_detergent_bottle, "Detergent"),
  "grapes-pack": product("grapes-pack", PRODUCTION_V1_ASSETS.product_grapes_pack, "Grapes"),
  "lemon-lime-soda": product("lemon-lime-soda", PRODUCTION_V1_ASSETS.product_lemon_lime_soda, "Lemon Soda"),
  "milk-bottle": product("milk-bottle", PRODUCTION_V1_ASSETS.product_milk_jug, "Milk"),
  "oats-canister": product("oats-canister", PRODUCTION_V1_ASSETS.product_oats_canister, "Oats"),
  "orange-soda": product("orange-soda", PRODUCTION_V1_ASSETS.product_orange_soda, "Orange Soda"),
  "paper-towels": product("paper-towels", PRODUCTION_V1_ASSETS.product_paper_towels, "Paper Towels"),
  "peanut-butter": product("peanut-butter", PRODUCTION_V1_ASSETS.product_peanut_butter, "Peanut Butter"),
  "water-bottle": product("water-bottle", PRODUCTION_V1_ASSETS.product_water_bottle, "Water"),
  "yogurt-cup": product("yogurt-cup", PRODUCTION_V1_ASSETS.product_yogurt_cup, "Yogurt")
});

export function commercialProductAsset(productId: string): CommercialProductAsset | undefined {
  return COMMERCIAL_PRODUCT_ASSETS[productId];
}

export function commercialProductAssetsForLevels(
  levels: readonly ShelfSortLevelDefinition[]
): readonly CommercialProductAsset[] {
  const ids = new Set<string>();
  for (const level of levels) {
    for (const bay of level.bays) {
      bay.items.forEach((productId) => ids.add(productId));
    }
  }
  return Object.freeze([...ids]
    .map((productId) => COMMERCIAL_PRODUCT_ASSETS[productId])
    .filter((asset): asset is CommercialProductAsset => Boolean(asset)));
}

export function validateCommercialProductAssetCoverage(
  levels: readonly ShelfSortLevelDefinition[]
): readonly string[] {
  const errors: string[] = [];
  for (const level of levels) {
    for (const bay of level.bays) {
      for (const productId of bay.items) {
        if (!COMMERCIAL_PRODUCT_ASSETS[productId]) {
          errors.push(`${level.id}/${bay.id} has no commercial product asset for ${productId}`);
        }
      }
    }
  }
  return Object.freeze([...new Set(errors)]);
}
