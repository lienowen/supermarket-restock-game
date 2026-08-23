import type { AssetDescriptor } from "./AssetDescriptor";
import {
  resolveGlobalAssetPack,
  restockCaseAssetsFor,
  type CheckoutGlobalAssetPack,
  type CleanGlobalAssetPack,
  type FindItemsGlobalAssetPack,
  type RestockGlobalAssetPack
} from "./GlobalAssetPackRegistry";
import { resolveLevelEnvironmentAssetKey } from "./LevelEnvironmentRegistry";
import type { RuntimeAssetRegistry } from "./RuntimeAssetRegistry";
import type { CheckoutLevelRuntimeContent } from "../application/CheckoutLevelRuntimeContent";
import type { RestockShiftRuntimeContent } from "../application/ShiftRuntimeContent";
import type {
  CleanLevelRuntimeContent,
  FindItemsLevelRuntimeContent
} from "../application/UtilityLevelRuntimeContent";
import type {
  CheckoutLevelDefinition,
  CleanLevelDefinition,
  FindItemsLevelDefinition,
  RestockLevelDefinition
} from "../content/GameContent";

interface BaseResolvedLevelAssets {
  readonly preload: readonly AssetDescriptor[];
  readonly environment: AssetDescriptor;
  readonly workerWalk: readonly [AssetDescriptor, AssetDescriptor];
}

interface RestockVisualAssetKeys {
  readonly workerIdleAssetKey: string;
  readonly workerPushAssetKey: string;
  readonly cartEmptyAssetKey: string;
  readonly cartLoadedAssetKey: string;
}

export interface ResolvedRestockLevelAssets extends BaseResolvedLevelAssets {
  readonly fixture: AssetDescriptor;
  readonly workerIdle: AssetDescriptor;
  readonly workerPush: AssetDescriptor;
  readonly workerCarry: AssetDescriptor;
  readonly workerOpen: AssetDescriptor;
  readonly workerStock: AssetDescriptor;
  readonly cart: AssetDescriptor;
  readonly cartLoaded: AssetDescriptor;
  readonly case: AssetDescriptor;
  readonly caseOpen: AssetDescriptor;
  readonly product: AssetDescriptor;
  readonly ambientProducts: readonly AssetDescriptor[];
}

export interface ResolvedCheckoutLevelAssets extends BaseResolvedLevelAssets {
  readonly fixture: AssetDescriptor;
  readonly worker: AssetDescriptor;
  readonly workerScan: AssetDescriptor;
  readonly customers: readonly AssetDescriptor[];
  readonly equipment: readonly AssetDescriptor[];
  readonly products: readonly AssetDescriptor[];
}

export interface ResolvedCleanLevelAssets extends BaseResolvedLevelAssets {
  readonly worker: AssetDescriptor;
  readonly workerMop: AssetDescriptor;
  readonly cleaningFixture: AssetDescriptor;
  readonly cleaningCart: AssetDescriptor;
  readonly wetFloorSign: AssetDescriptor;
  readonly spills: readonly AssetDescriptor[];
  readonly customerPatrol: AssetDescriptor;
}

export interface ResolvedFindItemsLevelAssets extends BaseResolvedLevelAssets {
  readonly worker: AssetDescriptor;
  readonly workerThinking: AssetDescriptor;
  readonly fixture: AssetDescriptor;
  readonly basket: AssetDescriptor;
  readonly items: readonly AssetDescriptor[];
}

const CHECKOUT_PRODUCT_ASSET_KEYS = Object.freeze([
  "product-apple",
  "product-milk-bottle",
  "product-cereal-box"
]);
const CLEAN_SPILL_ASSET_KEYS = Object.freeze([
  "spill-water-large",
  "spill-juice-large",
  "spill-dirt-smear-large"
]);
const BACKGROUND_ONLY_RESTOCK_LEVEL_IDS = new Set([
  "starter-level-001",
  "starter-level-002"
]);
const RECUT_RESTOCK_LEVEL_IDS = new Set([
  "starter-level-001",
  "starter-level-002"
]);

const resolveDescriptors = (
  registry: RuntimeAssetRegistry,
  assetKeys: readonly string[]
): readonly AssetDescriptor[] => registry.resolve(assetKeys);

const baseAssets = (
  registry: RuntimeAssetRegistry,
  pack: RestockGlobalAssetPack | CheckoutGlobalAssetPack | CleanGlobalAssetPack | FindItemsGlobalAssetPack,
  environmentAssetKey: string
): BaseResolvedLevelAssets => ({
  preload: Object.freeze([]),
  environment: registry.require(environmentAssetKey),
  workerWalk: Object.freeze([
    registry.require(pack.workerWalkAssetKeys[0]),
    registry.require(pack.workerWalkAssetKeys[1])
  ]) as readonly [AssetDescriptor, AssetDescriptor]
});

const restockVisualAssetKeysFor = (
  level: RestockLevelDefinition,
  pack: RestockGlobalAssetPack
): RestockVisualAssetKeys => {
  if (!RECUT_RESTOCK_LEVEL_IDS.has(level.id)) {
    return Object.freeze({
      workerIdleAssetKey: pack.workerIdleAssetKey,
      workerPushAssetKey: pack.workerPushAssetKey,
      cartEmptyAssetKey: pack.cartEmptyAssetKey,
      cartLoadedAssetKey: pack.cartLoadedAssetKey
    });
  }

  return Object.freeze({
    workerIdleAssetKey: "worker-restock-idle-v2",
    workerPushAssetKey: "worker-restock-push-v2",
    cartEmptyAssetKey: "equipment-restock-cart-empty-v2",
    cartLoadedAssetKey: level.id === "starter-level-002"
      ? "equipment-restock-cart-water-loaded-v2"
      : "equipment-restock-cart-cola-loaded-v2"
  });
};

const restockPreloadKeys = (
  level: RestockLevelDefinition,
  pack: RestockGlobalAssetPack,
  visualAssetKeys: RestockVisualAssetKeys,
  environmentAssetKey: string,
  caseAssets: { readonly closedAssetKey: string; readonly openAssetKey: string },
  runtime: RestockShiftRuntimeContent
): readonly string[] => {
  const gameplayKeys = [
    environmentAssetKey,
    ...pack.workerWalkAssetKeys,
    visualAssetKeys.workerIdleAssetKey,
    visualAssetKeys.workerPushAssetKey,
    pack.workerCarryAssetKey,
    pack.workerOpenAssetKey,
    pack.workerStockAssetKey,
    visualAssetKeys.cartEmptyAssetKey,
    visualAssetKeys.cartLoadedAssetKey,
    caseAssets.closedAssetKey,
    caseAssets.openAssetKey,
    runtime.product.assetKey
  ];

  if (BACKGROUND_ONLY_RESTOCK_LEVEL_IDS.has(level.id)) {
    return Object.freeze(gameplayKeys);
  }

  return Object.freeze([
    ...gameplayKeys,
    ...pack.sharedStoreAssetKeys,
    runtime.fixture.assetKey,
    ...pack.ambientProductAssetKeys
  ]);
};

export function resolveRestockLevelAssets(
  registry: RuntimeAssetRegistry,
  level: RestockLevelDefinition,
  runtime: RestockShiftRuntimeContent
): ResolvedRestockLevelAssets {
  const pack = resolveGlobalAssetPack(level.presentation.assetPackId, "restock");
  const visualAssetKeys = restockVisualAssetKeysFor(level, pack);
  const environmentAssetKey = resolveLevelEnvironmentAssetKey(level.id, pack.environmentAssetKey);
  const caseAssets = restockCaseAssetsFor(pack, runtime.product.id);
  const preload = resolveDescriptors(
    registry,
    restockPreloadKeys(level, pack, visualAssetKeys, environmentAssetKey, caseAssets, runtime)
  );
  return Object.freeze({
    ...baseAssets(registry, pack, environmentAssetKey),
    preload,
    fixture: registry.require(runtime.fixture.assetKey),
    workerIdle: registry.require(visualAssetKeys.workerIdleAssetKey),
    workerPush: registry.require(visualAssetKeys.workerPushAssetKey),
    workerCarry: registry.require(pack.workerCarryAssetKey),
    workerOpen: registry.require(pack.workerOpenAssetKey),
    workerStock: registry.require(pack.workerStockAssetKey),
    cart: registry.require(visualAssetKeys.cartEmptyAssetKey),
    cartLoaded: registry.require(visualAssetKeys.cartLoadedAssetKey),
    case: registry.require(caseAssets.closedAssetKey),
    caseOpen: registry.require(caseAssets.openAssetKey),
    product: registry.require(runtime.product.assetKey),
    ambientProducts: Object.freeze(pack.ambientProductAssetKeys.map((key) => registry.require(key)))
  });
}

export function resolveCheckoutLevelAssets(
  registry: RuntimeAssetRegistry,
  level: CheckoutLevelDefinition,
  runtime: CheckoutLevelRuntimeContent
): ResolvedCheckoutLevelAssets {
  const pack = resolveGlobalAssetPack(level.presentation.assetPackId, "checkout");
  const environmentAssetKey = resolveLevelEnvironmentAssetKey(level.id, pack.environmentAssetKey);
  const authoredCheckoutPlate = environmentAssetKey.startsWith("environment-project-checkout");
  const preload = resolveDescriptors(registry, [
    environmentAssetKey,
    ...(authoredCheckoutPlate ? [] : pack.sharedStoreAssetKeys),
    ...pack.workerWalkAssetKeys,
    pack.workerIdleAssetKey,
    pack.workerScanAssetKey,
    runtime.fixture.assetKey,
    ...pack.customerAssetKeys,
    ...pack.equipmentAssetKeys,
    ...CHECKOUT_PRODUCT_ASSET_KEYS
  ]);
  return Object.freeze({
    ...baseAssets(registry, pack, environmentAssetKey),
    preload,
    fixture: registry.require(runtime.fixture.assetKey),
    worker: registry.require(pack.workerIdleAssetKey),
    workerScan: registry.require(pack.workerScanAssetKey),
    customers: Object.freeze(pack.customerAssetKeys.map((key) => registry.require(key))),
    equipment: Object.freeze(pack.equipmentAssetKeys.map((key) => registry.require(key))),
    products: Object.freeze(CHECKOUT_PRODUCT_ASSET_KEYS.map((key) => registry.require(key)))
  });
}

export function resolveCleanLevelAssets(
  registry: RuntimeAssetRegistry,
  level: CleanLevelDefinition,
  _runtime: CleanLevelRuntimeContent
): ResolvedCleanLevelAssets {
  const pack = resolveGlobalAssetPack(level.presentation.assetPackId, "clean");
  const environmentAssetKey = resolveLevelEnvironmentAssetKey(level.id, pack.environmentAssetKey);
  const preload = resolveDescriptors(registry, [
    environmentAssetKey,
    ...pack.sharedStoreAssetKeys,
    ...pack.workerWalkAssetKeys,
    pack.workerIdleAssetKey,
    pack.workerMopAssetKey,
    pack.cleaningFixtureAssetKey,
    pack.cleaningCartAssetKey,
    pack.wetFloorSignAssetKey,
    "customer-a-carry-basket",
    ...CLEAN_SPILL_ASSET_KEYS
  ]);
  return Object.freeze({
    ...baseAssets(registry, pack, environmentAssetKey),
    preload,
    worker: registry.require(pack.workerIdleAssetKey),
    workerMop: registry.require(pack.workerMopAssetKey),
    cleaningFixture: registry.require(pack.cleaningFixtureAssetKey),
    cleaningCart: registry.require(pack.cleaningCartAssetKey),
    wetFloorSign: registry.require(pack.wetFloorSignAssetKey),
    customerPatrol: registry.require("customer-a-carry-basket"),
    spills: Object.freeze(CLEAN_SPILL_ASSET_KEYS.map((key) => registry.require(key)))
  });
}

export function resolveFindItemsLevelAssets(
  registry: RuntimeAssetRegistry,
  level: FindItemsLevelDefinition,
  runtime: FindItemsLevelRuntimeContent
): ResolvedFindItemsLevelAssets {
  const pack = resolveGlobalAssetPack(level.presentation.assetPackId, "find-items");
  const productAssetKeys = runtime.products.map((product) => product.assetKey);
  const workerIdleAssetKey = level.id === "starter-level-009"
    ? "worker-priority-picker"
    : pack.workerIdleAssetKey;
  const environmentAssetKey = resolveLevelEnvironmentAssetKey(level.id, pack.environmentAssetKey);
  const authoredOrderHuntPlate = environmentAssetKey.startsWith("environment-project-order-hunt");
  const preload = resolveDescriptors(registry, [
    environmentAssetKey,
    ...(authoredOrderHuntPlate ? [] : pack.sharedStoreAssetKeys),
    ...pack.workerWalkAssetKeys,
    workerIdleAssetKey,
    pack.workerThinkingAssetKey,
    pack.basketAssetKey,
    ...(authoredOrderHuntPlate ? [] : [runtime.fixture.assetKey]),
    ...productAssetKeys
  ]);
  return Object.freeze({
    ...baseAssets(registry, pack, environmentAssetKey),
    preload,
    worker: registry.require(workerIdleAssetKey),
    workerThinking: registry.require(pack.workerThinkingAssetKey),
    fixture: registry.require(runtime.fixture.assetKey),
    basket: registry.require(pack.basketAssetKey),
    items: Object.freeze(productAssetKeys.map((key) => registry.require(key)))
  });
}
