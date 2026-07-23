import { defineConfig } from "vite";
import { resolveViteBasePath } from "./src/config/viteBasePath";

export default defineConfig({
  base: resolveViteBasePath({
    githubPagesBuild: process.env.GITHUB_PAGES_BUILD,
    githubRepository: process.env.GITHUB_REPOSITORY,
  }),
  test: {
    environment: "node",
    setupFiles: ["./src/test-setup.ts"],
  },
});
