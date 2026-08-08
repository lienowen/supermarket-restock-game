import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DIRECTORY = resolve(ROOT, "asset-source/salesfloor-v2");
const OUTPUT_PATH = resolve(
  ROOT,
  "public/assets/game/environments/stores/starter-market/salesfloor-v2.webp"
);
const EXPECTED_SHA256 = "bf58b69453a73c2c51072a16df90fc07090be93eb5d0955eb42aae892d4533f0";
const EXPECTED_BYTES = 35706;

const partNames = readdirSync(SOURCE_DIRECTORY)
  .filter((name) => /^part-\d+\.b64$/.test(name))
  .sort();

if (partNames.length !== 6) {
  throw new Error(`Expected 6 salesfloor source parts, found ${partNames.length}`);
}

const encoded = partNames
  .map((name) => readFileSync(resolve(SOURCE_DIRECTORY, name), "utf8").replace(/\s+/g, ""))
  .join("");
const bytes = Buffer.from(encoded, "base64");
const digest = createHash("sha256").update(bytes).digest("hex");
const isWebp = bytes.length >= 12 &&
  bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
  bytes.subarray(8, 12).toString("ascii") === "WEBP";

if (!isWebp || bytes.length !== EXPECTED_BYTES || digest !== EXPECTED_SHA256) {
  throw new Error(
    `Commercial salesfloor integrity check failed: bytes=${bytes.length}, sha256=${digest}, webp=${isWebp}`
  );
}

mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
writeFileSync(OUTPUT_PATH, bytes);
process.stdout.write(`Materialized verified salesfloor asset (${bytes.length} bytes).\n`);

const CLEAN_SOURCE_DIRECTORY = resolve(ROOT, "asset-source/supermarket-restock-p0-assets-v1");
const CLEAN_OUTPUT_DIRECTORY = resolve(ROOT, "public/assets/game/production-v2/mature-clean");
const CLEAN_SPILLS = Object.freeze([
  "spill-water-large.png",
  "spill-juice-large.png",
  "spill-dirt-smear-large.png"
]);

mkdirSync(CLEAN_OUTPUT_DIRECTORY, { recursive: true });
CLEAN_SPILLS.forEach((fileName) => {
  const source = resolve(CLEAN_SOURCE_DIRECTORY, fileName);
  const output = resolve(CLEAN_OUTPUT_DIRECTORY, fileName);
  if (!existsSync(source) || !statSync(source).isFile()) {
    throw new Error(`Missing mature cleaning source asset: ${fileName}`);
  }
  copyFileSync(source, output);
  process.stdout.write(`Materialized mature cleaning asset ${fileName} (${statSync(output).size} bytes).\n`);
});
