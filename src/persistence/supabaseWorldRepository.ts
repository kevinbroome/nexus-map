import type { SupabaseClient } from "@supabase/supabase-js";
import type { WorldState } from "../world/worldTypes";
import { parseWorld } from "./worldMigration";
import {
  AuthenticationRequiredError,
  InvalidWorldError,
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
import type { NexusDatabase, WorldsInsert, WorldsRow, WorldsUpdate, Json } from "../supabase/database.types";

async function readAuthenticatedUserId(
  client: SupabaseClient<NexusDatabase>,
): Promise<string> {
  const { data, error } = await client.auth.getUser();

  if (error) {
    throw new PersistenceUnavailableError("Could not verify the signed-in user.", {
      cause: error,
    });
  }

  if (!data.user) {
    throw new AuthenticationRequiredError();
  }

  return data.user.id;
}

function mapWorldRow(row: WorldsRow): StoredWorld {
  try {
    const world = parseWorld(JSON.stringify(row.world_data));

    if (world.id !== row.id) {
      throw new InvalidWorldError("The cloud world record does not match its identifier.");
    }

    return {
      world,
      revision: row.revision,
      source: "cloud",
      savedAt: row.updated_at,
    };
  } catch (error) {
    if (error instanceof InvalidWorldError) {
      throw error;
    }

    if (error instanceof Error) {
      throw new InvalidWorldError(error.message, { cause: error });
    }

    throw new InvalidWorldError("The cloud world could not be loaded.");
  }
}

function toSummary(row: Pick<WorldsRow, "id" | "name" | "revision" | "updated_at">): WorldSummary {
  return {
    id: row.id,
    name: row.name,
    revision: row.revision,
    updatedAt: row.updated_at,
    source: "cloud",
  };
}

function mapSupabaseError(error: { code?: string; message: string }): Error {
  if (error.code === "PGRST116") {
    return new WorldNotFoundError("unknown");
  }

  return new PersistenceUnavailableError(
    "Cloud persistence is unavailable right now.",
    { cause: error },
  );
}

export class SupabaseWorldRepository implements WorldRepository {
  private readonly client: SupabaseClient<NexusDatabase>;

  constructor(client: SupabaseClient<NexusDatabase>) {
    this.client = client;
  }

  async listWorlds(): Promise<WorldSummary[]> {
    const userId = await readAuthenticatedUserId(this.client);

    const { data, error } = await this.client
      .from("worlds")
      .select("id, name, revision, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error) {
      throw mapSupabaseError(error);
    }

    return (data ?? []).map((row) => toSummary(row as WorldsRow));
  }

  async loadWorld(worldId: string): Promise<StoredWorld | null> {
    const userId = await readAuthenticatedUserId(this.client);

    const { data, error } = await this.client
      .from("worlds")
      .select("*")
      .eq("id", worldId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      throw mapSupabaseError(error);
    }

    if (!data) {
      return null;
    }

    return mapWorldRow(data as WorldsRow);
  }

  async createWorld(world: WorldState): Promise<StoredWorld> {
    const userId = await readAuthenticatedUserId(this.client);

    const insertRow: WorldsInsert = {
      id: world.id,
      user_id: userId,
      name: world.name,
      world_data: world as unknown as Json,
      world_version: world.version,
      revision: 1,
    };

    const { data, error } = await this.client
      .from("worlds")
      .insert(insertRow)
      .select("*")
      .single();

    if (error) {
      throw mapSupabaseError(error);
    }

    return mapWorldRow(data as WorldsRow);
  }

  async saveWorld(
    worldId: string,
    world: WorldState,
    options?: SaveWorldOptions,
  ): Promise<StoredWorld> {
    const userId = await readAuthenticatedUserId(this.client);

    const { data: existing, error: loadError } = await this.client
      .from("worlds")
      .select("revision")
      .eq("id", worldId)
      .eq("user_id", userId)
      .maybeSingle();

    if (loadError) {
      throw mapSupabaseError(loadError);
    }

    if (!existing) {
      if (world.id !== worldId) {
        throw new WorldNotFoundError(worldId);
      }

      return this.createWorld(world);
    }

    const currentRevision = existing.revision;

    if (
      options?.expectedRevision !== undefined &&
      options.expectedRevision !== currentRevision
    ) {
      throw new RevisionConflictError(
        worldId,
        options.expectedRevision,
        currentRevision,
      );
    }

    const nextRevision = currentRevision + 1;

    const updateRow: WorldsUpdate = {
      name: world.name,
      world_data: world as unknown as Json,
      world_version: world.version,
      revision: nextRevision,
    };

    const { data, error } = await this.client
      .from("worlds")
      .update(updateRow)
      .eq("id", worldId)
      .eq("user_id", userId)
      .eq("revision", currentRevision)
      .select("*")
      .maybeSingle();

    if (error) {
      throw mapSupabaseError(error);
    }

    if (!data) {
      const { data: latest } = await this.client
        .from("worlds")
        .select("revision")
        .eq("id", worldId)
        .eq("user_id", userId)
        .maybeSingle();

      throw new RevisionConflictError(
        worldId,
        currentRevision,
        latest?.revision ?? currentRevision,
      );
    }

    return mapWorldRow(data as WorldsRow);
  }

  async deleteWorld(worldId: string): Promise<void> {
    const userId = await readAuthenticatedUserId(this.client);

    const { error } = await this.client
      .from("worlds")
      .delete()
      .eq("id", worldId)
      .eq("user_id", userId);

    if (error) {
      throw mapSupabaseError(error);
    }
  }
}
