import type { WorldState } from "../world/worldTypes";
import { mapParseError, PersistenceUnavailableError } from "./repositoryErrors";
import { parseWorld, serializeWorld } from "./worldMigration";
import type { StoredWorld } from "./worldRepository";

const STORAGE_KEY = "nexus-map-world";
const META_STORAGE_KEY = "nexus-map-world-meta";

interface LocalWorldMeta {
  revision: number;
  savedAt: string;
}

function readMeta(): LocalWorldMeta | null {
  const rawMeta = localStorage.getItem(META_STORAGE_KEY);

  if (!rawMeta) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawMeta) as LocalWorldMeta;

    if (
      typeof parsed.revision !== "number" ||
      typeof parsed.savedAt !== "string"
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function writeMeta(meta: LocalWorldMeta): void {
  localStorage.setItem(META_STORAGE_KEY, JSON.stringify(meta));
}

/** @deprecated Use WorldRepository via persistCommittedWorld. Kept for legacy tests. */
export function saveWorld(world: WorldState): void {
  try {
    localStorage.setItem(STORAGE_KEY, serializeWorld(world));
    writeMeta({
      revision: readMeta()?.revision ?? 1,
      savedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Failed to save world:", error);
    throw new Error("The world could not be saved.");
  }
}

/** @deprecated Use WorldRepository.loadWorld. Kept for legacy tests. */
export function loadWorld(): WorldState | null {
  const storedWorld = localStorage.getItem(STORAGE_KEY);

  if (!storedWorld) {
    return null;
  }

  return parseWorld(storedWorld);
}

export function hasSavedWorld(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== null;
}

export function clearSavedWorld(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(META_STORAGE_KEY);
}

export async function loadStoredWorldPayload(): Promise<StoredWorld | null> {
  await Promise.resolve();

  const storedWorld = localStorage.getItem(STORAGE_KEY);

  if (!storedWorld) {
    return null;
  }

  try {
    const world = parseWorld(storedWorld);
    const meta = readMeta();

    return {
      world,
      revision: meta?.revision ?? 1,
      source: "local",
      savedAt: meta?.savedAt ?? world.updatedAt,
    };
  } catch (error) {
    throw mapParseError(error);
  }
}

export async function saveStoredWorldPayload(stored: StoredWorld): Promise<void> {
  await Promise.resolve();

  try {
    localStorage.setItem(STORAGE_KEY, serializeWorld(stored.world));
    writeMeta({
      revision: stored.revision,
      savedAt: stored.savedAt,
    });
  } catch (error) {
    console.error("Failed to save world:", error);
    throw new PersistenceUnavailableError("The world could not be saved.", {
      cause: error,
    });
  }
}
