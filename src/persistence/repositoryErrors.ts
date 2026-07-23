export type RepositoryErrorCode =
  | "world-not-found"
  | "revision-conflict"
  | "authentication-required"
  | "persistence-unavailable"
  | "invalid-world"
  | "unsupported-world-version"
  | "repository-configuration"
  | "unknown";

export interface RepositoryErrorDetails {
  worldId?: string;
  expectedRevision?: number;
  actualRevision?: number;
  [key: string]: unknown;
}

export class RepositoryError extends Error {
  readonly code: RepositoryErrorCode;
  readonly details?: RepositoryErrorDetails;

  constructor(
    code: RepositoryErrorCode,
    message: string,
    options?: { cause?: unknown; details?: RepositoryErrorDetails },
  ) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.name = "RepositoryError";
    this.code = code;
    this.details = options?.details;
  }
}

export class WorldNotFoundError extends RepositoryError {
  constructor(worldId: string, options?: { cause?: unknown }) {
    super("world-not-found", `World "${worldId}" was not found.`, {
      cause: options?.cause,
      details: { worldId },
    });
    this.name = "WorldNotFoundError";
  }
}

export class RevisionConflictError extends RepositoryError {
  constructor(
    worldId: string,
    expectedRevision: number,
    actualRevision: number,
    options?: { cause?: unknown },
  ) {
    super(
      "revision-conflict",
      `World "${worldId}" changed before it could be saved.`,
      {
        cause: options?.cause,
        details: { worldId, expectedRevision, actualRevision },
      },
    );
    this.name = "RevisionConflictError";
  }
}

export class AuthenticationRequiredError extends RepositoryError {
  constructor(message = "Sign in is required to use cloud persistence.") {
    super("authentication-required", message);
    this.name = "AuthenticationRequiredError";
  }
}

export class PersistenceUnavailableError extends RepositoryError {
  constructor(
    message = "Persistence is unavailable right now.",
    options?: { cause?: unknown },
  ) {
    super("persistence-unavailable", message, { cause: options?.cause });
    this.name = "PersistenceUnavailableError";
  }
}

export class InvalidWorldError extends RepositoryError {
  constructor(message: string, options?: { cause?: unknown }) {
    super("invalid-world", message, { cause: options?.cause });
    this.name = "InvalidWorldError";
  }
}

export class UnsupportedWorldVersionError extends RepositoryError {
  constructor(message: string, options?: { cause?: unknown }) {
    super("unsupported-world-version", message, { cause: options?.cause });
    this.name = "UnsupportedWorldVersionError";
  }
}

export class RepositoryConfigurationError extends RepositoryError {
  constructor(message: string, options?: { cause?: unknown }) {
    super("repository-configuration", message, { cause: options?.cause });
    this.name = "RepositoryConfigurationError";
  }
}

export class UnknownRepositoryError extends RepositoryError {
  constructor(message: string, options?: { cause?: unknown }) {
    super("unknown", message, { cause: options?.cause });
    this.name = "UnknownRepositoryError";
  }
}

export function isRepositoryError(error: unknown): error is RepositoryError {
  return error instanceof RepositoryError;
}

export function mapParseError(error: unknown): RepositoryError {
  if (!(error instanceof Error)) {
    return new UnknownRepositoryError("The saved world could not be loaded.");
  }

  if (error.message.includes("Unsupported world version")) {
    return new UnsupportedWorldVersionError(error.message, { cause: error });
  }

  return new InvalidWorldError(error.message, { cause: error });
}

export function getUserFacingRepositoryMessage(
  error: unknown,
  fallbackMessage: string,
): string {
  if (error instanceof RepositoryError) {
    return error.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallbackMessage;
}

export function logRepositoryError(error: unknown): void {
  if (!import.meta.env.DEV) {
    return;
  }

  if (error instanceof RepositoryError && error.cause) {
    console.error(`[repository:${error.code}]`, error.message, error.cause);
    return;
  }

  if (error instanceof RepositoryError) {
    console.error(`[repository:${error.code}]`, error.message);
    return;
  }

  console.error("[repository:unknown]", error);
}
