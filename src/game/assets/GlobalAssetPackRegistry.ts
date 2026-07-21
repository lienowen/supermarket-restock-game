export type GameplayMode = "restock" | "checkout" | "clean" | "find-items";

export type GlobalAssetPackId =
  | "market-restock-v1"
  | "market-checkout-v1"
  | "market-clean-v1"
  | "market-find-items-v1";

interface BaseGlobalAssetPack {
  readonly id: GlobalAssetPackId;
  readonly mode: GameplayMode;
  readonly environmentAssetKey: string;
  readonly sharedStoreAssetKeys: readonly string[];
  readonly workerIdleAssetKey: string;
  readonly workerWalkAssetKeys: readonly [string, string];
}

export interface RestockGlobalAssetPack extends BaseGlobalAssetPack {
  readonly id: "market-restock-v1";
  readonly mode: "restock";
  readonly workerPushAssetKey: string;
  readonly workerCarryAssetKey: string;
  readonly workerOpenAssetKey: string;
  readonly workerStockAssetKey: string;
  readonly cartEmptyAssetKey: string;
  readonly cartLoadedAssetKey: string;
  readonly ambientProductAssetKeys: readonly string[];
  readonly caseAssetsByProductId: Readonly<Record<string, {
    readonly closedAssetKey: string;
    readonly openAssetKey: string;
  }>>;
}

export interface CheckoutGlobalAssetPack extends BaseGlobalAssetPack {
  readonly id: "market-checkout-v1";
  readonly mode: "checkout";
  readonly workerScanAssetKey: string;
  readonly customerAssetKeys: readonly string[];
  readonly equipmentAssetKeys: readonly string[];
}

export interface CleanGlobalAssetPack extends BaseGlobalAssetPack {
  readonly id: "market-clean-v1";
  readonly mode: "clean";
  readonly workerMopAssetKey: string;
  readonly cleaningFixtureAssetKey: string;
  readonly cleaningCartAssetKey: string;
  readonly wetFloorSignAssetKey: string;
}

export interface FindItemsGlobalAssetPack extends BaseGlobalAssetPack {
  readonly id: "market-find-items-v1";
  readonly mode: "find-items";
  readonly workerThinkingAssetKey: string;
  readonly basketAssetKey: string;
}

export type GlobalAssetPack =
  | RestockGlobalAssetPack
  | CheckoutGlobalAssetPack
  | CleanGlobalAssetPack
  | FindItemsGlobalAssetPack;

const SHARED_STORE_ASSET_KEYS = Object.freeze([
  "fixture-produce-display-a",
  "fixture-backroom-rack-a"
]);

const SHARED_WORKER_WALK_KEYS = Object.freeze([
  "worker-a-walk-01",
  "worker-a-walk-02"
]) as readonly [string, string];

export const MARKET_RESTOCK_ASSET_PACK: RestockGlobalAssetPack = Object.freeze({
  id: "market-restock-v1",
  mode: "restock",
  environmentAssetKey: "environment-starter-market-salesfloor-prototype",
  sharedStoreAssetKeys: SHARED_STORE_ASSET_KEYS,
  workerIdleAssetKey: "worker-a-idle",
  workerWalkAssetKeys: SHARED_WORKER_WALK_KEYS,
  workerPushAssetKey: "worker-a-push-cart",
  workerCarryAssetKey: "worker-a-carry-medium",
  workerOpenAssetKey: "worker-a-open-case",
  workerStockAssetKey: "worker-a-place-middle",
  cartEmptyAssetKey: "equipment-restock-cart-a-empty",
  cartLoadedAssetKey: "equipment-restock-cart-a-loaded",
  ambientProductAssetKeys: Object.freeze([
    "product-cola-bottle",
    "product-milk-bottle",
    "product-water-bottle"
  ]),
  caseAssetsByProductId: Object.freeze({
    "cola-bottle": Object.freeze({
      closedAssetKey: "prop-cola-case-closed",
      openAssetKey: "prop-cola-case-open"
    }),
    "water-bottle": Object.freeze({
      closedAssetKey: "prop-water-case-closed",
      openAssetKey: "prop-water-case-closed"
    }),
    "milk-bottle": Object.freeze({
      closedAssetKey: "prop-milk-case-closed",
      openAssetKey: "prop-milk-case-closed"
    })
  })
});

export const MARKET_CHECKOUT_ASSET_PACK: CheckoutGlobalAssetPack = Object.freeze({
  id: "market-checkout-v1",
  mode: "checkout",
  environmentAssetKey: "environment-starter-market-salesfloor-prototype",
  sharedStoreAssetKeys: SHARED_STORE_ASSET_KEYS,
  workerIdleAssetKey: "worker-a-idle",
  workerWalkAssetKeys: SHARED_WORKER_WALK_KEYS,
  workerScanAssetKey: "worker-a-scan-register",
  customerAssetKeys: Object.freeze([
    "customer-a-carry-basket",
    "customer-b-carry-basket",
    "customer-c-idle",
    "customer-d-checkout"
  ]),
  equipmentAssetKeys: Object.freeze([
    "equipment-checkout-scanner",
    "equipment-pos-terminal",
    "equipment-shopping-basket"
  ])
});

export const MARKET_CLEAN_ASSET_PACK: CleanGlobalAssetPack = Object.freeze({
  id: "market-clean-v1",
  mode: "clean",
  environmentAssetKey: "environment-starter-market-salesfloor-prototype",
  sharedStoreAssetKeys: SHARED_STORE_ASSET_KEYS,
  workerIdleAssetKey: "worker-a-idle",
  workerWalkAssetKeys: SHARED_WORKER_WALK_KEYS,
  workerMopAssetKey: "worker-a-mop-floor",
  cleaningFixtureAssetKey: "fixture-cleaning-supplies-a",
  cleaningCartAssetKey: "equipment-cleaning-cart",
  wetFloorSignAssetKey: "equipment-wet-floor-sign"
});

export const MARKET_FIND_ITEMS_ASSET_PACK: FindItemsGlobalAssetPack = Object.freeze({
  id: "market-find-items-v1",
  mode: "find-items",
  environmentAssetKey: "environment-starter-market-salesfloor-prototype",
  sharedStoreAssetKeys: SHARED_STORE_ASSET_KEYS,
  workerIdleAssetKey: "worker-a-idle",
  workerWalkAssetKeys: SHARED_WORKER_WALK_KEYS,
  workerThinkingAssetKey: "worker-a-thinking",
  basketAssetKey: "equipment-shopping-basket"
});

const GLOBAL_ASSET_PACKS: Readonly<Record<GlobalAssetPackId, GlobalAssetPack>> = Object.freeze({
  [MARKET_RESTOCK_ASSET_PACK.id]: MARKET_RESTOCK_ASSET_PACK,
  [MARKET_CHECKOUT_ASSET_PACK.id]: MARKET_CHECKOUT_ASSET_PACK,
  [MARKET_CLEAN_ASSET_PACK.id]: MARKET_CLEAN_ASSET_PACK,
  [MARKET_FIND_ITEMS_ASSET_PACK.id]: MARKET_FIND_ITEMS_ASSET_PACK
});

export function resolveGlobalAssetPack(
  assetPackId: string,
  expectedMode: "restock"
): RestockGlobalAssetPack;
export function resolveGlobalAssetPack(
  assetPackId: string,
  expectedMode: "checkout"
): CheckoutGlobalAssetPack;
export function resolveGlobalAssetPack(
  assetPackId: string,
  expectedMode: "clean"
): CleanGlobalAssetPack;
export function resolveGlobalAssetPack(
  assetPackId: string,
  expectedMode: "find-items"
): FindItemsGlobalAssetPack;
export function resolveGlobalAssetPack(
  assetPackId: string,
  expectedMode: GameplayMode
): GlobalAssetPack;
export function resolveGlobalAssetPack(
  assetPackId: string,
  expectedMode: GameplayMode
): GlobalAssetPack {
  const pack = GLOBAL_ASSET_PACKS[assetPackId as GlobalAssetPackId];
  if (!pack) throw new Error(`Unknown global asset pack: ${assetPackId}`);
  if (pack.mode !== expectedMode) {
    throw new Error(`Asset pack ${assetPackId} belongs to ${pack.mode}, not ${expectedMode}`);
  }
  return pack;
}

export function restockCaseAssetsFor(
  pack: RestockGlobalAssetPack,
  productId: string
): { readonly closedAssetKey: string; readonly openAssetKey: string } {
  const assets = pack.caseAssetsByProductId[productId];
  if (!assets) throw new Error(`Asset pack ${pack.id} has no case assets for ${productId}`);
  return assets;
}
