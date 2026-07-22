import type { WorldBounds } from "../world/bounds";
import { TILE_SIZE } from "./mapConfig";

export function worldBoundsToLeafletBounds(
  bounds: WorldBounds,
  paddingTiles = 1,
): [[number, number], [number, number]] {
  const southWest: [number, number] = [
    (bounds.minY - paddingTiles) * TILE_SIZE,
    (bounds.minX - paddingTiles) * TILE_SIZE,
  ];
  const northEast: [number, number] = [
    (bounds.maxY + 1 + paddingTiles) * TILE_SIZE,
    (bounds.maxX + 1 + paddingTiles) * TILE_SIZE,
  ];

  return [southWest, northEast];
}

export function getRenderableTileIds(world: {
  tiles: Record<string, unknown>;
}): string[] {
  return Object.keys(world.tiles);
}
