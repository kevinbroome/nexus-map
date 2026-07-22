import type { MapTile, WorldState } from "./worldTypes";

export function getTileId(x: number, y: number): string {
  return `${x},${y}`;
}

export function parseTileId(tileId: string): { x: number; y: number } {
  const separatorIndex = tileId.indexOf(",");

  if (separatorIndex === -1) {
    throw new Error(`Invalid tile id: "${tileId}".`);
  }

  const x = Number(tileId.slice(0, separatorIndex));
  const y = Number(tileId.slice(separatorIndex + 1));

  if (Number.isNaN(x) || Number.isNaN(y)) {
    throw new Error(`Invalid tile id: "${tileId}".`);
  }

  return { x, y };
}

export function tileExists(world: WorldState, x: number, y: number): boolean {
  return world.tiles[getTileId(x, y)] !== undefined;
}

export function getTileAt(
  world: WorldState,
  x: number,
  y: number,
): MapTile | undefined {
  return world.tiles[getTileId(x, y)];
}

export function getExistingTiles(world: WorldState): MapTile[] {
  return Object.values(world.tiles);
}
