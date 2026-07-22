export type TerrainType =
  | "empty"
  | "water"
  | "grassland"
  | "forest"
  | "mountain"
  | "urban";

export interface MapTile {
  id: string;
  x: number;
  y: number;
  terrain: TerrainType;
  settlement?: {
    type: "village" | "town" | "city";
    name?: string;
  };
}

export interface TileChange {
  tileId: string;
  before: MapTile;
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
}

export interface WorldState {
  version: 1;
  id: string;
  name: string;
  width: number;
  height: number;
  tiles: Record<string, MapTile>;
  history: WorldAction[];
  createdAt: string;
  updatedAt: string;
}

export const CURRENT_WORLD_VERSION = 1 as const;
