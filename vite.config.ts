import { defineConfig } from "vite";
import { resolveViteBasePath } from "./src/config/viteBasePath";

export default defineConfig({
  base: resolveViteBasePath({
    githubActions: process.env.GITHUB_ACTIONS,
    githubRepository: process.env.GITHUB_REPOSITORY,
  }),
  test: {
    environment: "node",
    setupFiles: ["./src/test-setup.ts"],
  },
});
