export type RuntimeAssetStatus = "production" | "prototype";

export type RuntimeAssetDefinition = Readonly<{
  key: string;
  path: string;
  role: string;
  expectedSize: readonly [number, number];
  status: RuntimeAssetStatus;
}>;

/**
 * Assets retained from the existing project after the asset audit.
 *
 * They follow the project-wide assets/game ownership model. Prototype entries
 * are usable during migration but remain scheduled for production replacement.
 */
export const RETAINED_RUNTIME_ASSETS = {
  environment: {
    salesFloor: {
      key: "v2-environment-sales-floor",
      path: "assets/game/environments/stores/starter-market/salesfloor-prototype.png",
      role: "Prototype floor plate retained while the production supermarket environment is created",
      expectedSize: [1448, 1086],
      status: "prototype"
    }
  },
  fixtures: {
    beverageCooler: {
      key: "v2-fixture-beverage-cooler",
      path: "assets/game/fixtures/coolers/beverage-cooler-a/base.png",
      role: "Reusable empty beverage cooler prototype with independent product-row support",
      expectedSize: [1088, 1143],
      status: "prototype"
    }
  },
  characters: {
    workerPush: {
      key: "v2-worker-push",
      path: "assets/game/characters/workers/worker-a/push-cart.png",
      role: "Prototype employee pushing the reusable restock cart",
      expectedSize: [512, 768],
      status: "prototype"
    },
    workerCarry: {
      key: "v2-worker-carry",
      path: "assets/game/characters/workers/worker-a/carry-medium.png",
      role: "Prototype employee carrying a medium product case",
      expectedSize: [512, 768],
      status: "prototype"
    }
  },
  products: {
    colaBottle: {
      key: "v2-product-cola-bottle",
      path: "assets/game/products/beverages/cola-bottle.png",
      role: "Reusable cola product prototype",
      expectedSize: [512, 768],
      status: "prototype"
    },
    milkBottle: {
      key: "v2-product-milk-bottle",
      path: "assets/game/products/beverages/milk-bottle.png",
      role: "Reusable milk product prototype",
      expectedSize: [512, 768],
      status: "prototype"
    },
    waterBottle: {
      key: "v2-product-water-bottle",
      path: "assets/game/products/beverages/water-bottle.png",
      role: "Reusable water product prototype",
      expectedSize: [512, 768],
      status: "prototype"
    }
  },
  props: {
    cart: {
      key: "v2-restock-cart",
      path: "assets/game/equipment/restock-carts/cart-a-empty.png",
      role: "Reusable empty restock cart prototype",
      expectedSize: [768, 512],
      status: "prototype"
    },
    cartLoaded: {
      key: "v2-restock-cart-loaded",
      path: "assets/game/equipment/restock-carts/cart-a-loaded.png",
      role: "Reusable loaded restock cart prototype",
      expectedSize: [768, 512],
      status: "prototype"
    },
    colaCase: {
      key: "v2-cola-case",
      path: "assets/game/props/cases/cola-case-closed.png",
      role: "Reusable closed beverage case prototype",
      expectedSize: [512, 512],
      status: "prototype"
    }
  }
} as const satisfies Record<string, Record<string, RuntimeAssetDefinition>>;

export const RETAINED_RUNTIME_ASSET_LIST: readonly RuntimeAssetDefinition[] = Object.values(
  RETAINED_RUNTIME_ASSETS
).flatMap((group) => Object.values(group));
