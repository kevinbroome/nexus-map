function normalizeBasePath(baseUrl: string): string {
  if (!baseUrl) {
    return "/";
  }

  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}

/**
 * Resolves the application root URL from an origin and Vite base path.
 * Useful in tests without a browser `window`.
 */
export function resolveApplicationBaseUrl(
  origin: string,
  baseUrl: string = import.meta.env.BASE_URL,
): string {
  return new URL(normalizeBasePath(baseUrl), origin).href;
}

export function getApplicationBaseUrl(): string {
  if (typeof window === "undefined") {
    throw new Error("getApplicationBaseUrl requires a browser environment.");
  }

  return resolveApplicationBaseUrl(window.location.origin);
}

export function getAuthenticationRedirectUrl(): string {
  const baseUrl = getApplicationBaseUrl();
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}
