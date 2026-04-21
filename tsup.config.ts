import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    rover: "src/runtime/rover.ts",
    cmd: "src/cli/cmd.ts",
  },
  format: ["esm"],
  target: "node20",
  platform: "node",
  outDir: "dist",
  clean: true,
  sourcemap: false,
  dts: false,
  splitting: false,
  minify: false,
  shims: true,
});
