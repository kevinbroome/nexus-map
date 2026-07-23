import type { WorldState } from "../world/worldTypes";
import {
  getActiveStoredRevision,
  getWorldRepository,
  setActiveStoredRevision,
} from "./repositoryContext";
import {
  getUserFacingRepositoryMessage,
  logRepositoryError,
  PersistenceUnavailableError,
  RevisionConflictError,
} from "./repositoryErrors";

export interface PersistCommittedWorldOptions {
  failureMessage: string;
}

export async function persistCommittedWorld(
  world: WorldState,
  options: PersistCommittedWorldOptions,
): Promise<void> {
  const expectedRevision = getActiveStoredRevision();

  try {
    const stored = await getWorldRepository().saveWorld(world.id, world, {
      expectedRevision: expectedRevision ?? undefined,
    });
    setActiveStoredRevision(stored.revision);
  } catch (error) {
    logRepositoryError(error);

    if (error instanceof RevisionConflictError) {
      throw new Error(
        "This world changed elsewhere before it could be saved. Reload the page and try again.",
      );
    }

    if (error instanceof PersistenceUnavailableError) {
      throw new Error(options.failureMessage);
    }

    throw new Error(getUserFacingRepositoryMessage(error, options.failureMessage));
  }
}
