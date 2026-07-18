export type AssetStatus = "production" | "temporary";

export type AssetDefinition = Readonly<{
  key: string;
  path: string;
  role: string;
  expectedSize: readonly [number, number];
  status: AssetStatus;
}>;

export const V2_ASSETS = {
  environment: {
    salesFloor: {
      key: "v2-environment-sales-floor",
      path: "assets/day01/backgrounds/salesfloor_bg.png",
      role: "Temporary floor texture while the new immersive supermarket environment is produced",
      expectedSize: [1536, 1024],
      status: "temporary"
    }
  },
  characters: {
    workerPush: {
      key: "v2-worker-push",
      path: "assets/day01/characters/worker_push_cart.png",
      role: "Third-person restock employee pushing the cart",
      expectedSize: [360, 520],
      status: "temporary"
    },
    workerCarry: {
      key: "v2-worker-carry",
      path: "assets/day01/characters/worker_carry_box.png",
      role: "Employee carrying a beverage case",
      expectedSize: [320, 520],
      status: "temporary"
    }
  },
  props: {
    cart: {
      key: "v2-restock-cart",
      path: "assets/day01/props/cart_empty.png",
      role: "Restock cart",
      expectedSize: [420, 420],
      status: "temporary"
    },
    cartLoaded: {
      key: "v2-restock-cart-loaded",
      path: "assets/day01/props/cart_loading.png",
      role: "Restock cart carrying a beverage case",
      expectedSize: [420, 420],
      status: "temporary"
    },
    colaCase: {
      key: "v2-cola-case",
      path: "assets/day01/props/box_cola.png",
      role: "Cardboard cola case used by the Day 1 task",
      expectedSize: [260, 200],
      status: "temporary"
    },
    colaBottle: {
      key: "v2-cola-bottle",
      path: "assets/day01/products/product_cola.png",
      role: "Bottle repeated across the cooler rows",
      expectedSize: [96, 180],
      status: "temporary"
    }
  }
} as const satisfies Record<string, Record<string, AssetDefinition>>;

export const V2_ASSET_LIST: readonly AssetDefinition[] = Object.values(V2_ASSETS)
  .flatMap((group) => Object.values(group));
