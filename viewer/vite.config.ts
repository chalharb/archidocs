import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// The viewer ships prebuilt in the npm package (dist/viewer); `archidocs build --out` copies it as is.
// `base: "./"` keeps every asset URL relative to index.html, so the site works under any base path.
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: "./",
  plugins: [react()],
  worker: { format: "es" },
  build: {
    outDir: fileURLToPath(new URL("../dist/viewer", import.meta.url)),
    emptyOutDir: true,
    chunkSizeWarningLimit: 2500,
  },
});
