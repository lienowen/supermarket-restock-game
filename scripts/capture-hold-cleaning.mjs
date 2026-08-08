import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const matureReport = resolve("ui-audit/mature-clean/report.json");
const legacyReport = resolve("ui-audit/hold-cleaning-audit.json");
let thrownError;

try {
  await import("./capture-mature-clean.mjs");
} catch (error) {
  thrownError = error;
} finally {
  if (existsSync(matureReport)) {
    mkdirSync(dirname(legacyReport), { recursive: true });
    copyFileSync(matureReport, legacyReport);
  }
}

if (thrownError) throw thrownError;
