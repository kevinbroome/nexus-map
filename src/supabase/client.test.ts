import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createSupabaseClient,
  getSupabaseClient,
  resetSupabaseClientForTests,
} from "./client";

describe("Supabase client scaffold", () => {
  beforeEach(() => {
    resetSupabaseClientForTests();
  });

  afterEach(() => {
    resetSupabaseClientForTests();
  });

  it("does not create a client when configuration is absent", () => {
    const client = createSupabaseClient({ repositoryMode: "local" });

    expect(client).toBeNull();
    expect(getSupabaseClient()).toBeNull();
  });

  it("creates one client for valid configuration", () => {
    const environment = {
      repositoryMode: "local" as const,
      supabase: {
        url: "https://example.supabase.co",
        publishableKey: "publishable-key",
      },
    };

    const first = createSupabaseClient(environment);
    const second = createSupabaseClient(environment);

    expect(first).not.toBeNull();
    expect(second).toBe(first);
  });

  it("reuses the same client for repeated requests", () => {
    const environment = {
      repositoryMode: "local" as const,
      supabase: {
        url: "https://example.supabase.co",
        publishableKey: "publishable-key",
      },
    };

    createSupabaseClient(environment);
    const cached = getSupabaseClient();
    createSupabaseClient(environment);

    expect(getSupabaseClient()).toBe(cached);
  });

  it("does not reference service-role environment variables", async () => {
    const { readFileSync } = await import("node:fs");
    const { dirname, join } = await import("node:path");
    const { fileURLToPath } = await import("node:url");

    const clientPath = join(
      dirname(fileURLToPath(import.meta.url)),
      "client.ts",
    );
    const contents = readFileSync(clientPath, "utf8");

    expect(contents.includes("SERVICE_ROLE")).toBe(false);
    expect(contents.includes("service_role")).toBe(false);
  });
});
