import { describe, expect, it } from "vitest";
import {
  getAuthenticationRedirectUrl,
  resolveApplicationBaseUrl,
} from "./applicationUrl";

describe("application URL helpers", () => {
  it("resolves local development base URL as /", () => {
    expect(resolveApplicationBaseUrl("http://localhost:5173", "/")).toBe(
      "http://localhost:5173/",
    );
  });

  it("resolves GitHub Pages base URL with repository subpath", () => {
    expect(
      resolveApplicationBaseUrl(
        "https://kevinbroome.github.io",
        "/nexus-map/",
      ),
    ).toBe("https://kevinbroome.github.io/nexus-map/");
  });

  it("preserves a trailing slash on auth redirect URLs", () => {
    expect(
      resolveApplicationBaseUrl("http://localhost:5173", "/"),
    ).toMatch(/\/$/);
    expect(
      resolveApplicationBaseUrl("https://kevinbroome.github.io", "/nexus-map/"),
    ).toMatch(/\/$/);
  });

  it("uses import.meta.env.BASE_URL by default", () => {
    expect(import.meta.env.BASE_URL).toBe("/");
    expect(resolveApplicationBaseUrl("http://localhost:5173")).toBe(
      "http://localhost:5173/",
    );
  });

  it("getAuthenticationRedirectUrl mirrors the application base URL in browser tests", () => {
    const originalWindow = globalThis.window;
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        location: {
          origin: "http://localhost:5173",
        },
      },
    });

    try {
      expect(getAuthenticationRedirectUrl()).toBe("http://localhost:5173/");
    } finally {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: originalWindow,
      });
    }
  });
});
