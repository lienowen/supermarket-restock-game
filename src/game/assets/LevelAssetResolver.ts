import type { AssetDescriptor } from "./AssetDescriptor";
import {
  resolveGlobalAssetPack,
  restockCaseAssetsFor,
  type CheckoutGlobalAssetPack,
  type CleanGlobalAssetPack,
  type FindItemsGlobalAssetPack,
  type RestockGlobalAssetPack
} from "./GlobalAssetPackRegistry";
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
}

export interface ResolvedCleanLevelAssets extends BaseResolvedLevelAssets {
  readonly worker: AssetDescriptor;
  readonly workerMop: AssetDescriptor;
  readonly cleaningFixture: AssetDescriptor;
  readonly cleaningCart: AssetDescriptor;
  readonly wetFloorSign: AssetDescriptor;
}

export interface ResolvedFindItemsLevelAssets extends BaseResolvedLevelAssets {
  readonly worker: AssetDescriptor;
  readonly workerThinking: AssetDescriptor;
  readonly fixture: AssetDescriptor;
  readonly basket: AssetDescriptor;
  readonly items: readonly AssetDescriptor[];
}

const resolveDescriptors = (
  registry: RuntimeAssetRegistry,
  assetKeys: readonly string[]
): readonly AssetDescriptor[] => registry.resolve(assetKeys);

const baseAssets = (
  registry: RuntimeAssetRegistry,
  pack: RestockGlobalAssetPack | CheckoutGlobalAssetPack | CleanGlobalAssetPack | FindItemsGlobalAssetPack
): BaseResolvedLevelAssets => ({
  preload: Object.freeze([]),
  environment: registry.require(pack.environmentAssetKey),
  workerWalk: Object.freeze([
    registry.require(pack.workerWalkAssetKeys[0]),
    registry.require(pack.workerWalkAssetKeys[1])
  ]) as readonly [AssetDescriptor, AssetDescriptor]
});

export function resolveRestockLevelAssets(
  registry: RuntimeAssetRegistry,
  level: RestockLevelDefinition,
  runtime: RestockShiftRuntimeContent
): ResolvedRestockLevelAssets {
  const pack = resolveGlobalAssetPack(level.presentation.assetPackId, "restock");
  const caseAssets = restockCaseAssetsFor(pack, runtime.product.id);
  const preload = resolveDescriptors(registry, [
    pack.environmentAssetKey,
    ...pack.sharedStoreAssetKeys,
    ...pack.workerWalkAssetKeys,
    pack.workerIdleAssetKey,
    pack.workerPushAssetKey,
    pack.workerCarryAssetKey,
    pack.workerOpenAssetKey,
    pack.workerStockAssetKey,
    pack.cartEmptyAssetKey,
    pack.cartLoadedAssetKey,
    caseAssets.closedAssetKey,
    caseAssets.openAssetKey,
    runtime.fixture.assetKey,
    runtime.product.assetKey,
    ...pack.ambientProductAssetKeys
  ]);
  return Object.freeze({
    ...baseAssets(registry, pack),
    preload,
    fixture: registry.require(runtime.fixture.assetKey),
    workerIdle: registry.require(pack.workerIdleAssetKey),
    workerPush: registry.require(pack.workerPushAssetKey),
    workerCarry: registry.require(pack.workerCarryAssetKey),
    workerOpen: registry.require(pack.workerOpenAssetKey),
    workerStock: registry.require(pack.workerStockAssetKey),
    cart: registry.require(pack.cartEmptyAssetKey),
    cartLoaded: registry.require(pack.cartLoadedAssetKey),
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
  const preload = resolveDescriptors(registry, [
    pack.environmentAssetKey,
    ...pack.sharedStoreAssetKeys,
    ...pack.workerWalkAssetKeys,
    pack.workerIdleAssetKey,
    pack.workerScanAssetKey,
    runtime.fixture.assetKey,
    ...pack.customerAssetKeys,
    ...pack.equipmentAssetKeys
  ]);
  return Object.freeze({
    ...baseAssets(registry, pack),
    preload,
    fixture: registry.require(runtime.fixture.assetKey),
    worker: registry.require(pack.workerIdleAssetKey),
    workerScan: registry.require(pack.workerScanAssetKey),
    customers: Object.freeze(pack.customerAssetKeys.map((key) => registry.require(key))),
    equipment: Object.freeze(pack.equipmentAssetKeys.map((key) => registry.require(key)))
  });
}

export function resolveCleanLevelAssets(
  registry: RuntimeAssetRegistry,
  level: CleanLevelDefinition,
  _runtime: CleanLevelRuntimeContent
): ResolvedCleanLevelAssets {
  const pack = resolveGlobalAssetPack(level.presentation.assetPackId, "clean");
  const preload = resolveDescriptors(registry, [
    pack.environmentAssetKey,
    ...pack.sharedStoreAssetKeys,
    ...pack.workerWalkAssetKeys,
    pack.workerIdleAssetKey,
    pack.workerMopAssetKey,
    pack.cleaningFixtureAssetKey,
    pack.cleaningCartAssetKey,
    pack.wetFloorSignAssetKey
  ]);
  return Object.freeze({
    ...baseAssets(registry, pack),
    preload,
    worker: registry.require(pack.workerIdleAssetKey),
    workerMop: registry.require(pack.workerMopAssetKey),
    cleaningFixture: registry.require(pack.cleaningFixtureAssetKey),
    cleaningCart: registry.require(pack.cleaningCartAssetKey),
    wetFloorSign: registry.require(pack.wetFloorSignAssetKey)
  });
}

export function resolveFindItemsLevelAssets(
  registry: RuntimeAssetRegistry,
  level: FindItemsLevelDefinition,
  runtime: FindItemsLevelRuntimeContent
): ResolvedFindItemsLevelAssets {
  const pack = resolveGlobalAssetPack(level.presentation.assetPackId, "find-items");
  const productAssetKeys = runtime.products.map((product) => product.assetKey);
  const preload = resolveDescriptors(registry, [
    pack.environmentAssetKey,
    ...pack.sharedStoreAssetKeys,
    ...pack.workerWalkAssetKeys,
    pack.workerIdleAssetKey,
    pack.workerThinkingAssetKey,
    pack.basketAssetKey,
    runtime.fixture.assetKey,
    ...productAssetKeys
  ]);
  return Object.freeze({
    ...baseAssets(registry, pack),
    preload,
    worker: registry.require(pack.workerIdleAssetKey),
    workerThinking: registry.require(pack.workerThinkingAssetKey),
    fixture: registry.require(runtime.fixture.assetKey),
    basket: registry.require(pack.basketAssetKey),
    items: Object.freeze(productAssetKeys.map((key) => registry.require(key)))
  });
}
