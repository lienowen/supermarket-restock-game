import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const DIST_DIR = "dist";
const MOBILE_HOMEPAGE_TARGET_BYTES = 20 * 1024 * 1024;
const BASIC_LAUNCH_WARNING_BYTES = 50 * 1024 * 1024;
const ABSOLUTE_MAX_BYTES = 250 * 1024 * 1024;
const ABSOLUTE_MAX_FILES = 1500;
const LARGE_FILE_WARNING_BYTES = 10 * 1024 * 1024;
const TEXT_EXTENSIONS = new Set([".html", ".js", ".css", ".json"]);

if (!existsSync(DIST_DIR)) {
  console.error("Release check failed: dist/ does not exist. Run npm run build first.");
  process.exit(1);
}

const files = walk(DIST_DIR);
const totalBytes = files.reduce((sum, file) => sum + statSync(file).size, 0);
const failures = [];
const warnings = [];

for (const file of files) {
  const stats = statSync(file);
  const name = relative(DIST_DIR, file);
  const extension = extname(file).toLowerCase();

  if (stats.size > LARGE_FILE_WARNING_BYTES) {
    warnings.push(`${name}: large individual file ${formatBytes(stats.size)}`);
  }
  if (!TEXT_EXTENSIONS.has(extension)) continue;

  const content = readFileSync(file, "utf8");
  if (/["'`]\/assets\//.test(content)) {
    failures.push(`${name}: contains a root-relative /assets/ reference`);
  }

  if (extension === ".js" && /(?:requestFullscreen|webkitRequestFullscreen)/.test(content)) {
    failures.push(`${name}: contains a custom fullscreen API call`);
  }
}

if (!files.some((file) => relative(DIST_DIR, file) === "index.html")) {
  failures.push("dist/index.html is missing");
}

if (files.length > ABSOLUTE_MAX_FILES) {
  failures.push(`bundle contains ${files.length} files, exceeding the 1500-file platform limit`);
}

if (totalBytes > ABSOLUTE_MAX_BYTES) {
  failures.push(`bundle size ${formatBytes(totalBytes)} exceeds 250 MiB`);
} else if (totalBytes > BASIC_LAUNCH_WARNING_BYTES) {
  warnings.push(
    `bundle size ${formatBytes(totalBytes)} exceeds the 50 MiB Basic Launch target; verify SDK-driven progressive loading`
  );
} else if (totalBytes > MOBILE_HOMEPAGE_TARGET_BYTES) {
  warnings.push(
    `bundle size ${formatBytes(totalBytes)} exceeds the 20 MiB mobile homepage target; keep initial scene loading selective`
  );
}

if (warnings.length > 0) {
  console.warn("Release warnings:\n" + warnings.map((warning) => `- ${warning}`).join("\n"));
}

if (failures.length > 0) {
  console.error("Release check failed:\n" + failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}

console.log(`Release bundle verified: ${files.length} files, ${formatBytes(totalBytes)}.`);

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

function formatBytes(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}
