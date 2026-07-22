import { parseTileId } from "../world/coordinates";
import { getExistingNeighbours } from "../world/neighbours";
import type { WorldState } from "../world/worldTypes";
import type { TravelRouteType } from "./networkTypes";
import type { TerrainType } from "../world/worldTypes";
import { getTileTraversalCost } from "./travelCosts";

export interface PathfindingOptions {
  routeType: TravelRouteType;
  terrainCosts?: Partial<Record<TerrainType, number>>;
  allowExistingRoutesBonus?: boolean;
}

export interface PathfindingResult {
  valid: boolean;
  pathTileIds: string[];
  totalCost: number;
  reason?: string;
}

function manhattanDistance(firstTileId: string, secondTileId: string): number {
  const first = parseTileId(firstTileId);
  const second = parseTileId(secondTileId);
  return Math.abs(first.x - second.x) + Math.abs(first.y - second.y);
}

function compareTileIdsForTieBreak(firstTileId: string, secondTileId: string): number {
  const first = parseTileId(firstTileId);
  const second = parseTileId(secondTileId);

  if (first.y !== second.y) {
    return first.y - second.y;
  }

  return first.x - second.x;
}

/**
 * Tie-breaking: when multiple nodes share the same f-score, prefer the tile
 * with the lowest y, then lowest x (deterministic coordinate order).
 */
export function findTravelPath(
  world: WorldState,
  originTileId: string,
  destinationTileId: string,
  options: PathfindingOptions,
): PathfindingResult {
  if (!world.tiles[originTileId]) {
    return {
      valid: false,
      pathTileIds: [],
      totalCost: 0,
      reason: `Origin tile "${originTileId}" does not exist.`,
    };
  }

  if (!world.tiles[destinationTileId]) {
    return {
      valid: false,
      pathTileIds: [],
      totalCost: 0,
      reason: `Destination tile "${destinationTileId}" does not exist.`,
    };
  }

  if (originTileId === destinationTileId) {
    return {
      valid: false,
      pathTileIds: [],
      totalCost: 0,
      reason: "Origin and destination must differ.",
    };
  }

  const openSet = new Set<string>([originTileId]);
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>([[originTileId, 0]]);

  while (openSet.size > 0) {
    const current = [...openSet].sort((left, right) => {
      const leftScore =
        (gScore.get(left) ?? Number.POSITIVE_INFINITY) +
        manhattanDistance(left, destinationTileId);
      const rightScore =
        (gScore.get(right) ?? Number.POSITIVE_INFINITY) +
        manhattanDistance(right, destinationTileId);

      if (leftScore !== rightScore) {
        return leftScore - rightScore;
      }

      return compareTileIdsForTieBreak(left, right);
    })[0]!;

    if (current === destinationTileId) {
      const pathTileIds = [current];
      let walker = current;

      while (cameFrom.has(walker)) {
        walker = cameFrom.get(walker)!;
        pathTileIds.unshift(walker);
      }

      return {
        valid: true,
        pathTileIds,
        totalCost: gScore.get(destinationTileId) ?? 0,
      };
    }

    openSet.delete(current);

    const neighbours = getExistingNeighbours(world, current, "cardinal").sort(
      (left, right) => compareTileIdsForTieBreak(left.id, right.id),
    );

    for (const neighbour of neighbours) {
      const stepCost = getTileTraversalCost(world, neighbour.id, options);

      if (!Number.isFinite(stepCost)) {
        continue;
      }

      const tentativeG = (gScore.get(current) ?? Number.POSITIVE_INFINITY) + stepCost;

      if (tentativeG >= (gScore.get(neighbour.id) ?? Number.POSITIVE_INFINITY)) {
        continue;
      }

      cameFrom.set(neighbour.id, current);
      gScore.set(neighbour.id, tentativeG);
      openSet.add(neighbour.id);
    }
  }

  return {
    valid: false,
    pathTileIds: [],
    totalCost: 0,
    reason: "No valid path exists between the selected endpoints.",
  };
}
