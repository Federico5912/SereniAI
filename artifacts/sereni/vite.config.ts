import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: process.env.VITE_BASE_PATH || "/",
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    port: Number(process.env.PORT || 5173),
    host: "0.0.0.0",
  },
  preview: {
    port: Number(process.env.PORT || 4173),
    host: "0.0.0.0",
  },
});
