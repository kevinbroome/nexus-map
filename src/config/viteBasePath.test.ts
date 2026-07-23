import { describe, expect, it } from "vitest";
import { resolveViteBasePath } from "./viteBasePath";

describe("resolveViteBasePath", () => {
  it("uses / for local development builds", () => {
    expect(resolveViteBasePath()).toBe("/");
    expect(
      resolveViteBasePath({
        githubActions: "false",
        githubRepository: "owner/repo",
      }),
    ).toBe("/");
  });

  it("uses /repository-name/ for GitHub Actions project Pages sites", () => {
    expect(
      resolveViteBasePath({
        githubActions: "true",
        githubRepository: "kevinbroome/nexus-map",
      }),
    ).toBe("/nexus-map/");
  });

  it("uses / for user Pages repositories named owner.github.io", () => {
    expect(
      resolveViteBasePath({
        githubActions: "true",
        githubRepository: "kevinbroome/kevinbroome.github.io",
      }),
    ).toBe("/");
  });
});
