import { getExistingTiles } from "./coordinates";
import type { TerrainType, WorldState } from "./worldTypes";

const PRODUCTIVE_TERRAINS: TerrainType[] = ["grassland", "forest"];

export function getWorldTileCount(world: WorldState): number {
  return getExistingTiles(world).length;
}

export function countTerrainTiles(
  world: WorldState,
  terrains: TerrainType | TerrainType[],
): number {
  const allowed = Array.isArray(terrains) ? terrains : [terrains];

  return getExistingTiles(world).filter((tile) =>
    allowed.includes(tile.terrain),
  ).length;
}

export function hasTerrain(world: WorldState, terrain: TerrainType): boolean {
  return countTerrainTiles(world, terrain) > 0;
}

export function countProductiveTerrainTiles(world: WorldState): number {
  return countTerrainTiles(world, PRODUCTIVE_TERRAINS);
}

export function countSettlementTiles(world: WorldState): number {
  return getExistingTiles(world).filter((tile) => tile.settlement !== undefined)
    .length;
}
