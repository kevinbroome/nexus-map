import type { AppEnvironment } from "./environmentTypes";
import { describeEnvironment } from "./environment";
import { resolveApplicationBaseUrl } from "./applicationUrl";

export function describeRuntimeDiagnostics(): string[] {
  return [
    `Runtime: ${import.meta.env.PROD ? "Production" : "Development"}`,
    `Base URL: ${import.meta.env.BASE_URL}`,
  ];
}

export function describeAuthRedirectDiagnostics(origin?: string): string[] {
  if (!origin) {
    return [];
  }

  return [
    `Auth redirect URL: ${resolveApplicationBaseUrl(origin)}`,
  ];
}

export function describeDeploymentDiagnostics(
  environment: AppEnvironment,
  origin?: string,
): string[] {
  return [
    ...describeRuntimeDiagnostics(),
    ...describeEnvironment(environment),
    ...describeAuthRedirectDiagnostics(origin),
  ];
}
