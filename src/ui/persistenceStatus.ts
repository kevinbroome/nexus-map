import type { AppEnvironment } from "../config/environmentTypes";

export type PersistenceStatus =
  | "local-idle"
  | "local-saving"
  | "local-saved"
  | "local-failed"
  | "cloud-connected"
  | "cloud-saving"
  | "cloud-saved"
  | "offline"
  | "conflict"
  | "auth-required";

const STATUS_LABELS: Record<PersistenceStatus, string> = {
  "local-idle": "Local save",
  "local-saving": "Saving…",
  "local-saved": "Saved locally",
  "local-failed": "Save failed",
  "cloud-connected": "Cloud connected",
  "cloud-saving": "Cloud saving…",
  "cloud-saved": "Cloud saved",
  offline: "Offline",
  conflict: "Conflict detected",
  "auth-required": "Authentication required",
};

export function getInitialPersistenceStatus(
  environment: AppEnvironment,
  options?: { cloudActive?: boolean },
): PersistenceStatus {
  if (environment.repositoryMode === "supabase") {
    return options?.cloudActive ? "cloud-connected" : "auth-required";
  }

  return "local-idle";
}

export function resolveSavingStatus(
  environment: AppEnvironment,
  cloudActive: boolean,
): PersistenceStatus {
  if (environment.repositoryMode === "supabase" && cloudActive) {
    return "cloud-saving";
  }

  return "local-saving";
}

export function resolveSavedStatus(
  environment: AppEnvironment,
  cloudActive: boolean,
): PersistenceStatus {
  if (environment.repositoryMode === "supabase" && cloudActive) {
    return "cloud-saved";
  }

  return "local-saved";
}

export function resolveFailedStatus(
  environment: AppEnvironment,
  error: unknown,
  cloudActive: boolean,
): PersistenceStatus {
  if (
    error instanceof Error &&
    error.message.includes("changed elsewhere")
  ) {
    return "conflict";
  }

  if (environment.repositoryMode === "supabase" && !cloudActive) {
    return "auth-required";
  }

  return "local-failed";
}

export function formatPersistenceStatus(status: PersistenceStatus): string {
  return STATUS_LABELS[status];
}

export function persistenceStatusToDataset(status: PersistenceStatus): string {
  return status;
}
