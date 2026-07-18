export type AssetStatus = "production" | "prototype";

export type AssetDefinition = Readonly<{
  key: string;
  path: string;
  role: string;
  expectedSize: readonly [number, number];
  status: AssetStatus;
}>;

/**
 * Temporary compatibility manifest for the existing Phaser scene.
 *
 * Every retained image now lives under assets/game and follows the project-wide
 * asset architecture. These files remain prototypes until the approved
 * back-facing, fixed-camera visual set replaces them.
 */
export const V2_ASSETS = {
  environment: {
    salesFloor: {
      key: "v2-environment-sales-floor",
      path: "assets/game/environments/stores/starter-market/salesfloor-prototype.png",
      role: "Prototype floor plate retained while the production supermarket environment is created",
      expectedSize: [1448, 1086],
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
    },
    colaBottle: {
      key: "v2-cola-bottle",
      path: "assets/game/products/beverages/cola-bottle.png",
      role: "Reusable beverage product prototype",
      expectedSize: [512, 768],
      status: "prototype"
    }
  }
} as const satisfies Record<string, Record<string, AssetDefinition>>;

export const V2_ASSET_LIST: readonly AssetDefinition[] = Object.values(V2_ASSETS)
  .flatMap((group) => Object.values(group));
