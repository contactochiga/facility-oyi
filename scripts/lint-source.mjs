import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const roots = ["app", "components", "lib", "services", "store", "types"];
const extensions = new Set([".ts", ".tsx", ".js", ".mjs"]);
const failures = [];

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(file);
    else if (extensions.has(path.extname(file))) {
      const source = await readFile(file, "utf8");
      if (/\bdebugger\s*;/.test(source)) failures.push(`${file}: debugger statement`);
      if (/console\.(log|debug)\(/.test(source) && !file.includes(".test.")) failures.push(`${file}: console log/debug statement`);
    }
  }
}

await Promise.all(roots.map((root) => walk(root)));
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("Source lint passed.");
