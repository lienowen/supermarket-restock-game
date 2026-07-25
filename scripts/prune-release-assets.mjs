import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { analyseRuntimeAssets } from "./runtime-asset-references.mjs";

const DIST_DIR = resolve("dist");
const TOP_REMOVED_COUNT = 30;

if (!existsSync(DIST_DIR)) {
  throw new Error("dist/ does not exist. Run vite build before pruning release assets.");
}

const analysis = analyseRuntimeAssets(DIST_DIR);
const removed = [...analysis.unreferenced].sort((left, right) => right.size - left.size);
const removedBytes = removed.reduce((sum, entry) => sum + entry.size, 0);

for (const entry of removed) {
  rmSync(entry.file, { force: true });
}

console.log("Largest pruned non-runtime assets:");
removed.slice(0, TOP_REMOVED_COUNT).forEach((entry, index) => {
  console.log(
    `${String(index + 1).padStart(2, "0")}. ${formatBytes(entry.size).padStart(10)}  ${entry.name}`
  );
});
console.log(
  `Pruned ${removed.length} non-runtime release assets, saving ${formatBytes(removedBytes)}. ` +
  `${analysis.referenced.size} runtime assets remain protected by the built reference graph.`
);

function formatBytes(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}
