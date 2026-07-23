import type { WorldState } from "../world/worldTypes";

export interface StoredWorld {
  world: WorldState;
  revision: number;
  source: "local" | "cloud";
  savedAt: string;
}

export interface SaveWorldOptions {
  expectedRevision?: number;
}

export interface WorldSummary {
  id: string;
  name: string;
  revision: number;
  updatedAt: string;
  source: "local" | "cloud";
}

export interface WorldRepository {
  listWorlds(): Promise<WorldSummary[]>;

  loadWorld(worldId: string): Promise<StoredWorld | null>;

  createWorld(world: WorldState): Promise<StoredWorld>;

  saveWorld(
    worldId: string,
    world: WorldState,
    options?: SaveWorldOptions,
  ): Promise<StoredWorld>;

  deleteWorld(worldId: string): Promise<void>;
}

export type RepositoryMode = "local" | "supabase";
