import {
  DEFAULT_DECK_CONFIGURATION_ID,
  FIRST_ADVANCED_TEST_DECK,
} from "../deck/deckConfiguration";
import {
  createDeckFromConfiguration,
  createInitialDeck,
} from "../deck/createInitialDeck";
import { getAllCardDefinitions } from "../cards/cardRegistry";
import { getTileId } from "./coordinates";
import type { MapTile, WorldState } from "./worldTypes";
import { normalizeMapTile } from "./tileUtils";
import { GRID_HEIGHT, GRID_WIDTH } from "../map/mapConfig";

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

  const definitions = getAllCardDefinitions();

  return {
    version: 6,
    id,
    name,
    turn: 0,
    tiles,
    settlementRegions: {},
    travelRoutes: {},
    deck: createDeckFromConfiguration(
      FIRST_ADVANCED_TEST_DECK.manifest,
      definitions,
      buildInitialDeckSeed(id, now),
      0,
    ),
    deckConfigurationId: DEFAULT_DECK_CONFIGURATION_ID,
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
  deckConfigurationId: string | null = null,
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

  const definitions = getAllCardDefinitions();
  const seed = buildInitialDeckSeed(id, now);
  const deck =
    deckConfigurationId === DEFAULT_DECK_CONFIGURATION_ID
      ? createDeckFromConfiguration(
          FIRST_ADVANCED_TEST_DECK.manifest,
          definitions,
          seed,
          0,
        )
      : createInitialDeck(definitions, seed, 0);

  return {
    version: 6,
    id,
    name,
    turn: 0,
    tiles,
    settlementRegions: {},
    travelRoutes: {},
    deck,
    deckConfigurationId: deckConfigurationId ?? DEFAULT_DECK_CONFIGURATION_ID,
    history: [],
    createdAt: now,
    updatedAt: now,
  };
}
