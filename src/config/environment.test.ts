import { afterEach, describe, expect, it, vi } from "vitest";
import { describeEnvironment, loadEnvironment } from "./environment";
import { RepositoryConfigurationError } from "../persistence/repositoryErrors";

describe("loadEnvironment", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("works in local mode without Supabase variables", () => {
    vi.stubEnv("VITE_WORLD_REPOSITORY", "local");
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");

    const environment = loadEnvironment();

    expect(environment.repositoryMode).toBe("local");
    expect(environment.supabase).toBeUndefined();
  });

  it("defaults to local mode when repository mode is absent", () => {
    vi.stubEnv("VITE_WORLD_REPOSITORY", "");
    const environment = loadEnvironment();
    expect(environment.repositoryMode).toBe("local");
  });

  it("requires URL and publishable key in supabase mode during production", () => {
    vi.stubEnv("VITE_WORLD_REPOSITORY", "supabase");
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("PROD", "true");

    expect(() => loadEnvironment()).toThrow(RepositoryConfigurationError);
  });

  it("accepts legacy anon key name as publishable key fallback", () => {
    vi.stubEnv("VITE_WORLD_REPOSITORY", "local");
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "legacy-anon-key");

    const environment = loadEnvironment();

    expect(environment.supabase?.publishableKey).toBe("legacy-anon-key");
  });

  it("rejects invalid Supabase URLs", () => {
    vi.stubEnv("VITE_WORLD_REPOSITORY", "local");
    vi.stubEnv("VITE_SUPABASE_URL", "not-a-url");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "publishable-key");

    expect(() => loadEnvironment()).toThrow(RepositoryConfigurationError);
  });

  it("rejects service-role key usage in the browser", () => {
    vi.stubEnv("VITE_SUPABASE_SERVICE_ROLE_KEY", "secret-service-role-key");

    expect(() => loadEnvironment()).toThrow(
      "VITE_SUPABASE_SERVICE_ROLE_KEY must not be used in the browser application.",
    );
  });

  it("does not log publishable keys in diagnostics output", () => {
    vi.stubEnv("VITE_WORLD_REPOSITORY", "local");
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "super-secret-publishable-key");

    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const environment = loadEnvironment();
    const lines = describeEnvironment(environment);

    expect(lines.join("\n")).not.toContain("super-secret-publishable-key");
    consoleSpy.mockRestore();
  });
});
