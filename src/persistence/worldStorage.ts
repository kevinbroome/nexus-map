import type { WorldState } from "../world/worldState";

// IndexedDB persistence will be added in a later milestone.

export async function saveWorld(_world: WorldState): Promise<void> {
  // TODO: persist world state
}

export async function loadWorld(): Promise<WorldState | null> {
  return null;
}
