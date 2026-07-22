export type TerrainType =
  | "empty"
  | "water"
  | "grassland"
  | "forest"
  | "mountain"
  | "urban"
  | "chasm";

export type SettlementType = "village" | "town" | "city";

export interface Settlement {
  type: SettlementType;
  name?: string;
}

export interface MapTile {
  id: string;
  x: number;
  y: number;
  terrain: TerrainType;
  settlement?: Settlement;
  tags: string[];
  properties: Record<string, string | number | boolean>;
}

export interface TileChange {
  tileId: string;
  before: MapTile | null;
  after: MapTile;
}

export interface WorldAction {
  id: string;
  sequence: number;
  cardId: string;
  cardName: string;
  targetIds: string[];
  appliedAt: string;
  changes: TileChange[];
  randomSeed: string;
  resolvedValues: Record<string, unknown>;
}

export interface WorldState {
  version: 2;
  id: string;
  name: string;
  tiles: Record<string, MapTile>;
  history: WorldAction[];
  createdAt: string;
  updatedAt: string;
}

export const CURRENT_WORLD_VERSION = 2 as const;

export type LegacyWorldStateV1 = {
  version: 1;
  id: string;
  name: string;
  width: number;
  height: number;
  tiles: Record<string, MapTile>;
  history: WorldAction[];
  createdAt: string;
  updatedAt: string;
};
