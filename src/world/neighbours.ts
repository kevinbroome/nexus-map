import { getTileAt, tileExists } from "./coordinates";
import type {
  MapTile,
  SettlementType,
  TerrainType,
  WorldState,
} from "./worldTypes";

export interface Coordinate {
  x: number;
  y: number;
}

export type NeighbourMode = "cardinal" | "diagonal" | "all";

export type ConnectionMode = "cardinal" | "all";

const CARDINAL_OFFSETS: readonly Coordinate[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

const DIAGONAL_OFFSETS: readonly Coordinate[] = [
  { x: 1, y: -1 },
  { x: 1, y: 1 },
  { x: -1, y: 1 },
  { x: -1, y: -1 },
];

function compareCoordinates(left: Coordinate, right: Coordinate): number {
  if (left.y !== right.y) {
    return left.y - right.y;
  }

  return left.x - right.x;
}

function compareTiles(left: MapTile, right: MapTile): number {
  return compareCoordinates(left, right);
}

function requireTile(world: WorldState, tileId: string): MapTile {
  const tile = world.tiles[tileId];

  if (!tile) {
    throw new Error(`Tile "${tileId}" does not exist.`);
  }

  return tile;
}

function offsetCoordinate(coordinate: Coordinate, offset: Coordinate): Coordinate {
  return {
    x: coordinate.x + offset.x,
    y: coordinate.y + offset.y,
  };
}

export function getNeighbourCoordinates(
  coordinate: Coordinate,
  mode: NeighbourMode,
): Coordinate[] {
  switch (mode) {
    case "cardinal":
      return CARDINAL_OFFSETS.map((offset) =>
        offsetCoordinate(coordinate, offset),
      );

    case "diagonal":
      return DIAGONAL_OFFSETS.map((offset) =>
        offsetCoordinate(coordinate, offset),
      );

    case "all":
      return [
        ...CARDINAL_OFFSETS.map((offset) => offsetCoordinate(coordinate, offset)),
        ...DIAGONAL_OFFSETS.map((offset) => offsetCoordinate(coordinate, offset)),
      ];

    default: {
      const unreachable: never = mode;
      throw new Error(`Unsupported neighbour mode: ${String(unreachable)}`);
    }
  }
}

export function getExistingNeighbours(
  world: WorldState,
  tileId: string,
  mode: NeighbourMode = "cardinal",
): MapTile[] {
  const tile = requireTile(world, tileId);
  const neighbours: MapTile[] = [];

  for (const coordinate of getNeighbourCoordinates(tile, mode)) {
    const neighbour = getTileAt(world, coordinate.x, coordinate.y);

    if (neighbour) {
      neighbours.push(neighbour);
    }
  }

  return neighbours;
}

export function getMissingNeighbourCoordinates(
  world: WorldState,
  tileId: string,
  mode: NeighbourMode = "cardinal",
): Coordinate[] {
  const tile = world.tiles[tileId];

  if (!tile) {
    return [];
  }

  return getNeighbourCoordinates(tile, mode).filter(
    (coordinate) => !tileExists(world, coordinate.x, coordinate.y),
  );
}

export function getCoordinatesWithinDistance(
  origin: Coordinate,
  distance: number,
  options: {
    metric?: "manhattan" | "chebyshev";
    includeOrigin?: boolean;
  } = {},
): Coordinate[] {
  if (distance < 0) {
    throw new Error("Distance must be zero or greater.");
  }

  const metric = options.metric ?? "manhattan";
  const includeOrigin = options.includeOrigin ?? false;
  const coordinates: Coordinate[] = [];

  for (let dy = -distance; dy <= distance; dy++) {
    for (let dx = -distance; dx <= distance; dx++) {
      if (!includeOrigin && dx === 0 && dy === 0) {
        continue;
      }

      const distanceFromOrigin =
        metric === "manhattan"
          ? Math.abs(dx) + Math.abs(dy)
          : Math.max(Math.abs(dx), Math.abs(dy));

      if (distanceFromOrigin > distance) {
        continue;
      }

      coordinates.push({
        x: origin.x + dx,
        y: origin.y + dy,
      });
    }
  }

  coordinates.sort(compareCoordinates);
  return coordinates;
}

export function getExistingTilesWithinDistance(
  world: WorldState,
  tileId: string,
  distance: number,
  options: {
    metric?: "manhattan" | "chebyshev";
    includeOrigin?: boolean;
  } = {},
): MapTile[] {
  const tile = requireTile(world, tileId);
  const tiles: MapTile[] = [];

  for (const coordinate of getCoordinatesWithinDistance(tile, distance, options)) {
    const existingTile = getTileAt(world, coordinate.x, coordinate.y);

    if (existingTile) {
      tiles.push(existingTile);
    }
  }

  return tiles;
}

export function getExistingTilesWithinGraphSteps(
  world: WorldState,
  tileId: string,
  steps: number,
  mode: ConnectionMode = "cardinal",
): MapTile[] {
  if (steps < 0) {
    throw new Error("Steps must be zero or greater.");
  }

  const origin = requireTile(world, tileId);
  const visited = new Set<string>([origin.id]);
  const region: MapTile[] = [origin];
  let frontier = [origin];

  for (let step = 0; step < steps; step++) {
    const nextFrontier: MapTile[] = [];

    for (const tile of frontier) {
      for (const neighbour of getExistingNeighbours(world, tile.id, mode)) {
        if (visited.has(neighbour.id)) {
          continue;
        }

        visited.add(neighbour.id);
        region.push(neighbour);
        nextFrontier.push(neighbour);
      }
    }

    frontier = nextFrontier;
  }

  region.sort(compareTiles);
  return region;
}

export function getConnectedRegion(
  world: WorldState,
  startingTileId: string,
  matches: (tile: MapTile) => boolean,
  mode: ConnectionMode = "cardinal",
): MapTile[] {
  const startingTile = world.tiles[startingTileId];

  if (!startingTile || !matches(startingTile)) {
    return [];
  }

  const visited = new Set<string>();
  const region: MapTile[] = [];
  const queue: MapTile[] = [startingTile];
  visited.add(startingTile.id);

  while (queue.length > 0) {
    const tile = queue.shift()!;
    region.push(tile);

    for (const neighbour of getExistingNeighbours(world, tile.id, mode)) {
      if (visited.has(neighbour.id) || !matches(neighbour)) {
        continue;
      }

      visited.add(neighbour.id);
      queue.push(neighbour);
    }
  }

  region.sort(compareTiles);
  return region;
}

export function matchesTerrain(
  terrain: TerrainType,
): (tile: MapTile) => boolean {
  return (tile) => tile.terrain === terrain;
}

export function hasTag(tag: string): (tile: MapTile) => boolean {
  return (tile) => tile.tags.includes(tag);
}

export function hasSettlementType(
  type: SettlementType,
): (tile: MapTile) => boolean {
  return (tile) => tile.settlement?.type === type;
}

/**
 * Urban tiles are either explicitly urban terrain or contain any settlement.
 */
export function isUrbanTile(tile: MapTile): boolean {
  return tile.terrain === "urban" || tile.settlement !== undefined;
}

export function getConnectedSettlementCluster(
  world: WorldState,
  startingTileId: string,
  mode: ConnectionMode = "cardinal",
): MapTile[] {
  return getConnectedRegion(
    world,
    startingTileId,
    (tile) => tile.settlement !== undefined,
    mode,
  );
}

export function findSettlementClusters(
  world: WorldState,
  mode: ConnectionMode = "cardinal",
): MapTile[][] {
  const settlementTiles = Object.values(world.tiles)
    .filter((tile) => tile.settlement !== undefined)
    .sort(compareTiles);
  const visited = new Set<string>();
  const clusters: MapTile[][] = [];

  for (const tile of settlementTiles) {
    if (visited.has(tile.id)) {
      continue;
    }

    const cluster = getConnectedSettlementCluster(world, tile.id, mode);

    for (const clusterTile of cluster) {
      visited.add(clusterTile.id);
    }

    clusters.push(cluster);
  }

  return clusters;
}

export function getExistingNeighbourIds(
  world: WorldState,
  tile: MapTile,
  mode: NeighbourMode = "cardinal",
): string[] {
  return getExistingNeighbours(world, tile.id, mode).map(
    (neighbour) => neighbour.id,
  );
}
