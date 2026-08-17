import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ARCHIVE_PATH = resolve(ROOT, "l1_l2_recut_assets_v2.zip");
const OUTPUT_DIRECTORY = resolve(ROOT, "public/assets/game/production-v5/restock-recut-v2");
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const ASSETS = Object.freeze([
  Object.freeze({
    source: "l1_l2_recut_v2/worker_idle.png",
    output: "worker-idle.png",
    bytes: 792041,
    sha256: "7629f2f67e3cef63edd932a7c3e48f3d4c9e3045828626ed77e7844f3279d813"
  }),
  Object.freeze({
    source: "l1_l2_recut_v2/worker_push.png",
    output: "worker-push.png",
    bytes: 847570,
    sha256: "fedeaedd7bc68b0997a3abe7472e260490ad9f43b48f879b62637997ff633cba"
  }),
  Object.freeze({
    source: "l1_l2_recut_v2/cart_empty.png",
    output: "cart-empty.png",
    bytes: 762926,
    sha256: "6a91facd90fe25e6c8fb324bdac4f3088ac5d64ae0f9e6f248db8717ed30bb8b"
  }),
  Object.freeze({
    source: "l1_l2_recut_v2/cart_cola_loaded.png",
    output: "cart-cola-loaded.png",
    bytes: 1371227,
    sha256: "ab661b23e833c1f9a7052f93f57cd89f5ed34b13068eb079c94f884be3a8aadc"
  }),
  Object.freeze({
    source: "l1_l2_recut_v2/cart_water_loaded.png",
    output: "cart-water-loaded.png",
    bytes: 1390391,
    sha256: "ecb2adc7b2051ac6b3b88946c59fb9f4f381dd58a66edee7433d47b5e3c2b32a"
  })
]);

const extractRequestedEntries = (archive, requestedNames) => {
  const extracted = new Map();
  let offset = 0;

  while (offset + 4 <= archive.length) {
    const signature = archive.readUInt32LE(offset);
    if (signature === 0x02014b50 || signature === 0x06054b50) break;
    if (signature !== 0x04034b50) {
      throw new Error(`Unexpected recut ZIP signature 0x${signature.toString(16)} at ${offset}`);
    }
    if (offset + 30 > archive.length) throw new Error("Truncated recut ZIP local header");

    const flags = archive.readUInt16LE(offset + 6);
    const compressionMethod = archive.readUInt16LE(offset + 8);
    const compressedSize = archive.readUInt32LE(offset + 18);
    const uncompressedSize = archive.readUInt32LE(offset + 22);
    const fileNameLength = archive.readUInt16LE(offset + 26);
    const extraLength = archive.readUInt16LE(offset + 28);
    const fileNameStart = offset + 30;
    const dataStart = fileNameStart + fileNameLength + extraLength;
    const dataEnd = dataStart + compressedSize;

    if ((flags & 0x08) !== 0) {
      throw new Error("Recut ZIP must store entry sizes in local headers");
    }
    if (dataEnd > archive.length) throw new Error("Truncated recut ZIP entry data");

    const fileName = archive
      .subarray(fileNameStart, fileNameStart + fileNameLength)
      .toString("utf8");

    if (requestedNames.has(fileName)) {
      const compressed = archive.subarray(dataStart, dataEnd);
      const bytes = compressionMethod === 0
        ? Buffer.from(compressed)
        : compressionMethod === 8
          ? inflateRawSync(compressed)
          : null;
      if (!bytes) {
        throw new Error(`Unsupported recut ZIP compression method ${compressionMethod} for ${fileName}`);
      }
      if (bytes.length !== uncompressedSize) {
        throw new Error(
          `Recut ZIP size mismatch for ${fileName}: expected ${uncompressedSize}, got ${bytes.length}`
        );
      }
      extracted.set(fileName, bytes);
    }

    offset = dataEnd;
  }

  return extracted;
};

if (!existsSync(ARCHIVE_PATH) || !statSync(ARCHIVE_PATH).isFile()) {
  throw new Error("Missing committed L1-L2 recut archive: l1_l2_recut_assets_v2.zip");
}

const archive = readFileSync(ARCHIVE_PATH);
const requestedNames = new Set(ASSETS.map(({ source }) => source));
const extracted = extractRequestedEntries(archive, requestedNames);
mkdirSync(OUTPUT_DIRECTORY, { recursive: true });

ASSETS.forEach(({ source, output, bytes: expectedBytes, sha256 }) => {
  const bytes = extracted.get(source);
  if (!bytes) throw new Error(`Missing L1-L2 recut ZIP entry: ${source}`);

  const digest = createHash("sha256").update(bytes).digest("hex");
  const isPng = bytes.length >= PNG_SIGNATURE.length &&
    bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE);
  if (!isPng || bytes.length !== expectedBytes || digest !== sha256) {
    throw new Error(
      `L1-L2 recut integrity check failed for ${source}: bytes=${bytes.length}, sha256=${digest}, png=${isPng}`
    );
  }

  const outputPath = resolve(OUTPUT_DIRECTORY, output);
  writeFileSync(outputPath, bytes);
  process.stdout.write(`Materialized L1-L2 recut asset ${output} (${bytes.length} bytes).\n`);
});
