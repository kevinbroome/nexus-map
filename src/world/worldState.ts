import { GRID_HEIGHT, GRID_WIDTH } from "../map/mapConfig";
import { cards } from "../cards/cardDefinitions";
import { createInitialDeck } from "../deck/createInitialDeck";
import { getTileId } from "./coordinates";
import type { MapTile, WorldState } from "./worldTypes";
import { normalizeMapTile } from "./tileUtils";

function buildInitialDeckSeed(worldId: string, createdAt: string): string {
  return `initial:${worldId}:${createdAt}`;
}

export function createStarterWorld(name: string): WorldState {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const tiles: Record<string, MapTile> = {};

  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      const tileId = getTileId(x, y);
      tiles[tileId] = normalizeMapTile({
        id: tileId,
        x,
        y,
        terrain: "empty",
        tags: [],
        properties: {},
      });
    }
  }

  return {
    version: 5,
    id,
    name,
    turn: 0,
    tiles,
    settlementRegions: {},
    travelRoutes: {},
    deck: createInitialDeck(cards, buildInitialDeckSeed(id, now), 0),
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
  const id = "test-world-id";
  const tiles: Record<string, MapTile> = {};

  for (let y = originY; y < originY + height; y++) {
    for (let x = originX; x < originX + width; x++) {
      const tileId = getTileId(x, y);
      tiles[tileId] = normalizeMapTile({
        id: tileId,
        x,
        y,
        terrain: "empty",
        tags: [],
        properties: {},
      });
    }
  }

  return {
    version: 5,
    id,
    name,
    turn: 0,
    tiles,
    settlementRegions: {},
    travelRoutes: {},
    deck: createInitialDeck(cards, buildInitialDeckSeed(id, now), 0),
    history: [],
    createdAt: now,
    updatedAt: now,
  };
}
