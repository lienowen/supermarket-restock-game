export type ProductionAssetDecision =
  | "retain-prototype"
  | "refine-existing"
  | "replace-with-production"
  | "create-production";

export type ProductionPriority = "P0" | "P1" | "P2";

export interface ProductionAssetPlanEntry {
  readonly slot: string;
  readonly category: "environment" | "fixture" | "character" | "equipment" | "product" | "prop" | "ui";
  readonly currentAssetKey?: string;
  readonly targetPath: string;
  readonly decision: ProductionAssetDecision;
  readonly priority: ProductionPriority;
  readonly acceptance: readonly string[];
}

export const STARTER_MARKET_PRODUCTION_ASSET_PLAN: readonly ProductionAssetPlanEntry[] = Object.freeze([
  {
    slot: "starter-market-environment-base",
    category: "environment",
    currentAssetKey: "environment-starter-market-salesfloor-prototype",
    targetPath: "assets/game/environments/stores/starter-market/base.webp",
    decision: "replace-with-production",
    priority: "P0",
    acceptance: [
      "Fixed third-person supermarket perspective",
      "Produce left, backroom centre, beverage cooler right",
      "No worker, cart, HUD, arrows, or baked mission text",
      "Warm store light and subtle floor reflection"
    ]
  },
  {
    slot: "produce-display-a",
    category: "fixture",
    targetPath: "assets/game/fixtures/produce-displays/produce-display-a.webp",
    decision: "create-production",
    priority: "P0",
    acceptance: [
      "Dense realistic produce merchandise",
      "Matches the locked camera and upper-left light direction",
      "Transparent background with grounded contact shadow"
    ]
  },
  {
    slot: "backroom-rack-a",
    category: "fixture",
    targetPath: "assets/game/fixtures/backroom-racks/backroom-rack-a.webp",
    decision: "create-production",
    priority: "P0",
    acceptance: [
      "Deep staff entrance and believable storage depth",
      "Metal shelving with varied cardboard cases",
      "No baked Staff Only sign"
    ]
  },
  {
    slot: "worker-a-push-cart",
    category: "character",
    currentAssetKey: "worker-a-push-cart",
    targetPath: "assets/game/characters/workers/worker-a/push-cart.webp",
    decision: "replace-with-production",
    priority: "P0",
    acceptance: [
      "Back or back-three-quarter gameplay view",
      "Same employee design as every other worker action",
      "Correct floor contact and upper-left lighting",
      "Cart relationship matches the foreground composition"
    ]
  },
  {
    slot: "worker-a-carry-medium",
    category: "character",
    currentAssetKey: "worker-a-carry-medium",
    targetPath: "assets/game/characters/workers/worker-a/carry-medium.webp",
    decision: "replace-with-production",
    priority: "P0",
    acceptance: [
      "Same employee, scale, uniform, and perspective as push-cart",
      "Medium beverage case held naturally",
      "Transparent background and consistent foot anchor"
    ]
  },
  {
    slot: "worker-a-open-case",
    category: "character",
    targetPath: "assets/game/characters/workers/worker-a/open-case.webp",
    decision: "create-production",
    priority: "P0",
    acceptance: [
      "Same employee and camera direction",
      "Readable open-case action beside the restock cart"
    ]
  },
  ...(["place-low", "place-middle", "place-high"] as const).map((action): ProductionAssetPlanEntry => ({
    slot: `worker-a-${action}`,
    category: "character",
    targetPath: `assets/game/characters/workers/worker-a/${action}.webp`,
    decision: "create-production",
    priority: "P0",
    acceptance: [
      "Same employee and perspective as the common worker set",
      `Readable ${action} shelf placement pose`,
      "Consistent body scale and floor anchor"
    ]
  })),
  {
    slot: "beverage-cooler-a-base",
    category: "fixture",
    currentAssetKey: "fixture-beverage-cooler-a",
    targetPath: "assets/game/fixtures/coolers/beverage-cooler-a/base.webp",
    decision: "refine-existing",
    priority: "P1",
    acceptance: [
      "Recedes naturally along the right-side store perspective",
      "Cool internal lighting and grounded wall contact",
      "No products or department sign baked into the base"
    ]
  },
  {
    slot: "restock-cart-a-empty",
    category: "equipment",
    currentAssetKey: "equipment-restock-cart-a-empty",
    targetPath: "assets/game/equipment/restock-carts/cart-a-empty.png",
    decision: "refine-existing",
    priority: "P1",
    acceptance: [
      "Same perspective as worker push pose",
      "Clean transparent margins and stable bottom anchor"
    ]
  },
  {
    slot: "restock-cart-a-loaded",
    category: "equipment",
    currentAssetKey: "equipment-restock-cart-a-loaded",
    targetPath: "assets/game/equipment/restock-carts/cart-a-loaded.png",
    decision: "refine-existing",
    priority: "P1",
    acceptance: [
      "Matches empty cart geometry exactly",
      "Beverage case rests naturally on the cart"
    ]
  },
  {
    slot: "cola-case-closed",
    category: "prop",
    currentAssetKey: "prop-cola-case-closed",
    targetPath: "assets/game/props/cases/cola-case-closed.png",
    decision: "retain-prototype",
    priority: "P1",
    acceptance: [
      "Unbranded packaging",
      "Consistent perspective across stored, carried, and cart states"
    ]
  },
  {
    slot: "cola-case-open",
    category: "prop",
    targetPath: "assets/game/props/cases/cola-case-open.png",
    decision: "create-production",
    priority: "P1",
    acceptance: [
      "Matches the closed case dimensions and perspective",
      "Readable open flaps and visible product contents"
    ]
  },
  ...(["cola", "milk", "water"] as const).map((product): ProductionAssetPlanEntry => ({
    slot: `${product}-beverage-product`,
    category: "product",
    currentAssetKey: `product-${product}-bottle`,
    targetPath: `assets/game/products/beverages/${product}-bottle.png`,
    decision: "retain-prototype",
    priority: "P2",
    acceptance: [
      "Unbranded packaging",
      "Consistent bottle scale and shelf baseline",
      "Readable at cooler-row gameplay size"
    ]
  })),
  {
    slot: "shift-hud",
    category: "ui",
    targetPath: "assets/game/ui/panels/shift-hud.svg",
    decision: "create-production",
    priority: "P2",
    acceptance: [
      "English-only",
      "Does not cover department signs or active fixture",
      "Matches the minimal dark-green and gold visual language"
    ]
  }
]);

export function validateProductionAssetPlan(): readonly string[] {
  const errors: string[] = [];
  const slots = new Set<string>();

  for (const entry of STARTER_MARKET_PRODUCTION_ASSET_PLAN) {
    if (slots.has(entry.slot)) errors.push(`Duplicate production asset slot: ${entry.slot}`);
    slots.add(entry.slot);

    if (!entry.targetPath.startsWith("assets/game/")) {
      errors.push(`Production target must use assets/game/: ${entry.slot}`);
    }

    if (entry.slot.toLowerCase().includes("day")) {
      errors.push(`Production asset slot must not be day-owned: ${entry.slot}`);
    }

    if (entry.acceptance.length === 0) {
      errors.push(`Production asset slot requires acceptance criteria: ${entry.slot}`);
    }
  }

  const p0Slots = STARTER_MARKET_PRODUCTION_ASSET_PLAN
    .filter((entry) => entry.priority === "P0")
    .map((entry) => entry.slot);

  [
    "starter-market-environment-base",
    "produce-display-a",
    "backroom-rack-a",
    "worker-a-push-cart",
    "worker-a-carry-medium",
    "worker-a-open-case",
    "worker-a-place-low",
    "worker-a-place-middle",
    "worker-a-place-high"
  ].forEach((slot) => {
    if (!p0Slots.includes(slot)) errors.push(`Missing P0 production slot: ${slot}`);
  });

  return Object.freeze(errors);
}
