import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppEnvironment } from "../config/environmentTypes";
import type { NexusDatabase } from "../supabase/database.types";
import { LocalWorldRepository } from "./localWorldRepository";
import { RepositoryConfigurationError } from "./repositoryErrors";
import { SupabaseWorldRepository } from "./supabaseWorldRepository";
import type { RepositoryMode, WorldRepository } from "./worldRepository";

export interface CreateWorldRepositoryOptions {
  cloudEnabled?: boolean;
}

export function createWorldRepository(
  environment: AppEnvironment,
  client?: SupabaseClient<NexusDatabase> | null,
  options?: CreateWorldRepositoryOptions,
): WorldRepository {
  return createWorldRepositoryForMode(
    environment.repositoryMode,
    environment,
    client,
    options,
  );
}

export function createWorldRepositoryForMode(
  mode: RepositoryMode,
  environment: AppEnvironment,
  client?: SupabaseClient<NexusDatabase> | null,
  options?: CreateWorldRepositoryOptions,
): WorldRepository {
  const cloudEnabled =
    options?.cloudEnabled ?? mode === "supabase";

  if (cloudEnabled) {
    if (!environment.supabase) {
      if (import.meta.env.PROD) {
        throw new RepositoryConfigurationError(
          "Supabase repository mode requires VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.",
        );
      }

      console.warn(
        "[nexus-map] Supabase repository mode requested but configuration is missing. Falling back to local repository.",
      );
      return new LocalWorldRepository();
    }

    if (!client) {
      if (import.meta.env.PROD) {
        throw new RepositoryConfigurationError(
          "Supabase client is unavailable because configuration is missing.",
        );
      }

      console.warn(
        "[nexus-map] Supabase repository requested but the client is unavailable. Falling back to local repository.",
      );
      return new LocalWorldRepository();
    }

    return new SupabaseWorldRepository(client);
  }

  return new LocalWorldRepository();
}
