import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const files = [
  resolve("scripts/measure-release-payload.mjs"),
  resolve("scripts/capture-release-regressions.mjs")
];

for (const path of files) {
  let source = readFileSync(path, "utf8");
  source = source.replaceAll("immersive-v2", "architecture-v3");
  source = source.replaceAll("immersiveV2", "architectureV3");
  source = source.replaceAll("architectureV2", "architectureV3");
  source = source.replaceAll("Immersive V2 regressions", "Architecture V3 regressions");
  writeFileSync(path, source, "utf8");
}
