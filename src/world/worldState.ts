import { GRID_HEIGHT, GRID_WIDTH } from "../map/mapConfig";
import { getTileId } from "./coordinates";
import type { MapTile, WorldState } from "./worldTypes";
import { normalizeMapTile } from "./tileUtils";

export function createStarterWorld(name: string): WorldState {
  const now = new Date().toISOString();
  const tiles: Record<string, MapTile> = {};

  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      const id = getTileId(x, y);
      tiles[id] = normalizeMapTile({
        id,
        x,
        y,
        terrain: "empty",
        tags: [],
        properties: {},
      });
    }
  }

  return {
    version: 4,
    id: crypto.randomUUID(),
    name,
    turn: 0,
    tiles,
    settlementRegions: {},
    travelRoutes: {},
    history: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function createTestWorld(
  name: string,
  width: number,
  height: number,
  originX = 0,
  originY = 0,
): WorldState {
  const now = new Date().toISOString();
  const tiles: Record<string, MapTile> = {};

  for (let y = originY; y < originY + height; y++) {
    for (let x = originX; x < originX + width; x++) {
      const id = getTileId(x, y);
      tiles[id] = normalizeMapTile({
        id,
        x,
        y,
        terrain: "empty",
        tags: [],
        properties: {},
      });
    }
  }

  return {
    version: 4,
    id: "test-world-id",
    name,
    turn: 0,
    tiles,
    settlementRegions: {},
    travelRoutes: {},
    history: [],
    createdAt: now,
    updatedAt: now,
  };
}
