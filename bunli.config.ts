import { defineConfig } from "@bunli/core";

export default defineConfig({
  name: "herbstutil",
  version: "0.1.0",
  description: "A simple filter to parse herbstclient attr output into json",

  commands: {
    directory: "./src/commands",
  },

  build: {
    entry: "./src/index.ts",
    outdir: "./dist",
    targets: ["native"],
    minify: true,
    sourcemap: true,
    compress: false,
  },

  test: {
    pattern: ["**/*.test.ts", "**/*.spec.ts"],
    coverage: true,
    watch: false,
  },

  plugins: [],
});
