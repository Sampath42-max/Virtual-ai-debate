import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// Production API URL (Elastic Beanstalk)
const API_BASE_URL = "https://virtual-ai-debate.onrender.com";

export default defineConfig(({ mode }) => ({
  base: "/", // Needed for S3 routing
  server: {
    host: "0.0.0.0",
    port: 8080,
    proxy: {
      "/api": {
        target: API_BASE_URL,
        changeOrigin: true,
        rewrite: (path) => path,
      },
    },
  },
  define: {
    __API_BASE_URL__: JSON.stringify(API_BASE_URL),
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
}));
