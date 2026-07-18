import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync
} from "node:fs";
import { dirname, resolve } from "node:path";
import { createHash } from "node:crypto";

const root = resolve(process.cwd(), "public");

const retainedMoves = [
  ["assets/day01/backgrounds/salesfloor_bg.png", "assets/game/environments/stores/starter-market/salesfloor-prototype.png"],
  ["assets/day01/backgrounds/backroom_bg.png", "assets/game/environments/stores/starter-market/backroom-prototype.png"],

  ["assets/day01/characters/worker_idle.png", "assets/game/characters/workers/worker-a/idle.png"],
  ["assets/day01/characters/worker_carry_box.png", "assets/game/characters/workers/worker-a/carry-medium.png"],
  ["assets/day01/characters/worker_push_cart.png", "assets/game/characters/workers/worker-a/push-cart.png"],
  ["assets/day01/characters/worker_restock.png", "assets/game/characters/workers/worker-a/place-low.png"],

  ["assets/day01/characters/customer_01_idle.png", "assets/game/characters/customers/customer-a/idle.png"],
  ["assets/day01/characters/customer_01_basket.png", "assets/game/characters/customers/customer-a/carry-basket.png"],
  ["assets/day01/characters/customer_02_idle.png", "assets/game/characters/customers/customer-b/idle.png"],
  ["assets/day01/characters/customer_02_basket.png", "assets/game/characters/customers/customer-b/carry-basket.png"],

  ["assets/day01/props/cart_empty.png", "assets/game/equipment/restock-carts/cart-a-empty.png"],
  ["assets/day01/props/cart_loading.png", "assets/game/equipment/restock-carts/cart-a-loaded.png"],
  ["assets/day01/props/cart_ready.png", "assets/game/equipment/restock-carts/cart-a-ready.png"],
  ["assets/day01/props/cart_full.png", "assets/game/equipment/restock-carts/cart-a-full.png"],

  ["assets/day01/props/box_cola.png", "assets/game/props/cases/cola-case-closed.png"],
  ["assets/day01/props/box_milk.png", "assets/game/props/cases/milk-case-closed.png"],
  ["assets/day01/props/box_water.png", "assets/game/props/cases/water-case-closed.png"],

  ["assets/day01/products/product_cola.png", "assets/game/products/beverages/cola-bottle.png"],
  ["assets/day01/products/product_milk.png", "assets/game/products/beverages/milk-bottle.png"],
  ["assets/day01/products/product_water.png", "assets/game/products/beverages/water-bottle.png"],

  ["assets/day01/props/shelf_frame.png", "assets/game/fixtures/coolers/beverage-cooler-a/base.png"]
];

const rejectedFiles = [
  "assets/day01/box_cola.png",
  "assets/day01/box_milk.png",
  "assets/day01/box_water.png",
  "assets/day01/cart.png",
  "assets/day01/cart_empty.png",
  "assets/day01/cart_full.png",
  "assets/day01/cart_loading.png",
  "assets/day01/cart_ready.png",
  "assets/day01/customer_01.png",
  "assets/day01/customer_01_basket.png",
  "assets/day01/customer_01_idle.png",
  "assets/day01/customer_02.png",
  "assets/day01/customer_02_basket.png",
  "assets/day01/customer_02_idle.png",
  "assets/day01/product_cola.png",
  "assets/day01/product_milk.png",
  "assets/day01/product_water.png",
  "assets/day01/shelf_frame.png",
  "assets/day01/worker_carry_box.png",
  "assets/day01/worker_idle.png",
  "assets/day01/worker_push_cart.png",
  "assets/day01/worker_restock.png",
  "assets/day01/props/cart.png",
  "assets/day01/products/product_cola_alt.png"
];

const rejectedDirectories = [
  // This pack uses a separate cartoon art direction and conflicts with the
  // approved semi-realistic fixed-camera supermarket target.
  "assets/day01/delivery"
];

function checksum(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function moveRetainedAsset(sourceRelative, targetRelative) {
  const source = resolve(root, sourceRelative);
  const target = resolve(root, targetRelative);

  if (!existsSync(source)) {
    if (!existsSync(target)) {
      throw new Error(`Missing retained asset at both source and target: ${sourceRelative}`);
    }
    return "already-migrated";
  }

  mkdirSync(dirname(target), { recursive: true });

  if (existsSync(target)) {
    if (checksum(source) !== checksum(target)) {
      throw new Error(`Refusing to overwrite different asset: ${targetRelative}`);
    }
    rmSync(source);
    return "deduplicated";
  }

  try {
    renameSync(source, target);
  } catch {
    copyFileSync(source, target);
    rmSync(source);
  }
  return "migrated";
}

const results = [];
for (const [source, target] of retainedMoves) {
  results.push({ source, target, result: moveRetainedAsset(source, target) });
}

for (const relative of rejectedFiles) {
  const path = resolve(root, relative);
  if (existsSync(path)) {
    rmSync(path);
    results.push({ source: relative, result: "deleted-rejected-duplicate" });
  }
}

for (const relative of rejectedDirectories) {
  const path = resolve(root, relative);
  if (existsSync(path) && statSync(path).isDirectory()) {
    rmSync(path, { recursive: true, force: true });
    results.push({ source: relative, result: "deleted-style-conflict" });
  }
}

console.log(JSON.stringify({ migratedAt: new Date().toISOString(), results }, null, 2));
