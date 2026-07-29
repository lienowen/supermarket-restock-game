import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { analyseRuntimeAssets } from "./runtime-asset-references.mjs";

const DIST_DIR = "dist";
const ABSOLUTE_MAX_BYTES = 250 * 1024 * 1024;
const ABSOLUTE_MAX_FILES = 1500;
const LARGE_FILE_WARNING_BYTES = 10 * 1024 * 1024;
const TOP_FILE_COUNT = 20;
const TOP_UNREFERENCED_COUNT = 30;
const TEXT_EXTENSIONS = new Set([".html", ".js", ".css", ".json"]);
const STATIC_ASSET_REFERENCE = /(?:^|["'`(=:,\s])((?:\.\/)?assets\/[^"'`\s)]+?\.(?:avif|gif|jpe?g|png|svg|webp|mp3|ogg|wav|json|woff2?))(?:[?#][^"'`\s)]*)?/gim;

if (!existsSync(DIST_DIR)) {
  console.error("Release check failed: dist/ does not exist. Run npm run build first.");
  process.exit(1);
}

const analysis = analyseRuntimeAssets(DIST_DIR);
const fileStats = analysis.entries
  .map((entry) => ({ ...entry, extension: extname(entry.file).toLowerCase() }))
  .sort((left, right) => right.size - left.size);
const totalBytes = fileStats.reduce((sum, entry) => sum + entry.size, 0);
const failures = [];
const warnings = [];
const missingRuntimeAssets = new Set();

for (const entry of fileStats) {
  if (entry.size > LARGE_FILE_WARNING_BYTES) {
    warnings.push(`${entry.name}: large individual file ${formatBytes(entry.size)}`);
  }
  if (!TEXT_EXTENSIONS.has(entry.extension)) continue;

  const content = readFileSync(entry.file, "utf8");
  if (/["'`]\/assets\//.test(content)) {
    failures.push(`${entry.name}: contains a root-relative /assets/ reference`);
  }

  if (entry.extension === ".js" && /(?:requestFullscreen|webkitRequestFullscreen)/.test(content)) {
    failures.push(`${entry.name}: contains a custom fullscreen API call`);
  }

  for (const reference of extractStaticAssetReferences(content)) {
    if (!existsSync(join(DIST_DIR, reference))) {
      missingRuntimeAssets.add(reference);
    }
  }
}

if (!fileStats.some((entry) => entry.name === "index.html")) {
  failures.push("dist/index.html is missing");
}

if (fileStats.length > ABSOLUTE_MAX_FILES) {
  failures.push(`bundle contains ${fileStats.length} files, exceeding the 1500-file platform limit`);
}

if (totalBytes > ABSOLUTE_MAX_BYTES) {
  failures.push(`bundle size ${formatBytes(totalBytes)} exceeds 250 MiB`);
}

if (missingRuntimeAssets.size > 0) {
  failures.push(
    `bundle references ${missingRuntimeAssets.size} missing static assets:\n` +
    [...missingRuntimeAssets].sort().map((reference) => `  ${reference}`).join("\n")
  );
}

const unreferencedAssets = [...analysis.unreferenced].sort((left, right) => right.size - left.size);
if (unreferencedAssets.length > 0) {
  failures.push(
    `bundle still contains ${unreferencedAssets.length} unreachable assets ` +
    `(${formatBytes(unreferencedAssets.reduce((sum, entry) => sum + entry.size, 0))})`
  );
}

console.log("Largest release files:");
fileStats.slice(0, TOP_FILE_COUNT).forEach((entry, index) => {
  console.log(`${String(index + 1).padStart(2, "0")}. ${formatBytes(entry.size).padStart(10)}  ${entry.name}`);
});

console.log("Largest assets with no runtime reference:");
unreferencedAssets.slice(0, TOP_UNREFERENCED_COUNT).forEach((entry, index) => {
  console.log(`${String(index + 1).padStart(2, "0")}. ${formatBytes(entry.size).padStart(10)}  ${entry.name}`);
});
console.log(
  `Unreferenced candidates: ${unreferencedAssets.length} files, ` +
  `${formatBytes(unreferencedAssets.reduce((sum, entry) => sum + entry.size, 0))}.`
);

if (warnings.length > 0) {
  console.warn("Release warnings:\n" + warnings.map((warning) => `- ${warning}`).join("\n"));
}

if (failures.length > 0) {
  console.error("Release check failed:\n" + failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}

console.log(
  `Release bundle verified: ${fileStats.length} files, ${formatBytes(totalBytes)}, ` +
  `${analysis.referenced.size} referenced runtime assets. ` +
  "Initial-download budgets are enforced by measure-release-payload.mjs."
);

function extractStaticAssetReferences(content) {
  const references = new Set();
  for (const match of content.matchAll(STATIC_ASSET_REFERENCE)) {
    const raw = match[1];
    if (!raw || raw.includes("${") || raw.includes("{") || raw.includes("}")) continue;
    const normalized = raw.replace(/^\.\//, "");
    try {
      references.add(decodeURI(normalized));
    } catch {
      references.add(normalized);
    }
  }
  return references;
}

function formatBytes(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}
