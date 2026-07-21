import type { AssetCatalogue, AssetDescriptor } from "./AssetDescriptor";
import { PRODUCTION_V1_ASSETS } from "./ProductionV1AssetPaths";

const asset = (descriptor: AssetDescriptor): AssetDescriptor => descriptor;

const productionCharacter = (
  key: string,
  path: string,
  state: string,
  preloadGroup = "starter-market"
): AssetDescriptor => asset({
  key,
  path,
  category: "character",
  canvasSize: [768, 768],
  anchor: [0.5, 0.96],
  defaultScale: 0.42,
  depthGroup: "actors",
  preloadGroup,
  perspective: "fixed-third-person",
  lightDirection: "upper-left",
  state,
  status: "production"
});

const productionEquipment = (
  key: string,
  path: string,
  state: string
): AssetDescriptor => asset({
  key,
  path,
  category: "equipment",
  canvasSize: [768, 768],
  anchor: [0.5, 0.96],
  defaultScale: 0.44,
  depthGroup: "props",
  preloadGroup: "starter-market",
  perspective: "fixed-third-person",
  lightDirection: "upper-left",
  state,
  status: "production"
});

const productionFixture = (
  key: string,
  path: string,
  state: string
): AssetDescriptor => asset({
  key,
  path,
  category: "fixture",
  canvasSize: [1024, 1024],
  anchor: [0.5, 0.96],
  defaultScale: 1,
  depthGroup: "fixtures",
  preloadGroup: "starter-market",
  perspective: "fixed-third-person",
  lightDirection: "upper-left",
  state,
  status: "production"
});

const productionProduct = (
  key: string,
  path: string,
  state = "single-unit"
): AssetDescriptor => asset({
  key,
  path,
  category: "product",
  canvasSize: [512, 768],
  anchor: [0.5, 0.96],
  defaultScale: 0.18,
  depthGroup: "fixture-contents",
  preloadGroup: "starter-market",
  perspective: "fixed-third-person",
  lightDirection: "upper-left",
  state,
  status: "production"
});

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

    productionFixture(
      "fixture-beverage-cooler-a",
      PRODUCTION_V1_ASSETS.fixture_beverage_cooler,
      "base"
    ),
    productionFixture(
      "fixture-produce-display-a",
      PRODUCTION_V1_ASSETS.fixture_produce_display,
      "stocked"
    ),
    productionFixture(
      "fixture-backroom-rack-a",
      PRODUCTION_V1_ASSETS.fixture_backroom_shelf,
      "stocked"
    ),
    productionFixture(
      "fixture-checkout-a",
      PRODUCTION_V1_ASSETS.fixture_checkout_counter,
      "ready"
    ),
    productionFixture(
      "fixture-dairy-breakfast-a",
      PRODUCTION_V1_ASSETS.fixture_dairy_breakfast_shelf,
      "stocked"
    ),
    productionFixture(
      "fixture-cleaning-supplies-a",
      PRODUCTION_V1_ASSETS.fixture_cleaning_supplies_shelf,
      "stocked"
    ),
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

    productionCharacter("worker-a-idle", PRODUCTION_V1_ASSETS.worker_idle, "idle"),
    productionCharacter("worker-a-walk-01", PRODUCTION_V1_ASSETS.worker_walk_01, "walk-01"),
    productionCharacter("worker-a-walk-02", PRODUCTION_V1_ASSETS.worker_walk_02, "walk-02"),
    productionCharacter("worker-a-carry-medium", PRODUCTION_V1_ASSETS.worker_carry_box, "carry-medium"),
    productionCharacter("worker-a-push-cart", PRODUCTION_V1_ASSETS.worker_push_cart, "push-cart"),
    productionCharacter("worker-a-open-case", PRODUCTION_V1_ASSETS.worker_open_box, "open-case"),
    productionCharacter("worker-a-place-low", PRODUCTION_V1_ASSETS.worker_stock_shelf, "place-low"),
    productionCharacter("worker-a-place-middle", PRODUCTION_V1_ASSETS.worker_stock_shelf, "place-middle"),
    productionCharacter("worker-a-place-high", PRODUCTION_V1_ASSETS.worker_stock_shelf, "place-high"),
    productionCharacter("worker-a-scan-register", PRODUCTION_V1_ASSETS.worker_scan_register, "scan-register"),
    productionCharacter("worker-a-mop-floor", PRODUCTION_V1_ASSETS.worker_mop_floor, "mop-floor"),
    productionCharacter("worker-a-thinking", PRODUCTION_V1_ASSETS.worker_thinking, "thinking"),

    productionCharacter(
      "customer-a-idle",
      PRODUCTION_V1_ASSETS.customer_young_woman_idle,
      "idle",
      "starter-market-customers"
    ),
    productionCharacter(
      "customer-a-carry-basket",
      PRODUCTION_V1_ASSETS.customer_young_woman_basket,
      "carry-basket",
      "starter-market-customers"
    ),
    productionCharacter(
      "customer-b-idle",
      PRODUCTION_V1_ASSETS.customer_young_man_idle,
      "idle",
      "starter-market-customers"
    ),
    productionCharacter(
      "customer-b-carry-basket",
      PRODUCTION_V1_ASSETS.customer_young_man_basket,
      "carry-basket",
      "starter-market-customers"
    ),
    productionCharacter(
      "customer-c-idle",
      PRODUCTION_V1_ASSETS.customer_elderly_cart_idle,
      "idle",
      "starter-market-customers"
    ),
    productionCharacter(
      "customer-d-checkout",
      PRODUCTION_V1_ASSETS.customer_man_checkout,
      "checkout",
      "starter-market-customers"
    ),

    productionEquipment(
      "equipment-restock-cart-a-empty",
      PRODUCTION_V1_ASSETS.equipment_restock_cart_empty,
      "empty"
    ),
    ...(["loaded", "ready", "full"] as const).map((state) => productionEquipment(
      `equipment-restock-cart-a-${state}`,
      PRODUCTION_V1_ASSETS.equipment_restock_cart_loaded,
      state
    )),
    productionEquipment("equipment-checkout-scanner", PRODUCTION_V1_ASSETS.equipment_barcode_scanner, "ready"),
    productionEquipment("equipment-pos-terminal", PRODUCTION_V1_ASSETS.equipment_pos_terminal, "ready"),
    productionEquipment("equipment-shopping-basket", PRODUCTION_V1_ASSETS.equipment_shopping_basket, "empty"),
    productionEquipment("equipment-shopping-cart", PRODUCTION_V1_ASSETS.equipment_shopping_cart, "empty"),
    productionEquipment("equipment-mop", PRODUCTION_V1_ASSETS.equipment_mop, "ready"),
    productionEquipment("equipment-cleaning-cart", PRODUCTION_V1_ASSETS.equipment_cleaning_cart, "ready"),
    productionEquipment("equipment-wet-floor-sign", PRODUCTION_V1_ASSETS.equipment_wet_floor_sign, "active"),

    asset({
      key: "prop-cola-case-closed",
      path: PRODUCTION_V1_ASSETS.prop_cola_case_pallet,
      category: "prop",
      canvasSize: [768, 768],
      anchor: [0.5, 0.96],
      defaultScale: 0.42,
      depthGroup: "props",
      preloadGroup: "starter-market",
      perspective: "fixed-third-person",
      lightDirection: "upper-left",
      state: "closed",
      status: "production"
    }),
    asset({
      key: "prop-cola-case-open",
      path: PRODUCTION_V1_ASSETS.prop_cola_case_open,
      category: "prop",
      canvasSize: [768, 768],
      anchor: [0.5, 0.96],
      defaultScale: 0.42,
      depthGroup: "props",
      preloadGroup: "starter-market",
      perspective: "fixed-third-person",
      lightDirection: "upper-left",
      state: "open",
      status: "production"
    }),
    ...(["milk", "water"] as const).map((product): AssetDescriptor => ({
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

    productionProduct("product-cola-bottle", PRODUCTION_V1_ASSETS.product_cola_bottle),
    productionProduct("product-water-bottle", PRODUCTION_V1_ASSETS.product_water_bottle),
    productionProduct("product-milk-bottle", PRODUCTION_V1_ASSETS.product_milk_jug),
    productionProduct("product-apple", PRODUCTION_V1_ASSETS.product_apple),
    productionProduct("product-cereal-box", PRODUCTION_V1_ASSETS.product_cereal_box),
    productionProduct("product-oats-canister", PRODUCTION_V1_ASSETS.product_oats_canister),
    productionProduct("product-yogurt-cup", PRODUCTION_V1_ASSETS.product_yogurt_cup),
    productionProduct("product-chips-bag", PRODUCTION_V1_ASSETS.product_chips_bag),
    productionProduct("product-detergent-bottle", PRODUCTION_V1_ASSETS.product_detergent_bottle),
    productionProduct("product-paper-towels", PRODUCTION_V1_ASSETS.product_paper_towels),

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
