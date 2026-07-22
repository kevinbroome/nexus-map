import { type MapTile, type WorldState } from "./worldTypes";
import { normalizeMapTile } from "./tileUtils";

export function createTileId(x: number, y: number): string {
  return `${x},${y}`;
}

export function createWorld(
  name: string,
  width: number,
  height: number,
): WorldState {
  const now = new Date().toISOString();
  const tiles: Record<string, MapTile> = {};

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const id = createTileId(x, y);
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
    version: 1,
    id: crypto.randomUUID(),
    name,
    width,
    height,
    tiles,
    history: [],
    createdAt: now,
    updatedAt: now,
  };
}
