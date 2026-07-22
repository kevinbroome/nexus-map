import { getTileId, parseTileId } from "../../world/coordinates";

export function compareTileIds(firstId: string, secondId: string): number {
  const first = parseTileId(firstId);
  const second = parseTileId(secondId);

  if (first.y !== second.y) {
    return first.y - second.y;
  }

  return first.x - second.x;
}

export function sortTileIds(tileIds: string[]): string[] {
  return [...tileIds].sort(compareTileIds);
}

export function dedupeTileIds(tileIds: string[]): string[] {
  return sortTileIds([...new Set(tileIds)]);
}

export function manhattanDistance(
  firstId: string,
  secondId: string,
): number {
  const first = parseTileId(firstId);
  const second = parseTileId(secondId);
  return Math.abs(first.x - second.x) + Math.abs(first.y - second.y);
}

export function chebyshevDistance(
  firstId: string,
  secondId: string,
): number {
  const first = parseTileId(firstId);
  const second = parseTileId(secondId);
  return Math.max(
    Math.abs(first.x - second.x),
    Math.abs(first.y - second.y),
  );
}

export function distanceBetween(
  firstId: string,
  secondId: string,
  metric: "manhattan" | "chebyshev" = "manhattan",
): number {
  return metric === "manhattan"
    ? manhattanDistance(firstId, secondId)
    : chebyshevDistance(firstId, secondId);
}

export function coordinateIds(
  coordinates: Array<{ x: number; y: number }>,
): string[] {
  return sortTileIds(coordinates.map((coordinate) => getTileId(coordinate.x, coordinate.y)));
}
