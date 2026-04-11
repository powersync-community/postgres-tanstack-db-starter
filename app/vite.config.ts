import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import topLevelAwait from "vite-plugin-top-level-await";
import wasm from "vite-plugin-wasm";

export default defineConfig({
  envDir: "..",
  build: {
    target: "esnext",
  },
  optimizeDeps: {
    exclude: ["@journeyapps/wa-sqlite", "@powersync/web"],
  },
  plugins: [wasm(), react(), topLevelAwait()],
  worker: {
    format: "es",
    plugins: () => [wasm(), topLevelAwait()],
  },
});
