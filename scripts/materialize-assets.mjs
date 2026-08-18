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

const PROJECT_BACKGROUND_SOURCE_DIRECTORY = resolve(
  ROOT,
  "asset-source/supermarket-project-backgrounds-v2"
);
const PROJECT_BACKGROUND_OUTPUT_DIRECTORY = resolve(
  ROOT,
  "public/assets/game/production-v4/project-backgrounds"
);

// The two source filenames were packaged with checkout/cleaning labels swapped.
// Map by the actual scene content here while preserving the committed source pack.
const PROJECT_BACKGROUNDS = Object.freeze([
  Object.freeze({
    source: "bg-restock-cold-display-zone-1672x941.png",
    output: "bg-restock-zone-v2.png"
  }),
  Object.freeze({
    source: "bg-cleaning-open-floor-zone-1672x941.png",
    output: "bg-checkout-zone-v2.png"
  }),
  Object.freeze({
    source: "bg-checkout-market-interior-1672x941.png",
    output: "bg-cleaning-zone-v2.png"
  }),
  Object.freeze({
    source: "bg-order-hunt-produce-grocery-1672x941.png",
    output: "bg-order-hunt-zone-v2.png"
  })
]);

mkdirSync(PROJECT_BACKGROUND_OUTPUT_DIRECTORY, { recursive: true });
PROJECT_BACKGROUNDS.forEach(({ source: sourceName, output: outputName }) => {
  const source = resolve(PROJECT_BACKGROUND_SOURCE_DIRECTORY, sourceName);
  const output = resolve(PROJECT_BACKGROUND_OUTPUT_DIRECTORY, outputName);
  if (!existsSync(source) || !statSync(source).isFile()) {
    throw new Error(`Missing project background source asset: ${sourceName}`);
  }
  copyFileSync(source, output);
  process.stdout.write(
    `Materialized project background ${outputName} (${statSync(output).size} bytes).\n`
  );
});

const LEVEL_TWO_SOURCE_DIRECTORY = resolve(ROOT, "asset-source/L2_restock_assets");
const LEVEL_TWO_OUTPUT_DIRECTORY = resolve(
  ROOT,
  "public/assets/game/production-v5/restock-water-l2"
);
const LEVEL_TWO_ASSETS = Object.freeze([
  "bg-restock-water-l2.png",
  "water-case-closed.png",
  "water-case-open.png"
]);

mkdirSync(LEVEL_TWO_OUTPUT_DIRECTORY, { recursive: true });
LEVEL_TWO_ASSETS.forEach((fileName) => {
  const source = resolve(LEVEL_TWO_SOURCE_DIRECTORY, fileName);
  const output = resolve(LEVEL_TWO_OUTPUT_DIRECTORY, fileName);
  if (!existsSync(source) || !statSync(source).isFile()) {
    throw new Error(`Missing Level 2 restock source asset: ${fileName}`);
  }
  copyFileSync(source, output);
  process.stdout.write(
    `Materialized Level 2 restock asset ${fileName} (${statSync(output).size} bytes).\n`
  );
});

// Level 6 originally received four PNGs whose IDAT payloads were damaged even
// though browsers could partially decode them. Do not keep those fragile binary
// copies in the repository. Rebuild the L6 runtime filenames from production
// assets that are already used and verified elsewhere in the project.
const LEVEL_SIX_OUTPUT_DIRECTORY = resolve(ROOT, "public/assets/game/missing-assets-batch-01");
const LEVEL_SIX_MATERIALIZED_ASSETS = Object.freeze([
  Object.freeze({
    source: resolve(ROOT, "public/assets/game/props/cases/milk-case-closed.png"),
    output: "delivery-box-medium.png",
    bytes: 262650,
    sha256: "73403e21642475aade2ad267c2726f771c915a92dc179e97ab0bae1f2edf6b12"
  }),
  Object.freeze({
    source: resolve(ROOT, "public/assets/game/props/cases/cola-case-closed.png"),
    output: "delivery-box-large.png",
    bytes: 223872,
    sha256: "d6d8051b31714b0233d6599f5bfe5fa339ae2a7078062295e5fa58739cefa944"
  }),
  Object.freeze({
    source: resolve(ROOT, "public/assets/game/production-v5/restock-recut-v2/cart-empty.png"),
    output: "equipment-capacity-cart-empty.png",
    bytes: 762926,
    sha256: "6a91facd90fe25e6c8fb324bdac4f3088ac5d64ae0f9e6f248db8717ed30bb8b"
  }),
  Object.freeze({
    source: resolve(ROOT, "public/assets/game/production-v5/restock-recut-v2/cart-cola-loaded.png"),
    output: "equipment-capacity-cart-loaded.png",
    bytes: 1371227,
    sha256: "ab661b23e833c1f9a7052f93f57cd89f5ed34b13068eb079c94f884be3a8aadc"
  })
]);

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
mkdirSync(LEVEL_SIX_OUTPUT_DIRECTORY, { recursive: true });
LEVEL_SIX_MATERIALIZED_ASSETS.forEach(({ source, output, bytes: expectedBytes, sha256 }) => {
  if (!existsSync(source) || !statSync(source).isFile()) {
    throw new Error(`Missing verified Level 6 source asset for ${output}`);
  }
  const sourceBytes = readFileSync(source);
  const sourceDigest = createHash("sha256").update(sourceBytes).digest("hex");
  const isPng = sourceBytes.length >= PNG_SIGNATURE.length &&
    sourceBytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE);
  if (!isPng || sourceBytes.length !== expectedBytes || sourceDigest !== sha256) {
    throw new Error(
      `Level 6 source integrity check failed for ${output}: bytes=${sourceBytes.length}, sha256=${sourceDigest}, png=${isPng}`
    );
  }
  const outputPath = resolve(LEVEL_SIX_OUTPUT_DIRECTORY, output);
  writeFileSync(outputPath, sourceBytes);
  process.stdout.write(`Materialized verified Level 6 asset ${output} (${sourceBytes.length} bytes).\n`);
});

const LEVEL_SIX_SMALL_BOX = resolve(LEVEL_SIX_OUTPUT_DIRECTORY, "delivery-box-small.png");
if (!existsSync(LEVEL_SIX_SMALL_BOX) || !statSync(LEVEL_SIX_SMALL_BOX).isFile()) {
  throw new Error("Missing Level 6 small delivery box");
}
const levelSixSmallBytes = readFileSync(LEVEL_SIX_SMALL_BOX);
const levelSixSmallDigest = createHash("sha256").update(levelSixSmallBytes).digest("hex");
if (
  levelSixSmallBytes.length !== 707278 ||
  levelSixSmallDigest !== "cd6e1ff7c8a9403b4fd5f6dc75e040fd5e538739d76695935b7c92ccadc59b22" ||
  !levelSixSmallBytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)
) {
  throw new Error(
    `Level 6 small-box integrity check failed: bytes=${levelSixSmallBytes.length}, sha256=${levelSixSmallDigest}`
  );
}
process.stdout.write(`Verified Level 6 small delivery box (${levelSixSmallBytes.length} bytes).\n`);
