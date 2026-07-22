export type TerrainType = "empty" | "water" | "forest";

export type SettlementType = "village";

export type TileState = {
  terrain: TerrainType;
  settlement?: SettlementType;
};
