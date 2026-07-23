import { describe, expect, it } from "vitest";
import { resolveViteBasePath } from "./viteBasePath";

describe("resolveViteBasePath", () => {
  it("uses / for local development builds", () => {
    expect(resolveViteBasePath()).toBe("/");
    expect(
      resolveViteBasePath({
        githubPagesBuild: "false",
        githubRepository: "owner/repo",
      }),
    ).toBe("/");
  });

  it("ignores GITHUB_REPOSITORY unless GITHUB_PAGES_BUILD is true", () => {
    expect(
      resolveViteBasePath({
        githubRepository: "kevinbroome/nexus-map",
      }),
    ).toBe("/");
  });

  it("uses /repository-name/ for GitHub Pages production builds", () => {
    expect(
      resolveViteBasePath({
        githubPagesBuild: "true",
        githubRepository: "kevinbroome/nexus-map",
      }),
    ).toBe("/nexus-map/");
  });

  it("uses / for user Pages repositories named owner.github.io", () => {
    expect(
      resolveViteBasePath({
        githubPagesBuild: "true",
        githubRepository: "kevinbroome/kevinbroome.github.io",
      }),
    ).toBe("/");
  });
});
