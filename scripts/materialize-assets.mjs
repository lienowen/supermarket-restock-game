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

const PNG_SIGNATURE = Buffer.from("89504e470d0a1a0a", "hex");
const SAFE_PNG_CHUNKS = new Set(["IHDR", "PLTE", "tRNS", "IDAT", "IEND"]);

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) !== 0
      ? 0xedb88320 ^ (value >>> 1)
      : value >>> 1;
  }
  return value >>> 0;
});

const crc32 = (buffer) => {
  let crc = 0xffffffff;
  for (const value of buffer) {
    crc = crcTable[(crc ^ value) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const makePngChunk = (type, data) => {
  const typeBytes = Buffer.from(type, "ascii");
  const length = Buffer.allocUnsafe(4);
  length.writeUInt32BE(data.length, 0);
  const checksum = Buffer.allocUnsafe(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 0);
  return Buffer.concat([length, typeBytes, data, checksum]);
};

const sanitizePng = (pngBytes, assetName) => {
  if (pngBytes.length < 24 || !pngBytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error(`P0 source is not a valid PNG file: ${assetName}`);
  }

  const outputChunks = [];
  const seen = new Set();
  let offset = 8;
  while (offset + 12 <= pngBytes.length) {
    const length = pngBytes.readUInt32BE(offset);
    const typeStart = offset + 4;
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const chunkEnd = dataEnd + 4;
    if (chunkEnd > pngBytes.length) {
      throw new Error(`Truncated PNG chunk in ${assetName}`);
    }

    const type = pngBytes.subarray(typeStart, dataStart).toString("ascii");
    if (SAFE_PNG_CHUNKS.has(type)) {
      outputChunks.push(makePngChunk(type, pngBytes.subarray(dataStart, dataEnd)));
      seen.add(type);
    }
    offset = chunkEnd;
    if (type === "IEND") break;
  }

  if (!seen.has("IHDR") || !seen.has("IDAT") || !seen.has("IEND")) {
    throw new Error(`PNG is missing a required chunk: ${assetName}`);
  }
  return Buffer.concat([PNG_SIGNATURE, ...outputChunks]);
};

const pngDimensions = (pngBytes) => ({
  width: pngBytes.readUInt32BE(16),
  height: pngBytes.readUInt32BE(20)
});

mkdirSync(P0_OUTPUT_DIRECTORY, { recursive: true });
for (const assetName of P0_ASSET_NAMES) {
  const sourcePath = resolve(P0_SOURCE_DIRECTORY, assetName);
  const outputPath = resolve(P0_OUTPUT_DIRECTORY, assetName);
  const sourceBytes = readFileSync(sourcePath);
  const assetBytes = sanitizePng(sourceBytes, assetName);
  const dimensions = pngDimensions(assetBytes);
  if (dimensions.width < 256 || dimensions.height < 256) {
    throw new Error(
      `P0 asset is below runtime resolution: ${assetName} (${dimensions.width}x${dimensions.height})`
    );
  }
  writeFileSync(outputPath, assetBytes);
  process.stdout.write(
    `Materialized browser-safe P0 asset ${assetName} (${dimensions.width}x${dimensions.height}, ${assetBytes.length} bytes).\n`
  );
}
