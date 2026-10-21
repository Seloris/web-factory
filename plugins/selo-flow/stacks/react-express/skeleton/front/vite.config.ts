import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "{{api_url}}",
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
