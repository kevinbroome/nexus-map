import type { WorldState } from "../world/worldTypes";
import { parseWorld, serializeWorld } from "./worldMigration";

const STORAGE_KEY = "nexus-map-world";

export function saveWorld(world: WorldState): void {
  try {
    localStorage.setItem(STORAGE_KEY, serializeWorld(world));
  } catch (error) {
    console.error("Failed to save world:", error);
    throw new Error("The world could not be saved.");
  }
}

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
}
