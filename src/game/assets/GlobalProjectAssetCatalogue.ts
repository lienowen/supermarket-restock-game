import type { AssetCatalogue, AssetDescriptor } from "./AssetDescriptor";

const asset = (descriptor: AssetDescriptor): AssetDescriptor => descriptor;

const worldAsset = (
  key: string,
  path: string,
  category: AssetDescriptor["category"],
  canvasSize: readonly [number, number],
  depthGroup: AssetDescriptor["depthGroup"],
  state: string,
  anchor: readonly [number, number] = [0.5, 0.5]
): AssetDescriptor => asset({
  key,
  path,
  category,
  canvasSize,
  anchor,
  defaultScale: 1,
  depthGroup,
  preloadGroup: "starter-market",
  perspective: "fixed-third-person",
  lightDirection: "upper-left",
  state,
  status: "production"
});

const screenAsset = (
  key: string,
  path: string,
  canvasSize: readonly [number, number],
  state: string
): AssetDescriptor => asset({
  key,
  path,
  category: "ui",
  canvasSize,
  anchor: [0.5, 0.5],
  defaultScale: 1,
  depthGroup: "ui",
  preloadGroup: "starter-market",
  perspective: "screen-space",
  lightDirection: "neutral",
  state,
  status: "production"
});

export const GLOBAL_PROJECT_ASSET_CATALOGUE: AssetCatalogue = Object.freeze({
  assets: Object.freeze([
    worldAsset(
      "fixture-beverage-cooler-empty",
      "assets/game/production-v1/fixtures/fixture-beverage-cooler-empty.webp",
      "fixture",
      [220, 409],
      "fixtures",
      "empty"
    ),
    worldAsset(
      "fixture-checkout-scale",
      "assets/game/production-v1/fixtures/fixture-checkout-scale.webp",
      "equipment",
      [180, 140],
      "props",
      "ready",
      [0.5, 0.92]
    ),
    worldAsset(
      "fixture-beverage-cooler-glass-overlay",
      "assets/game/production-v1/overlays/cooler/fixture-beverage-cooler-glass-overlay.webp",
      "effect",
      [220, 409],
      "world-effects",
      "glass-overlay"
    ),
    worldAsset(
      "fixture-beverage-cooler-night-tint",
      "assets/game/production-v1/overlays/cooler/fixture-beverage-cooler-night-tint.webp",
      "effect",
      [220, 409],
      "world-effects",
      "night-tint"
    ),
    worldAsset(
      "overlay-closing-light-mask",
      "assets/game/production-v1/overlays/lighting/overlay-closing-light-mask.webp",
      "effect",
      [1280, 720],
      "world-effects",
      "closing-light"
    ),
    ...([
      ["spill-small", "small"],
      ["spill-medium", "medium"],
      ["spill-large", "large"],
      ["spill-danger", "danger"],
      ["spill-wet-sheen", "wet-sheen"]
    ] as const).map(([key, state]) => worldAsset(
      key,
      `assets/game/production-v1/effects/spills/${key}.webp`,
      "effect",
      [128, 128],
      "world-effects",
      state
    )),
    ...([
      ["prop-promo-tag-red", "red"],
      ["prop-promo-tag-yellow", "yellow"]
    ] as const).map(([key, state]) => worldAsset(
      key,
      `assets/game/production-v1/props/promotions/${key}.webp`,
      "prop",
      [96, 64],
      "props",
      state
    )),
    worldAsset(
      "prop-warning-sign-highlight",
      "assets/game/production-v1/props/cleaning/prop-warning-sign-highlight.webp",
      "prop",
      [96, 160],
      "props",
      "highlighted",
      [0.5, 0.92]
    ),
    worldAsset(
      "worker-carry-basket",
      "assets/game/production-v1/characters/worker/employee-carry-basket.webp",
      "character",
      [256, 384],
      "actors",
      "carry-basket",
      [0.5, 0.96]
    ),
    screenAsset(
      "ui-produce-weight-ticket",
      "assets/game/production-v1/ui/checkout/ui-produce-weight-ticket.webp",
      [220, 120],
      "weight-ticket"
    ),
    screenAsset(
      "ui-order-ticket-online",
      "assets/game/production-v1/ui/orders/ui-order-ticket-online.webp",
      [260, 180],
      "online-order"
    ),
    ...(["neutral", "impatient", "angry"] as const).map((state) => screenAsset(
      `ui-customer-mood-${state}`,
      `assets/game/production-v1/ui/customer-moods/ui-customer-mood-${state}.webp`,
      [64, 64],
      state
    )),
    screenAsset(
      "ui-final-shift-complete-stamp",
      "assets/game/production-v1/ui/feedback/ui-final-shift-complete-stamp.webp",
      [140, 140],
      "final-shift-complete"
    )
  ])
});
