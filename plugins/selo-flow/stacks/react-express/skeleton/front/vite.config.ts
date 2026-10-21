import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// `npm run demo` runs in the `demo` mode: the proxy then targets the API's demo, not its dev server.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: mode === "demo" ? "http://localhost:{{api_demo_port}}" : "{{api_url}}",
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
}));
