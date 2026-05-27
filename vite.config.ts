import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  build: {
    outDir: process.env.CLIENT_OUT_DIR ?? "build",
    emptyOutDir: false,
  },
  cacheDir: ".vite-cache",
  server: {
    hmr: {
      clientPort: 5173,
      host: "127.0.0.1",
      protocol: "ws",
    },
    proxy: {
      "/api": "http://127.0.0.1:3333",
    },
  },
  plugins: [react()],
});
