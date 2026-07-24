import tailwindPlugin from "bun-plugin-tailwind";

const result = await Bun.build({
  entrypoints: ["./frontend/index.html"],
  outdir: "./dist/client",
  compile: true,
  target: "browser",
  minify: true,
  plugins: [tailwindPlugin],
  tsconfig: "./frontend/tsconfig.json",
  define: { "process.env.NODE_ENV": '"production"' },
});

if (!result.success) {
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

console.log(`[mdecho] built ${result.outputs.length} client asset(s) into dist/client`);
