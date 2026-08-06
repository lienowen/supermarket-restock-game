import { createHash } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  readdirSync,
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

const P0_SOURCE_DIRECTORY = resolve(ROOT, "asset-source/supermarket-restock-p0-assets-v1");
const P0_OUTPUT_DIRECTORY = resolve(ROOT, "public/assets/game/production-v2/p0-levels-2-5");
const P0_ASSET_NAMES = Object.freeze([
  "equipment-checkout-bag-open.png",
  "market-salesfloor-v3.png",
  "prop-checkout-receipt.png",
  "spill-dirt-smear-large.png",
  "spill-juice-large.png",
  "spill-water-large.png",
  "water-case-closed.png",
  "water-case-open.png"
]);

const pngDimensions = (pngBytes) => {
  const signature = pngBytes.subarray(0, 8).toString("hex");
  if (signature !== "89504e470d0a1a0a" || pngBytes.length < 24) {
    throw new Error("P0 source is not a valid PNG file");
  }
  return {
    width: pngBytes.readUInt32BE(16),
    height: pngBytes.readUInt32BE(20)
  };
};

mkdirSync(P0_OUTPUT_DIRECTORY, { recursive: true });
for (const assetName of P0_ASSET_NAMES) {
  const sourcePath = resolve(P0_SOURCE_DIRECTORY, assetName);
  const outputPath = resolve(P0_OUTPUT_DIRECTORY, assetName);
  const assetBytes = readFileSync(sourcePath);
  const dimensions = pngDimensions(assetBytes);
  if (dimensions.width < 256 || dimensions.height < 256) {
    throw new Error(
      `P0 asset is below runtime resolution: ${assetName} (${dimensions.width}x${dimensions.height})`
    );
  }
  writeFileSync(outputPath, assetBytes);
  process.stdout.write(
    `Materialized P0 asset ${assetName} (${dimensions.width}x${dimensions.height}).\n`
  );
}
