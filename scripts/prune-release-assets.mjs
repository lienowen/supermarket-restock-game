import { existsSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

const DIST_DIR = resolve("dist");
const TEXT_EXTENSIONS = new Set([".html", ".js", ".css", ".json"]);
const TARGETS = [
  "assets/day01/source_refs",
  "assets/day02/promotion/_source",
  "assets/day02/promotion/source",
  "assets/storefront/modules",
  "assets/day01/backroom_bg.png",
  "assets/day01/salesfloor_bg.png",
  "assets/day01/ChatGPT Image 2026年7月13日 16_09_46.png"
];

if (!existsSync(DIST_DIR)) {
  throw new Error("dist/ does not exist. Run vite build before pruning release assets.");
}

const allFiles = walk(DIST_DIR);
const runtimeText = allFiles
  .filter((file) => TEXT_EXTENSIONS.has(extname(file).toLowerCase()))
  .map((file) => readFileSync(file, "utf8"))
  .join("\n");

let removedFiles = 0;
let removedBytes = 0;

for (const target of TARGETS) {
  const absolute = join(DIST_DIR, target);
  if (!existsSync(absolute)) continue;

  const targetFiles = statSync(absolute).isDirectory() ? walk(absolute) : [absolute];
  const referenced = targetFiles.find((file) => {
    const name = relative(DIST_DIR, file).replaceAll("\\", "/");
    return runtimeText.includes(name) || runtimeText.includes(encodeURI(name));
  });

  if (referenced) {
    const name = relative(DIST_DIR, referenced).replaceAll("\\", "/");
    throw new Error(`Refusing to prune runtime-referenced release asset: ${name}`);
  }

  removedFiles += targetFiles.length;
  removedBytes += targetFiles.reduce((sum, file) => sum + statSync(file).size, 0);
  rmSync(absolute, { recursive: true, force: true });
}

console.log(
  `Pruned ${removedFiles} non-runtime release assets, saving ${(removedBytes / 1024 / 1024).toFixed(2)} MiB.`
);

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}
