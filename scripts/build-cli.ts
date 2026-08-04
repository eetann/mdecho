import { chmod } from "node:fs/promises";
import { join } from "node:path";

const result = await Bun.build({
  entrypoints: ["./src/index.ts"],
  outdir: "./dist",
  target: "node",
  format: "esm",
  packages: "external",
  banner: "#!/usr/bin/env node\n",
});

if (!result.success) {
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

await chmod(join("dist", "index.js"), 0o755);

console.log(`[mdecho] built ${result.outputs.length} CLI asset(s) into dist`);
