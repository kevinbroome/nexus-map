import type { WorldState } from "../world/worldTypes";
import {
  PersistenceUnavailableError,
  RevisionConflictError,
  WorldNotFoundError,
} from "./repositoryErrors";
import type {
  SaveWorldOptions,
  StoredWorld,
  WorldRepository,
  WorldSummary,
} from "./worldRepository";

export interface InMemoryWorldRepositoryOptions {
  failNextSave?: boolean;
}

export class InMemoryWorldRepository implements WorldRepository {
  private readonly worlds = new Map<string, StoredWorld>();
  private failNextSave = false;

  configure(options: InMemoryWorldRepositoryOptions): void {
    this.failNextSave = options.failNextSave ?? false;
  }

  simulatePersistenceFailure(enabled = true): void {
    this.failNextSave = enabled;
  }

  async listWorlds(): Promise<WorldSummary[]> {
    return [...this.worlds.values()]
      .map((stored) => ({
        id: stored.world.id,
        name: stored.world.name,
        revision: stored.revision,
        updatedAt: stored.world.updatedAt,
        source: stored.source,
      }))
      .sort((left, right) => left.id.localeCompare(right.id));
  }

  async loadWorld(worldId: string): Promise<StoredWorld | null> {
    return this.worlds.get(worldId) ?? null;
  }

  async createWorld(world: WorldState): Promise<StoredWorld> {
    const stored: StoredWorld = {
      world,
      revision: 1,
      source: "local",
      savedAt: new Date().toISOString(),
    };

    this.worlds.set(world.id, stored);
    return stored;
  }

  async saveWorld(
    worldId: string,
    world: WorldState,
    options?: SaveWorldOptions,
  ): Promise<StoredWorld> {
    if (this.failNextSave) {
      this.failNextSave = false;
      throw new PersistenceUnavailableError("Simulated persistence failure.");
    }

    const existing = this.worlds.get(worldId);

    if (!existing) {
      throw new WorldNotFoundError(worldId);
    }

    if (
      options?.expectedRevision !== undefined &&
      options.expectedRevision !== existing.revision
    ) {
      throw new RevisionConflictError(
        worldId,
        options.expectedRevision,
        existing.revision,
      );
    }

    const stored: StoredWorld = {
      world,
      revision: existing.revision + 1,
      source: existing.source,
      savedAt: new Date().toISOString(),
    };

    this.worlds.set(worldId, stored);
    return stored;
  }

  async deleteWorld(worldId: string): Promise<void> {
    this.worlds.delete(worldId);
  }
}
