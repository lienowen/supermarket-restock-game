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

const staffAssetPath = (fileName: string): string => `assets/game/staff-growth/${fileName}`;

export const STAFF_GROWTH_ASSET_CATALOGUE: AssetCatalogue = Object.freeze({
  assets: Object.freeze([
    character(STAFF_GROWTH_ASSET_KEYS["store-associate"].idle, staffAssetPath("store_associate_idle.png"), "idle"),
    character(STAFF_GROWTH_ASSET_KEYS["store-associate"].carry, staffAssetPath("store_associate_carry-medium.png"), "carry-medium"),
    character(STAFF_GROWTH_ASSET_KEYS["store-associate"].place, staffAssetPath("store_associate_place-low.png"), "place-low"),
    character(STAFF_GROWTH_ASSET_KEYS["store-associate"].push, staffAssetPath("store_associate_push-cart.png"), "push-cart"),
    character(STAFF_GROWTH_ASSET_KEYS["senior-associate"].idle, staffAssetPath("senior_associate_idle.png"), "idle"),
    character(STAFF_GROWTH_ASSET_KEYS["senior-associate"].carry, staffAssetPath("senior_associate_carry-medium.png"), "carry-medium"),
    character(STAFF_GROWTH_ASSET_KEYS["senior-associate"].place, staffAssetPath("senior_associate_place-low.png"), "place-low"),
    character(STAFF_GROWTH_ASSET_KEYS["senior-associate"].push, staffAssetPath("senior_associate_push-cart.png"), "push-cart"),
    character(STAFF_GROWTH_ASSET_KEYS["shift-leader"].idle, staffAssetPath("shift_leader_idle.png"), "idle"),
    character(STAFF_GROWTH_ASSET_KEYS["shift-leader"].carry, staffAssetPath("shift_leader_carry-medium.png"), "carry-medium"),
    character(STAFF_GROWTH_ASSET_KEYS["shift-leader"].place, staffAssetPath("shift_leader_place-low.png"), "place-low"),
    character(STAFF_GROWTH_ASSET_KEYS["shift-leader"].push, staffAssetPath("shift_leader_push-cart.png"), "push-cart")
  ])
});
