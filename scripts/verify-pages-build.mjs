#!/usr/bin/env node
/**
 * Verifies a GitHub Pages production build locally or in CI.
 * Usage:
 *   GITHUB_PAGES_BUILD=true GITHUB_REPOSITORY=owner/repo npm run verify:pages-build
 */
import { execSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

const repository = process.env.GITHUB_REPOSITORY ?? "kevinbroome/nexus-map";
const repositoryName = repository.split("/")[1] ?? "nexus-map";
const expectedBase = `/${repositoryName}/`;

execSync("npm run build", {
  cwd: projectRoot,
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: "production",
    GITHUB_PAGES_BUILD: "true",
    GITHUB_REPOSITORY: repository,
    VITE_WORLD_REPOSITORY: "supabase",
    VITE_SUPABASE_URL:
      process.env.VITE_SUPABASE_URL ?? "https://example.supabase.co",
    VITE_SUPABASE_PUBLISHABLE_KEY:
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "test-publishable-key",
  },
});

const indexHtml = readFileSync(join(projectRoot, "dist", "index.html"), "utf8");
const assetFiles = readdirSync(join(projectRoot, "dist", "assets"));

if (!indexHtml.includes(`${expectedBase}assets/`)) {
  console.error(
    `Expected dist/index.html to reference ${expectedBase}assets/, but it did not.`,
  );
  process.exit(1);
}

const referencesAsset = assetFiles.some((fileName) =>
  indexHtml.includes(`${expectedBase}assets/${fileName}`),
);

if (!referencesAsset) {
  console.error("dist/index.html does not reference a built asset file.");
  process.exit(1);
}

console.log(`OK: GitHub Pages build verified with base path ${expectedBase}`);
