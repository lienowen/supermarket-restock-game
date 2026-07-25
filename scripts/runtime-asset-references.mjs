import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const ROOT_TEXT_EXTENSIONS = new Set([".html", ".js", ".css", ".webmanifest", ".xml"]);
const NESTED_TEXT_EXTENSIONS = new Set([".json", ".webmanifest", ".xml", ".txt"]);
const GENERATED_CODE_EXTENSIONS = new Set([".js", ".css"]);
const STRING_DELIMITERS = new Set(["\"", "'", "`"]);

export function analyseRuntimeAssets(distDir) {
  const files = walk(distDir);
  const entries = files.map((file) => ({
    file,
    name: relative(distDir, file).replaceAll("\\", "/"),
    extension: extname(file).toLowerCase(),
    size: statSync(file).size
  }));

  const candidates = entries.filter((entry) => (
    entry.name.startsWith("assets/") && !GENERATED_CODE_EXTENSIONS.has(entry.extension)
  ));
  const rootTextEntries = entries.filter((entry) => (
    ROOT_TEXT_EXTENSIONS.has(entry.extension) && (
      !entry.name.startsWith("assets/") || GENERATED_CODE_EXTENSIONS.has(entry.extension)
    )
  ));

  let searchableText = rootTextEntries
    .map((entry) => readText(entry.file))
    .join("\n");
  const referenced = new Set();
  let discoveredNestedText = true;

  while (discoveredNestedText) {
    discoveredNestedText = false;
    for (const entry of candidates) {
      if (referenced.has(entry.name) || !containsReference(searchableText, entry.name)) continue;
      referenced.add(entry.name);
      if (NESTED_TEXT_EXTENSIONS.has(entry.extension)) {
        searchableText += `\n${readText(entry.file)}`;
        discoveredNestedText = true;
      }
    }
  }

  return Object.freeze({
    entries: Object.freeze(entries),
    candidates: Object.freeze(candidates),
    referenced: Object.freeze(referenced),
    unreferenced: Object.freeze(candidates.filter((entry) => !referenced.has(entry.name)))
  });
}

export function containsReference(text, name) {
  if (text.includes(name) || text.includes(encodeURI(name))) return true;
  return containsDynamicDirectoryReference(text, name) || containsDynamicDirectoryReference(text, encodeURI(name));
}

export function containsDynamicDirectoryReference(text, name) {
  const slashIndex = name.lastIndexOf("/");
  if (slashIndex < 0) return false;
  const directory = name.slice(0, slashIndex + 1);
  let offset = text.indexOf(directory);

  while (offset >= 0) {
    const delimiter = text[offset - 1];
    const following = text[offset + directory.length];
    if (
      STRING_DELIMITERS.has(delimiter) &&
      (following === "$" || following === delimiter)
    ) {
      return true;
    }
    offset = text.indexOf(directory, offset + directory.length);
  }
  return false;
}

export function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

function readText(file) {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return "";
  }
}
