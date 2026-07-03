import fs from "node:fs";

const source = fs.readFileSync(new URL("./src/main.js", import.meta.url), "utf8");
const goods = [...source.matchAll(/\b([a-z]+): \{ label:/g)].map((m) => m[1]);
const levelMatches = [...source.matchAll(/lv:\s*(\d+),[\s\S]*?cells:\s*\[([\s\S]*?)\n\s*\],\n\s*\}/g)];

let failed = false;

for (const [, lv, body] of levelMatches) {
  const counts = {};
  for (const type of goods) {
    const count = (body.match(new RegExp(`"${type}"`, "g")) || []).length;
    if (count > 0) counts[type] = count;
  }

  const badCounts = Object.entries(counts).filter(([, count]) => count % 3 !== 0);
  if (badCounts.length) {
    failed = true;
    console.error(`Level ${lv}: item counts must be multiples of 3`, badCounts);
  }

  const shelves = [...body.matchAll(/lanes:\s*\[(.*?)\]\s*\}/gs)];
  for (const [shelf] of shelves) {
    const laneCount = (shelf.match(/\[/g) || []).length - 1;
    if (laneCount !== 3) {
      failed = true;
      console.error(`Level ${lv}: shelf must have exactly 3 lanes`, shelf.replace(/\s+/g, " "));
    }
  }

  console.log(`Level ${lv}: ${JSON.stringify(counts)}`);
}

if (failed) process.exit(1);
console.log("Shelf level validation passed.");
