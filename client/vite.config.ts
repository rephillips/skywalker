import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    include: [
      "@splunk/visualizations/Line",
      "@splunk/visualizations/Bar",
      "@splunk/visualizations/Area",
      "@splunk/themes",
      "@splunk/visualization-context",
      "styled-components",
    ],
  },
  ssr: {
    noExternal: ["@splunk/*"],
  },
});
