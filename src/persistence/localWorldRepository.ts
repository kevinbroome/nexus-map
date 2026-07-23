import type { WorldState } from "../world/worldTypes";
import {
  clearSavedWorld,
  loadStoredWorldPayload,
  saveStoredWorldPayload,
} from "./worldStorage";
import {
  RevisionConflictError,
  WorldNotFoundError,
} from "./repositoryErrors";
import type {
  SaveWorldOptions,
  StoredWorld,
  WorldRepository,
  WorldSummary,
} from "./worldRepository";

function toSummary(stored: StoredWorld): WorldSummary {
  return {
    id: stored.world.id,
    name: stored.world.name,
    revision: stored.revision,
    updatedAt: stored.world.updatedAt,
    source: stored.source,
  };
}

export class LocalWorldRepository implements WorldRepository {
  async listWorlds(): Promise<WorldSummary[]> {
    const stored = await loadStoredWorldPayload();

    if (!stored) {
      return [];
    }

    return [toSummary(stored)];
  }

  async loadWorld(worldId: string): Promise<StoredWorld | null> {
    const stored = await loadStoredWorldPayload();

    if (!stored) {
      return null;
    }

    if (stored.world.id !== worldId) {
      throw new WorldNotFoundError(worldId);
    }

    return stored;
  }

  async createWorld(world: WorldState): Promise<StoredWorld> {
    clearSavedWorld();

    const stored: StoredWorld = {
      world,
      revision: 1,
      source: "local",
      savedAt: new Date().toISOString(),
    };

    try {
      await saveStoredWorldPayload(stored);
    } catch (error) {
      throw error;
    }

    return stored;
  }

  async saveWorld(
    worldId: string,
    world: WorldState,
    options?: SaveWorldOptions,
  ): Promise<StoredWorld> {
    const existing = await loadStoredWorldPayload();

    if (!existing) {
      if (world.id !== worldId) {
        throw new WorldNotFoundError(worldId);
      }

      return this.createWorld(world);
    }

    if (existing.world.id !== worldId) {
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
      source: "local",
      savedAt: new Date().toISOString(),
    };

    await saveStoredWorldPayload(stored);

    return stored;
  }

  async deleteWorld(worldId: string): Promise<void> {
    const existing = await loadStoredWorldPayload();

    if (!existing) {
      return;
    }

    if (existing.world.id !== worldId) {
      throw new WorldNotFoundError(worldId);
    }

    clearSavedWorld();
  }
}
