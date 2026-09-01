import type { AssetCatalogue, AssetDescriptor } from "./AssetDescriptor";
import type { StaffRankId } from "../application/StaffProgression";

const character = (key: string, path: string, state: string): AssetDescriptor => Object.freeze({
  key,
  path,
  category: "character",
  canvasSize: [1024, 1536] as const,
  anchor: [0.5, 0.96] as const,
  defaultScale: 0.42,
  depthGroup: "actors",
  preloadGroup: "staff-growth",
  perspective: "fixed-third-person",
  lightDirection: "upper-left",
  state,
  status: "production"
});

export interface StaffGrowthAssetKeys {
  readonly idle: string;
  readonly carry: string;
  readonly place: string;
  readonly push: string;
}

export const STAFF_GROWTH_ASSET_KEYS: Readonly<Record<Exclude<StaffRankId, "trainee">, StaffGrowthAssetKeys>> = Object.freeze({
  "store-associate": Object.freeze({
    idle: "staff-store-associate-idle",
    carry: "staff-store-associate-carry-medium",
    place: "staff-store-associate-place-low",
    push: "staff-store-associate-push-cart"
  }),
  "senior-associate": Object.freeze({
    idle: "staff-senior-associate-idle",
    carry: "staff-senior-associate-carry-medium",
    place: "staff-senior-associate-place-low",
    push: "staff-senior-associate-push-cart"
  }),
  "shift-leader": Object.freeze({
    idle: "staff-shift-leader-idle",
    carry: "staff-shift-leader-carry-medium",
    place: "staff-shift-leader-place-low",
    push: "staff-shift-leader-push-cart"
  })
});

export const STAFF_GROWTH_ASSET_CATALOGUE: AssetCatalogue = Object.freeze({
  assets: Object.freeze([
    character(
      STAFF_GROWTH_ASSET_KEYS["store-associate"].idle,
      new URL("../../../asset-source/supermarket_staff_growth_phase1/store_associate_idle.png", import.meta.url).href,
      "idle"
    ),
    character(
      STAFF_GROWTH_ASSET_KEYS["store-associate"].carry,
      new URL("../../../asset-source/supermarket_staff_growth_phase1/store_associate_carry-medium.png", import.meta.url).href,
      "carry-medium"
    ),
    character(
      STAFF_GROWTH_ASSET_KEYS["store-associate"].place,
      new URL("../../../asset-source/supermarket_staff_growth_phase1/store_associate_place-low.png", import.meta.url).href,
      "place-low"
    ),
    character(
      STAFF_GROWTH_ASSET_KEYS["store-associate"].push,
      new URL("../../../asset-source/supermarket_staff_growth_phase1/store_associate_push-cart.png", import.meta.url).href,
      "push-cart"
    ),
    character(
      STAFF_GROWTH_ASSET_KEYS["senior-associate"].idle,
      new URL("../../../asset-source/supermarket_staff_growth_phase1/senior_associate_idle.png", import.meta.url).href,
      "idle"
    ),
    character(
      STAFF_GROWTH_ASSET_KEYS["senior-associate"].carry,
      new URL("../../../asset-source/supermarket_staff_growth_phase1/senior_associate_carry-medium.png", import.meta.url).href,
      "carry-medium"
    ),
    character(
      STAFF_GROWTH_ASSET_KEYS["senior-associate"].place,
      new URL("../../../asset-source/supermarket_staff_growth_phase1/senior_associate_place-low.png", import.meta.url).href,
      "place-low"
    ),
    character(
      STAFF_GROWTH_ASSET_KEYS["senior-associate"].push,
      new URL("../../../asset-source/supermarket_staff_growth_phase1/senior_associate_push-cart.png", import.meta.url).href,
      "push-cart"
    ),
    character(
      STAFF_GROWTH_ASSET_KEYS["shift-leader"].idle,
      new URL("../../../asset-source/supermarket_staff_growth_phase2_shift_leader/shift_leader_idle.png", import.meta.url).href,
      "idle"
    ),
    character(
      STAFF_GROWTH_ASSET_KEYS["shift-leader"].carry,
      new URL("../../../asset-source/supermarket_staff_growth_phase2_shift_leader/shift_leader_carry-medium.png", import.meta.url).href,
      "carry-medium"
    ),
    character(
      STAFF_GROWTH_ASSET_KEYS["shift-leader"].place,
      new URL("../../../asset-source/supermarket_staff_growth_phase2_shift_leader/shift_leader_place-low.png", import.meta.url).href,
      "place-low"
    ),
    character(
      STAFF_GROWTH_ASSET_KEYS["shift-leader"].push,
      new URL("../../../asset-source/supermarket_staff_growth_phase2_shift_leader/shift_leader_push-cart.png", import.meta.url).href,
      "push-cart"
    )
  ])
});
