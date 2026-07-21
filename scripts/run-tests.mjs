import { mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const compile = spawnSync(
  npx,
  ["--no-install", "tsc", "-p", "tsconfig.test.json"],
  { stdio: "inherit" }
);

if (compile.status !== 0) process.exit(compile.status ?? 1);

mkdirSync(resolve(".test-dist"), { recursive: true });
writeFileSync(resolve(".test-dist/package.json"), '{"type":"commonjs"}\n', "utf8");

const run = spawnSync(
  process.execPath,
  [
    "--test",
    "tests/core-flow.test.cjs",
    "tests/v3-architecture.test.cjs",
    "tests/v3-catalogues.test.cjs",
    "tests/v3-visual-target.test.cjs",
    "tests/v3-campaign-runtime.test.cjs",
    "tests/v3-campaign-session.test.cjs",
    "tests/v3-level-runtime.test.cjs",
    "tests/v3-level-progression.test.cjs",
    "tests/v3-player-navigation.test.cjs",
    "tests/v3-checkout-runtime.test.cjs",
    "tests/v3-shift-runtime.test.cjs",
    "tests/v3-presentation-context.test.cjs",
    "tests/v3-foundation-contracts.test.cjs",
    "tests/v3-standard-market-rules.test.cjs",
    "tests/v3-boundaries.test.cjs"
  ],
  { stdio: "inherit" }
);

process.exit(run.status ?? 1);
