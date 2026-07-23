import {
  RepositoryConfigurationError,
  UnsupportedWorldVersionError,
} from "../persistence/repositoryErrors";
import type { AppEnvironment, RepositoryMode } from "./environmentTypes";

const DEFAULT_REPOSITORY_MODE: RepositoryMode = "local";

function trimValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function readRepositoryMode(): RepositoryMode {
  const raw = trimValue(import.meta.env.VITE_WORLD_REPOSITORY);

  if (raw === "supabase") {
    return "supabase";
  }

  if (raw && raw !== "local") {
    console.warn(
      `[nexus-map] Unknown VITE_WORLD_REPOSITORY value "${raw}". Using local mode.`,
    );
  }

  return DEFAULT_REPOSITORY_MODE;
}

function readPublishableKey(): string | undefined {
  return (
    trimValue(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) ??
    trimValue(import.meta.env.VITE_SUPABASE_ANON_KEY)
  );
}

function validateSupabaseUrl(url: string): void {
  try {
    const parsed = new URL(url);

    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new RepositoryConfigurationError(
        "VITE_SUPABASE_URL must use http or https.",
      );
    }
  } catch (error) {
    if (error instanceof RepositoryConfigurationError) {
      throw error;
    }

    throw new RepositoryConfigurationError("VITE_SUPABASE_URL is not a valid URL.");
  }
}

export function loadEnvironment(): AppEnvironment {
  const repositoryMode = readRepositoryMode();
  const supabaseUrl = trimValue(import.meta.env.VITE_SUPABASE_URL);
  const publishableKey = readPublishableKey();

  if (import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY) {
    throw new RepositoryConfigurationError(
      "VITE_SUPABASE_SERVICE_ROLE_KEY must not be used in the browser application.",
    );
  }

  if (repositoryMode === "supabase") {
    if (!supabaseUrl || !publishableKey) {
      if (import.meta.env.PROD) {
        throw new RepositoryConfigurationError(
          "Supabase repository mode requires VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.",
        );
      }

      if (import.meta.env.DEV) {
        console.warn(
          "[nexus-map] Supabase mode requested but URL or publishable key is missing.",
        );
      }

      return { repositoryMode };
    }

    validateSupabaseUrl(supabaseUrl);

    return {
      repositoryMode,
      supabase: {
        url: supabaseUrl,
        publishableKey,
      },
    };
  }

  if (supabaseUrl || publishableKey) {
    if (supabaseUrl) {
      validateSupabaseUrl(supabaseUrl);
    }

    if (supabaseUrl && publishableKey) {
      return {
        repositoryMode,
        supabase: {
          url: supabaseUrl,
          publishableKey,
        },
      };
    }
  }

  return { repositoryMode };
}

export function describeEnvironment(environment: AppEnvironment): string[] {
  const lines = [
    `Repository mode: ${environment.repositoryMode === "supabase" ? "Supabase" : "Local"}`,
  ];

  if (environment.supabase) {
    lines.push("Supabase configuration: Present");
    lines.push(`Supabase URL host: ${new URL(environment.supabase.url).host}`);
  } else {
    lines.push("Supabase configuration: Missing");
  }

  return lines;
}

export function assertSupportedWorldVersionMessage(message: string): never {
  throw new UnsupportedWorldVersionError(message);
}
