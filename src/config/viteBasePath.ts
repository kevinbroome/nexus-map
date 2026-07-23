export interface ViteBasePathOptions {
  /** Set to "true" only for production GitHub Pages builds, not during CI tests. */
  githubPagesBuild?: string;
  githubRepository?: string;
}

/**
 * Resolves the Vite `base` path for local dev, GitHub Pages project sites,
 * and user/org Pages repos (`<owner>.github.io`).
 */
export function resolveViteBasePath(options: ViteBasePathOptions = {}): string {
  const isGitHubPages = options.githubPagesBuild === "true";
  const repositoryName = options.githubRepository?.split("/")[1];

  if (!isGitHubPages || !repositoryName) {
    return "/";
  }

  if (/^[\w-]+\.github\.io$/i.test(repositoryName)) {
    return "/";
  }

  return `/${repositoryName}/`;
}
