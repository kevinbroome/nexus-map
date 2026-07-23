import type { AppEnvironment } from "../config/environmentTypes";
import { describeEnvironment } from "../config/environment";
import { describeDeploymentDiagnostics } from "../config/deploymentDiagnostics";
import { createSupabaseClient, getSupabaseClient } from "./client";
import { formatAuthUserLabel } from "./auth";

export interface CloudDiagnostics {
  repositoryMode: string;
  supabaseConfiguration: "Present" | "Missing";
  supabaseClient: "Initialised" | "Unavailable";
  authenticatedUser: string;
  cloudWorldRepository: string;
}

export async function getCloudDiagnostics(
  environment: AppEnvironment,
): Promise<CloudDiagnostics> {
  const client = createSupabaseClient(environment);
  let authenticatedUser = "None";

  if (client) {
    const { data } = await client.auth.getSession();
    authenticatedUser = formatAuthUserLabel(data.session?.user ?? null);
  }

  const cloudEnabled =
    environment.repositoryMode === "supabase" && authenticatedUser !== "None";

  return {
    repositoryMode:
      environment.repositoryMode === "supabase" ? "Supabase" : "Local",
    supabaseConfiguration: environment.supabase ? "Present" : "Missing",
    supabaseClient: getSupabaseClient() ? "Initialised" : "Unavailable",
    authenticatedUser,
    cloudWorldRepository: cloudEnabled
      ? "Enabled for signed-in user"
      : environment.repositoryMode === "supabase"
        ? "Waiting for sign-in"
        : "Not enabled (local mode)",
  };
}

export function formatCloudDiagnostics(
  environment: AppEnvironment,
  diagnostics: CloudDiagnostics,
): string {
  const origin =
    typeof window !== "undefined" ? window.location.origin : undefined;
  const environmentLines = import.meta.env.DEV
    ? describeDeploymentDiagnostics(environment, origin)
    : describeEnvironment(environment);

  return [
    ...environmentLines,
    `Supabase client: ${diagnostics.supabaseClient}`,
    `Authenticated user: ${diagnostics.authenticatedUser}`,
    `Cloud world repository: ${diagnostics.cloudWorldRepository}`,
  ].join("\n");
}
