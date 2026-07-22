import { defineConfig } from "vite";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./src/test-setup.ts"],
  },
});
