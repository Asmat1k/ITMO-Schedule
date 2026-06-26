import { defineConfig } from "vite";

// Single content script bundled as a self-executing IIFE so Chrome can load it
// as a classic content script. manifest.json + assets live in public/ and are
// copied to dist/ as-is.
export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    lib: {
      entry: "src/content.ts",
      formats: ["iife"],
      name: "itmoScheduleExport",
      fileName: () => "content.js",
    },
  },
});
