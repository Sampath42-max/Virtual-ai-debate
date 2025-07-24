import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import dotenv from "dotenv";

// Load .env variables
dotenv.config();

const API_BASE_URL = process.env.VITE_API_BASE_URL || 'https://virtual-ai-debate.onrender.com';

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      '/api': {
        target: API_BASE_URL,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  },
  plugins: [
    react(),
    mode === 'development' && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    'process.env': {
      VITE_API_BASE_URL: JSON.stringify(API_BASE_URL),
    }
  }
}));
