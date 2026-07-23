import { execSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadEnvironment } from "../config/environment";
import { resolveViteBasePath } from "../config/viteBasePath";
import { RepositoryConfigurationError } from "../persistence/repositoryErrors";

const projectRoot = join(fileURLToPath(new URL("../..", import.meta.url)));

function listSourceFiles(directory: string): string[] {
  const entries = readdirSync(directory);
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(directory, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      files.push(...listSourceFiles(fullPath));
      continue;
    }

    if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry) && !entry.endsWith(".test.ts")) {
      files.push(fullPath);
    }
  }

  return files;
}

describe("GitHub Pages deployment", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects missing Supabase configuration in production supabase mode", () => {
    vi.stubEnv("VITE_WORLD_REPOSITORY", "supabase");
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("PROD", "true");

    expect(() => loadEnvironment()).toThrow(RepositoryConfigurationError);
  });

  it("allows local mode without Supabase configuration", () => {
    vi.stubEnv("VITE_WORLD_REPOSITORY", "local");
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");

    const environment = loadEnvironment();

    expect(environment.repositoryMode).toBe("local");
    expect(environment.supabase).toBeUndefined();
  });

  it("does not use service-role keys outside the environment guard", () => {
    const sourceRoot = join(projectRoot, "src");
    const contents = listSourceFiles(sourceRoot)
      .filter((filePath) => !filePath.endsWith("environment.ts"))
      .map((filePath) => readFileSync(filePath, "utf8"))
      .join("\n");

    expect(contents).not.toMatch(/VITE_SUPABASE_SERVICE_ROLE_KEY/);
    expect(contents).not.toMatch(/service_role/);
  });

  it("builds production assets with the GitHub Pages base path", () => {
    execSync("npm run build", {
      cwd: projectRoot,
      stdio: "pipe",
      env: {
        ...process.env,
        GITHUB_PAGES_BUILD: "true",
        GITHUB_REPOSITORY: "kevinbroome/nexus-map",
        VITE_WORLD_REPOSITORY: "supabase",
        VITE_SUPABASE_URL: "https://example.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
      },
    });

    const indexHtml = readFileSync(join(projectRoot, "dist", "index.html"), "utf8");
    const assetDirectory = join(projectRoot, "dist", "assets");
    const assetFiles = readdirSync(assetDirectory);

    expect(resolveViteBasePath({
      githubPagesBuild: "true",
      githubRepository: "kevinbroome/nexus-map",
    })).toBe("/nexus-map/");
    expect(indexHtml).toContain("/nexus-map/assets/");
    expect(assetFiles.some((fileName) => indexHtml.includes(`/nexus-map/assets/${fileName}`))).toBe(
      true,
    );
  }, 120_000);
});
