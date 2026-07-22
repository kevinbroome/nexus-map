import type { WorldState } from "./worldTypes";
import { getExistingTiles } from "./coordinates";

export interface WorldBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export function getWorldBounds(world: WorldState): WorldBounds | null {
  const tiles = getExistingTiles(world);

  if (tiles.length === 0) {
    return null;
  }

  let minX = tiles[0]!.x;
  let maxX = tiles[0]!.x;
  let minY = tiles[0]!.y;
  let maxY = tiles[0]!.y;

  for (const tile of tiles.slice(1)) {
    minX = Math.min(minX, tile.x);
    maxX = Math.max(maxX, tile.x);
    minY = Math.min(minY, tile.y);
    maxY = Math.max(maxY, tile.y);
  }

  return { minX, maxX, minY, maxY };
}

export function getWorldBoundsOrDefault(world: WorldState): WorldBounds {
  return (
    getWorldBounds(world) ?? {
      minX: 0,
      maxX: 0,
      minY: 0,
      maxY: 0,
    }
  );
}

export function boundsContainCoordinate(
  bounds: WorldBounds,
  x: number,
  y: number,
): boolean {
  return x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY;
}

export function expandBounds(
  bounds: WorldBounds,
  x: number,
  y: number,
): WorldBounds {
  return {
    minX: Math.min(bounds.minX, x),
    maxX: Math.max(bounds.maxX, x),
    minY: Math.min(bounds.minY, y),
    maxY: Math.max(bounds.maxY, y),
  };
}
