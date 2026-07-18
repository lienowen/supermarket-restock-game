import type { AssetCatalogue, AssetDescriptor } from "./AssetDescriptor";

const asset = (descriptor: AssetDescriptor): AssetDescriptor => descriptor;

export const STARTER_ASSET_CATALOGUE: AssetCatalogue = {
  assets: [
    asset({
      key: "environment-starter-market-salesfloor-prototype",
      path: "assets/game/environments/stores/starter-market/salesfloor-prototype.png",
      category: "environment",
      canvasSize: [1448, 1086],
      anchor: [0, 0],
      defaultScale: 1,
      depthGroup: "far-environment",
      preloadGroup: "starter-market",
      perspective: "fixed-third-person",
      lightDirection: "upper-left",
      state: "salesfloor-prototype",
      status: "prototype"
    }),
    asset({
      key: "environment-starter-market-backroom-prototype",
      path: "assets/game/environments/stores/starter-market/backroom-prototype.png",
      category: "environment",
      canvasSize: [1448, 1086],
      anchor: [0, 0],
      defaultScale: 1,
      depthGroup: "far-environment",
      preloadGroup: "starter-market",
      perspective: "fixed-third-person",
      lightDirection: "upper-left",
      state: "backroom-prototype",
      status: "prototype"
    }),
    asset({
      key: "fixture-beverage-cooler-a",
      path: "assets/game/fixtures/coolers/beverage-cooler-a/base.png",
      category: "fixture",
      canvasSize: [1088, 1143],
      anchor: [0.5, 0.92],
      defaultScale: 0.58,
      depthGroup: "fixtures",
      preloadGroup: "starter-market",
      perspective: "fixed-third-person",
      lightDirection: "upper-left",
      state: "base",
      status: "prototype"
    }),
    ...Array.from({ length: 6 }, (_, index): AssetDescriptor => ({
      key: `fixture-beverage-cooler-a-row-${String(index + 1).padStart(2, "0")}`,
      path: `assets/game/fixtures/coolers/beverage-cooler-a/row-${String(index + 1).padStart(2, "0")}.png`,
      category: "product",
      canvasSize: [520, 90],
      anchor: [0.5, 0.5],
      defaultScale: 1,
      depthGroup: "fixture-contents",
      preloadGroup: "starter-market",
      perspective: "fixed-third-person",
      lightDirection: "upper-left",
      state: `stock-row-${index + 1}`,
      status: "concept"
    })),

    asset({
      key: "worker-a-idle",
      path: "assets/game/characters/workers/worker-a/idle.png",
      category: "character",
      canvasSize: [512, 768],
      anchor: [0.5, 0.94],
      defaultScale: 0.42,
      depthGroup: "actors",
      preloadGroup: "starter-market",
      perspective: "fixed-third-person",
      lightDirection: "upper-left",
      state: "idle",
      status: "prototype"
    }),
    asset({
      key: "worker-a-carry-medium",
      path: "assets/game/characters/workers/worker-a/carry-medium.png",
      category: "character",
      canvasSize: [512, 768],
      anchor: [0.5, 0.94],
      defaultScale: 0.42,
      depthGroup: "actors",
      preloadGroup: "starter-market",
      perspective: "fixed-third-person",
      lightDirection: "upper-left",
      state: "carry-medium",
      status: "prototype"
    }),
    asset({
      key: "worker-a-push-cart",
      path: "assets/game/characters/workers/worker-a/push-cart.png",
      category: "character",
      canvasSize: [512, 768],
      anchor: [0.5, 0.94],
      defaultScale: 0.42,
      depthGroup: "actors",
      preloadGroup: "starter-market",
      perspective: "fixed-third-person",
      lightDirection: "upper-left",
      state: "push-cart",
      status: "prototype"
    }),
    asset({
      key: "worker-a-open-case",
      path: "assets/game/characters/workers/worker-a/open-case.png",
      category: "character",
      canvasSize: [760, 1040],
      anchor: [0.5, 0.94],
      defaultScale: 0.42,
      depthGroup: "actors",
      preloadGroup: "starter-market",
      perspective: "fixed-third-person",
      lightDirection: "upper-left",
      state: "open-case",
      status: "concept"
    }),
    asset({
      key: "worker-a-place-low",
      path: "assets/game/characters/workers/worker-a/place-low.png",
      category: "character",
      canvasSize: [512, 768],
      anchor: [0.5, 0.94],
      defaultScale: 0.42,
      depthGroup: "actors",
      preloadGroup: "starter-market",
      perspective: "fixed-third-person",
      lightDirection: "upper-left",
      state: "place-low",
      status: "prototype"
    }),
    ...(["place-middle", "place-high"] as const).map((state): AssetDescriptor => ({
      key: `worker-a-${state}`,
      path: `assets/game/characters/workers/worker-a/${state}.png`,
      category: "character",
      canvasSize: [760, 1040],
      anchor: [0.5, 0.94],
      defaultScale: 0.42,
      depthGroup: "actors",
      preloadGroup: "starter-market",
      perspective: "fixed-third-person",
      lightDirection: "upper-left",
      state,
      status: "concept"
    })),

    ...(["empty", "loaded", "ready", "full"] as const).map((state): AssetDescriptor => ({
      key: `equipment-restock-cart-a-${state}`,
      path: `assets/game/equipment/restock-carts/cart-a-${state}.png`,
      category: "equipment",
      canvasSize: [768, 512],
      anchor: [0.5, 0.91],
      defaultScale: 0.44,
      depthGroup: "props",
      preloadGroup: "starter-market",
      perspective: "fixed-third-person",
      lightDirection: "upper-left",
      state,
      status: "prototype"
    })),

    ...(["cola", "milk", "water"] as const).map((product): AssetDescriptor => ({
      key: `prop-${product}-case-closed`,
      path: `assets/game/props/cases/${product}-case-closed.png`,
      category: "prop",
      canvasSize: [512, 512],
      anchor: [0.5, 0.86],
      defaultScale: 0.42,
      depthGroup: "props",
      preloadGroup: "starter-market",
      perspective: "fixed-third-person",
      lightDirection: "upper-left",
      state: "closed",
      status: "prototype"
    })),
    ...(["cola", "milk", "water"] as const).map((product): AssetDescriptor => ({
      key: `product-${product}-bottle`,
      path: `assets/game/products/beverages/${product}-bottle.png`,
      category: "product",
      canvasSize: [512, 768],
      anchor: [0.5, 0.96],
      defaultScale: 0.18,
      depthGroup: "fixture-contents",
      preloadGroup: "starter-market",
      perspective: "fixed-third-person",
      lightDirection: "upper-left",
      state: "single-unit",
      status: "prototype"
    })),

    ...(["customer-a", "customer-b"] as const).flatMap((customer): AssetDescriptor[] => [
      {
        key: `${customer}-idle`,
        path: `assets/game/characters/customers/${customer}/idle.png`,
        category: "character",
        canvasSize: [512, 768],
        anchor: [0.5, 0.95],
        defaultScale: 0.4,
        depthGroup: "actors",
        preloadGroup: "starter-market-customers",
        perspective: "fixed-third-person",
        lightDirection: "upper-left",
        state: "idle",
        status: "prototype"
      },
      {
        key: `${customer}-carry-basket`,
        path: `assets/game/characters/customers/${customer}/carry-basket.png`,
        category: "character",
        canvasSize: [512, 768],
        anchor: [0.5, 0.95],
        defaultScale: 0.4,
        depthGroup: "actors",
        preloadGroup: "starter-market-customers",
        perspective: "fixed-third-person",
        lightDirection: "upper-left",
        state: "carry-basket",
        status: "prototype"
      }
    ]),

    asset({
      key: "effect-active-target-arrow",
      path: "assets/game/effects/arrows/active-target.svg",
      category: "effect",
      canvasSize: [128, 160],
      anchor: [0.5, 1],
      defaultScale: 1,
      depthGroup: "world-effects",
      preloadGroup: "core-ui",
      perspective: "screen-space",
      state: "active",
      status: "concept"
    }),
    asset({
      key: "ui-hud-task-panel",
      path: "assets/game/ui/panels/task-panel.svg",
      category: "ui",
      canvasSize: [440, 170],
      anchor: [1, 0],
      defaultScale: 1,
      depthGroup: "ui",
      preloadGroup: "core-ui",
      perspective: "screen-space",
      state: "default",
      status: "concept"
    })
  ]
};
