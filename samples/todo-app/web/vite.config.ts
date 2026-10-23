import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// A run of the app (the selo plugin's run.mjs, `npm run app`) gives the port and the API's url of its slot
// in PORT and API_URL. Without them, the base ports: `npm run demo` runs in the `demo` mode, on the demo
// ports. strictPort: a taken port fails the start instead of moving the front to another port.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    port: Number(process.env.PORT ?? (mode === "demo" ? 5181 : 5173)),
    strictPort: true,
    proxy: {
      "/api": {
        target: process.env.API_URL ?? (mode === "demo" ? "http://localhost:3101" : "http://localhost:3000"),
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
}));
