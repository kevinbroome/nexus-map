import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AppEnvironment } from "../config/environmentTypes";
import type { NexusDatabase } from "./database.types";
import { RepositoryConfigurationError } from "../persistence/repositoryErrors";

let cachedClient: SupabaseClient<NexusDatabase> | null = null;
let cachedSignature: string | null = null;

function buildSignature(environment: AppEnvironment): string | null {
  if (!environment.supabase) {
    return null;
  }

  return `${environment.supabase.url}:${environment.supabase.publishableKey.length}`;
}

export function createSupabaseClient(
  environment: AppEnvironment,
): SupabaseClient<NexusDatabase> | null {
  if (!environment.supabase) {
    return null;
  }

  const signature = buildSignature(environment);

  if (cachedClient && cachedSignature === signature) {
    return cachedClient;
  }

  cachedClient = createClient<NexusDatabase>(
    environment.supabase.url,
    environment.supabase.publishableKey,
  );
  cachedSignature = signature;

  return cachedClient;
}

export function getSupabaseClient(): SupabaseClient<NexusDatabase> | null {
  return cachedClient;
}

export function requireSupabaseClient(
  environment: AppEnvironment,
): SupabaseClient<NexusDatabase> {
  const client = createSupabaseClient(environment);

  if (!client) {
    throw new RepositoryConfigurationError(
      "Supabase client is unavailable because configuration is missing.",
    );
  }

  return client;
}

export function resetSupabaseClientForTests(): void {
  cachedClient = null;
  cachedSignature = null;
}
