import { defineConfig } from "vite";

export default defineConfig({
  root: "apps/client",
  build: {
    outDir: "../../dist",
    emptyOutDir: true,
  },
});
