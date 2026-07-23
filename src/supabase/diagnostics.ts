import type { AppEnvironment } from "../config/environmentTypes";
import { describeEnvironment } from "../config/environment";
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
  return [
    ...describeEnvironment(environment),
    `Supabase client: ${diagnostics.supabaseClient}`,
    `Authenticated user: ${diagnostics.authenticatedUser}`,
    `Cloud world repository: ${diagnostics.cloudWorldRepository}`,
  ].join("\n");
}
