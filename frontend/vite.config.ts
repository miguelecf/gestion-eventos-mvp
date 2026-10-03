import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from "path";
import tailwind from "@tailwindcss/vite";

const usePolling = process.env.CHOKIDAR_USEPOLLING === "true";
const hmrClientPort = process.env.VITE_HMR_CLIENT_PORT;

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwind()],
  // Explicit for dev containers: Vite must bind to all interfaces
  // so the host browser can reach the frontend.
  server: {
    host: "0.0.0.0",
    proxy: {
      "/api": "http://localhost:9090",
      "/auth": "http://localhost:9090",
      "/public": "http://localhost:9090",
      "/admin": "http://localhost:9090",
    },
    watch: usePolling
      ? {
          usePolling: true,
          interval: 1000,
        }
      : undefined,
    hmr: hmrClientPort
      ? {
          clientPort: Number(hmrClientPort),
        }
      : undefined,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") }
  }
})
