import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_DIRECTORY = resolve(ROOT, "public/assets/game/staff-growth");

const ASSETS = Object.freeze([
  ["asset-source/supermarket_staff_growth_phase1/store_associate_idle.png", "store_associate_idle.png"],
  ["asset-source/supermarket_staff_growth_phase1/store_associate_carry-medium.png", "store_associate_carry-medium.png"],
  ["asset-source/supermarket_staff_growth_phase1/store_associate_place-low.png", "store_associate_place-low.png"],
  ["asset-source/supermarket_staff_growth_phase1/store_associate_push-cart.png", "store_associate_push-cart.png"],
  ["asset-source/supermarket_staff_growth_phase1/senior_associate_idle.png", "senior_associate_idle.png"],
  ["asset-source/supermarket_staff_growth_phase1/senior_associate_carry-medium.png", "senior_associate_carry-medium.png"],
  ["asset-source/supermarket_staff_growth_phase1/senior_associate_place-low.png", "senior_associate_place-low.png"],
  ["asset-source/supermarket_staff_growth_phase1/senior_associate_push-cart.png", "senior_associate_push-cart.png"],
  ["asset-source/supermarket_staff_growth_phase2_shift_leader/shift_leader_idle.png", "shift_leader_idle.png"],
  ["asset-source/supermarket_staff_growth_phase2_shift_leader/shift_leader_carry-medium.png", "shift_leader_carry-medium.png"],
  ["asset-source/supermarket_staff_growth_phase2_shift_leader/shift_leader_place-low.png", "shift_leader_place-low.png"],
  ["asset-source/supermarket_staff_growth_phase2_shift_leader/shift_leader_push-cart.png", "shift_leader_push-cart.png"]
]);

mkdirSync(OUTPUT_DIRECTORY, { recursive: true });

for (const [sourceRelative, outputName] of ASSETS) {
  const source = resolve(ROOT, sourceRelative);
  const output = resolve(OUTPUT_DIRECTORY, outputName);
  if (!existsSync(source) || !statSync(source).isFile()) {
    throw new Error(`Missing staff growth source asset: ${sourceRelative}`);
  }
  copyFileSync(source, output);
  process.stdout.write(`Materialized staff growth asset ${outputName} (${statSync(output).size} bytes).\n`);
}
